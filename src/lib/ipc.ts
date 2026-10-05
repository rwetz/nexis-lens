// Typed wrappers over the Rust commands in src-tauri/src/{fs,git}.rs.
//
// Outside Tauri (plain `pnpm dev` in a browser) every call is served from the
// in-memory demo workspace in ./demo.ts, so the UI can be iterated on without
// a native shell.
import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import * as demo from "./demo";

export type Workspace = { root: string; name: string };
export type DirEntry = { name: string; path: string; isDir: boolean; size: number };
export type FileContent = { path: string; content: string; size: number; binary: boolean };
export type RepoInfo = { root: string; branch: string | null; head: string | null };
export type Change = {
  path: string;
  oldPath: string | null;
  /** Porcelain X (index) status letter. */
  index: string;
  /** Porcelain Y (worktree) status letter. */
  worktree: string;
};
export type Commit = { sha: string; short: string; author: string; time: number; subject: string };
export type DiffRequest = {
  root: string;
  path?: string;
  staged?: boolean;
  untracked?: boolean;
  context?: number;
};

export const IN_TAURI = isTauri();

export const ipc = {
  openWorkspace: (path: string) =>
    IN_TAURI ? invoke<Workspace>("open_workspace", { path }) : demo.openWorkspace(path),
  listDir: (path: string) =>
    IN_TAURI ? invoke<DirEntry[]>("list_dir", { path }) : demo.listDir(path),
  readTextFile: (path: string) =>
    IN_TAURI ? invoke<FileContent>("read_text_file", { path }) : demo.readTextFile(path),
  repoInfo: (path: string) =>
    IN_TAURI ? invoke<RepoInfo | null>("git_repo_info", { path }) : demo.repoInfo(path),
  changes: (root: string) =>
    IN_TAURI ? invoke<Change[]>("git_changes", { root }) : demo.changes(root),
  diff: (req: DiffRequest) =>
    IN_TAURI ? invoke<string>("git_diff", { req }) : demo.diff(req),
  log: (root: string, limit?: number) =>
    IN_TAURI ? invoke<Commit[]>("git_log", { root, limit }) : demo.log(root),
  show: (root: string, rev: string, context?: number) =>
    IN_TAURI ? invoke<string>("git_show", { root, rev, context }) : demo.show(root, rev),
};

/** Folder picker. Returns null when cancelled or outside Tauri. */
export async function pickFolder(): Promise<string | null> {
  if (!IN_TAURI) return demo.DEMO_ROOT;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({ directory: true, multiple: false, title: "Open folder" });
  return typeof picked === "string" ? picked : null;
}

export async function openExternal(url: string): Promise<void> {
  if (!IN_TAURI) {
    window.open(url, "_blank", "noopener");
    return;
  }
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await openUrl(url);
}

/** URL the webview can load a local file from (markdown images). */
export async function localFileUrl(path: string): Promise<string> {
  return IN_TAURI ? convertFileSrc(path) : path;
}
