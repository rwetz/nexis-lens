//! Workspace filesystem access: open a folder, list one directory level at a
//! time (the tree expands lazily), and read text files for the viewer.

use ignore::WalkBuilder;
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::Manager;

/// Files larger than this are refused rather than shipped over IPC — a
/// presentation viewer has no business rendering a 200 MB log.
const MAX_FILE_BYTES: u64 = 8 * 1024 * 1024;
/// How far into a file we look for a NUL byte to decide it is binary.
const BINARY_SNIFF_BYTES: usize = 8000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    root: String,
    name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    path: String,
    content: String,
    size: u64,
    binary: bool,
}

fn canonical_dir(path: &str) -> Result<PathBuf, String> {
    let p = dunce_canonicalize(Path::new(path))?;
    if !p.is_dir() {
        return Err(format!("{} is not a directory", p.display()));
    }
    Ok(p)
}

/// `std::fs::canonicalize` on Windows returns `\?\C:\...` verbatim paths,
/// which git and the asset protocol both handle badly. Strip the prefix.
fn dunce_canonicalize(p: &Path) -> Result<PathBuf, String> {
    let c = std::fs::canonicalize(p).map_err(|e| format!("{}: {e}", p.display()))?;
    #[cfg(windows)]
    {
        let s = c.to_string_lossy();
        if let Some(rest) = s.strip_prefix(r"\\?\") {
            if !rest.starts_with("UNC\\") {
                return Ok(PathBuf::from(rest));
            }
        }
    }
    Ok(c)
}

/// Open a folder as the workspace. Also widens the asset-protocol scope to it,
/// so rendered markdown can show images that live next to the document.
#[tauri::command]
pub fn open_workspace(app: tauri::AppHandle, path: String) -> Result<Workspace, String> {
    let root = canonical_dir(&path)?;
    app.asset_protocol_scope()
        .allow_directory(&root, true)
        .map_err(|e| e.to_string())?;
    let name = root
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| root.display().to_string());
    Ok(Workspace {
        root: root.display().to_string(),
        name,
    })
}

/// One level of a directory, gitignore-aware, directories first.
#[tauri::command]
pub async fn list_dir(path: String) -> Result<Vec<DirEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dir = canonical_dir(&path)?;
        let mut out: Vec<DirEntry> = WalkBuilder::new(&dir)
            .max_depth(Some(1))
            .hidden(false)
            .require_git(false)
            .filter_entry(|e| e.file_name() != ".git")
            .build()
            .filter_map(Result::ok)
            .filter(|e| e.depth() == 1)
            .map(|e| {
                let meta = e.metadata().ok();
                DirEntry {
                    name: e.file_name().to_string_lossy().into_owned(),
                    path: e.path().display().to_string(),
                    is_dir: e.file_type().is_some_and(|t| t.is_dir()),
                    size: meta.map(|m| m.len()).unwrap_or(0),
                }
            })
            .collect();
        out.sort_by(|a, b| {
            b.is_dir
                .cmp(&a.is_dir)
                .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        });
        Ok(out)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn read_text_file(path: String) -> Result<FileContent, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = Path::new(&path);
        let meta = std::fs::metadata(p).map_err(|e| format!("{path}: {e}"))?;
        if meta.is_dir() {
            return Err(format!("{path} is a directory"));
        }
        let size = meta.len();
        if size > MAX_FILE_BYTES {
            return Err(format!(
                "{path} is {:.1} MB — too large to present (limit {} MB)",
                size as f64 / 1_048_576.0,
                MAX_FILE_BYTES / 1_048_576
            ));
        }
        let bytes = std::fs::read(p).map_err(|e| format!("{path}: {e}"))?;
        let sniff = &bytes[..bytes.len().min(BINARY_SNIFF_BYTES)];
        if sniff.contains(&0) {
            return Ok(FileContent {
                path,
                content: String::new(),
                size,
                binary: true,
            });
        }
        Ok(FileContent {
            content: String::from_utf8_lossy(&bytes).into_owned(),
            path,
            size,
            binary: false,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
