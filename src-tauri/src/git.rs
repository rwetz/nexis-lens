//! Git access via the git CLI. Output is returned raw (unified diff text,
//! porcelain status) and parsed in the frontend, which keeps this layer a
//! dumb, auditable pipe and lets the viewer own the data model.

use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

/// Pin the diff prefixes so a user's `diff.noprefix` / `diff.mnemonicPrefix`
/// config cannot change the shape of what the frontend parser sees.
const DIFF_FLAGS: &[&str] = &[
    "--no-color",
    "--no-ext-diff",
    "--src-prefix=a/",
    "--dst-prefix=b/",
    "-M",
];

fn git_cmd(root: &str) -> Command {
    let mut cmd = Command::new("git");
    cmd.arg("-C").arg(root);
    // Never block on a credential/pager prompt the user cannot see.
    cmd.env("GIT_TERMINAL_PROMPT", "0").env("GIT_PAGER", "cat");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

/// Run git and return stdout. `ok_codes` lists exit codes that are not
/// failures (`diff --no-index` exits 1 when the files differ).
fn run_git(root: &str, args: &[&str], ok_codes: &[i32]) -> Result<String, String> {
    let out = git_cmd(root)
        .args(args)
        .output()
        .map_err(|e| format!("could not run git: {e}"))?;
    let code = out.status.code().unwrap_or(-1);
    if out.status.success() || ok_codes.contains(&code) {
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

/// Refs and shas come from the UI; refuse anything that could be parsed as
/// an option or a range expression.
fn validate_rev(rev: &str) -> Result<(), String> {
    let ok = !rev.is_empty()
        && !rev.starts_with('-')
        && rev
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '/' | '_' | '.' | '~' | '^' | '-'));
    if ok {
        Ok(())
    } else {
        Err(format!("invalid revision: {rev}"))
    }
}

async fn blocking<T: Send + 'static>(
    f: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| e.to_string())?
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoInfo {
    root: String,
    branch: Option<String>,
    head: Option<String>,
}

#[tauri::command]
pub async fn git_repo_info(path: String) -> Result<Option<RepoInfo>, String> {
    blocking(move || {
        if !Path::new(&path).exists() {
            return Ok(None);
        }
        let Ok(root) = run_git(&path, &["rev-parse", "--show-toplevel"], &[]) else {
            return Ok(None);
        };
        let root = root.trim().to_string();
        let branch = run_git(&root, &["rev-parse", "--abbrev-ref", "HEAD"], &[])
            .ok()
            .map(|s| s.trim().to_string());
        let head = run_git(&root, &["rev-parse", "--short", "HEAD"], &[])
            .ok()
            .map(|s| s.trim().to_string());
        Ok(Some(RepoInfo { root, branch, head }))
    })
    .await
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Change {
    path: String,
    old_path: Option<String>,
    /// Porcelain X (index) and Y (worktree) status letters.
    index: String,
    worktree: String,
}

#[tauri::command]
pub async fn git_changes(root: String) -> Result<Vec<Change>, String> {
    blocking(move || {
        let raw = run_git(
            &root,
            &["status", "--porcelain=v1", "-z", "--untracked-files=all"],
            &[],
        )?;
        let mut parts = raw.split('\0').filter(|s| !s.is_empty());
        let mut out = Vec::new();
        while let Some(entry) = parts.next() {
            if entry.len() < 4 {
                continue;
            }
            let index = entry[0..1].to_string();
            let worktree = entry[1..2].to_string();
            let path = entry[3..].to_string();
            // With -z, a rename/copy is followed by its source path.
            let old_path = if index == "R" || index == "C" {
                parts.next().map(str::to_string)
            } else {
                None
            };
            out.push(Change {
                path,
                old_path,
                index,
                worktree,
            });
        }
        Ok(out)
    })
    .await
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffRequest {
    root: String,
    /// Limit to one path (relative to root). `None` = whole working tree.
    path: Option<String>,
    /// Diff the index against HEAD instead of the worktree against the index.
    #[serde(default)]
    staged: bool,
    /// The path is untracked: diff it against /dev/null.
    #[serde(default)]
    untracked: bool,
    /// Lines of context around each hunk.
    context: Option<u32>,
}

#[tauri::command]
pub async fn git_diff(req: DiffRequest) -> Result<String, String> {
    blocking(move || {
        let unified = format!("-U{}", req.context.unwrap_or(3).min(50));
        if req.untracked {
            let path = req.path.ok_or("untracked diff needs a path")?;
            let mut args = vec!["diff", "--no-index", unified.as_str()];
            args.extend_from_slice(DIFF_FLAGS);
            args.extend_from_slice(&["--", "/dev/null", path.as_str()]);
            return run_git(&req.root, &args, &[1]);
        }
        let mut args = vec!["diff", unified.as_str()];
        args.extend_from_slice(DIFF_FLAGS);
        if req.staged {
            args.push("--cached");
        }
        if let Some(p) = req.path.as_deref() {
            args.extend_from_slice(&["--", p]);
        }
        run_git(&req.root, &args, &[])
    })
    .await
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Commit {
    sha: String,
    short: String,
    author: String,
    /// Unix seconds.
    time: i64,
    subject: String,
}

#[tauri::command]
pub async fn git_log(root: String, limit: Option<u32>) -> Result<Vec<Commit>, String> {
    blocking(move || {
        let n = format!("-n{}", limit.unwrap_or(50).min(500));
        let raw = match run_git(
            &root,
            &["log", n.as_str(), "--format=%H%x1f%h%x1f%an%x1f%at%x1f%s%x1e"],
            &[],
        ) {
            Ok(s) => s,
            // A fresh repo with no commits has no log; that is not an error.
            Err(e) if e.contains("does not have any commits") => return Ok(vec![]),
            Err(e) => return Err(e),
        };
        Ok(raw
            .split('\u{1e}')
            .filter_map(|rec| {
                let f: Vec<&str> = rec.trim_matches('\n').split('\u{1f}').collect();
                (f.len() == 5).then(|| Commit {
                    sha: f[0].to_string(),
                    short: f[1].to_string(),
                    author: f[2].to_string(),
                    time: f[3].parse().unwrap_or(0),
                    subject: f[4].to_string(),
                })
            })
            .collect())
    })
    .await
}

/// The patch a single commit introduced (first-parent for merges).
#[tauri::command]
pub async fn git_show(root: String, rev: String, context: Option<u32>) -> Result<String, String> {
    blocking(move || {
        validate_rev(&rev)?;
        let unified = format!("-U{}", context.unwrap_or(3).min(50));
        let mut args = vec!["show", "--format=", "--diff-merges=first-parent", unified.as_str()];
        args.extend_from_slice(DIFF_FLAGS);
        args.push(rev.as_str());
        run_git(&root, &args, &[])
    })
    .await
}
