// In-memory demo workspace, used when the frontend runs in a plain browser
// (`pnpm dev` without Tauri). It exists so the UI can be iterated on — and
// gesture bindings exercised through the simulator — without a native shell.
import type { Change, Commit, DiffRequest, DirEntry, FileContent, RepoInfo, Workspace } from "./ipc";

export const DEMO_ROOT = "/demo/lens-demo";

const FILES: Record<string, string> = {
  "README.md": `# Lens demo

A small workspace served from memory so the viewer runs in a browser.

## What to try

- Open \`src/tracker.ts\` and zoom with **Ctrl + scroll**.
- Open the **Changes** tab and step through hunks with \`]\` and \`[\`.
- Press **Ctrl+G** for the session overview.

| Gesture | Action |
| --- | --- |
| Open palm, vertical | Scroll |
| Pinch | Zoom |
| Swipe left / right | Switch tab |
| Fist | Unified / split diff |

\`\`\`ts
export function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
\`\`\`

> Gesture is a situational layer — keyboard and mouse remain the baseline.
`,
  "src/tracker.ts": `// Hand-tracking loop — placeholder used by the demo workspace.
import { clamp } from "./math";

export interface Frame {
  timestamp: number;
  landmarks: Array<{ x: number; y: number; z: number }>;
  confidence: number;
}

const TARGET_FPS = 30;

export class Tracker {
  private last = 0;
  private frames = 0;

  constructor(private readonly minConfidence = 0.6) {}

  accept(frame: Frame): boolean {
    if (frame.confidence < this.minConfidence) return false;
    this.frames += 1;
    this.last = frame.timestamp;
    return true;
  }

  fps(now: number): number {
    const elapsed = (now - this.last) / 1000;
    return clamp(this.frames / Math.max(elapsed, 1e-3), 0, TARGET_FPS * 2);
  }
}
`,
  "src/math.ts": `export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
`,
  "src-tauri/main.rs": `use std::process::Command;

fn git(args: &[&str]) -> std::io::Result<String> {
    let out = Command::new("git").args(args).output()?;
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

fn main() {
    match git(&["status", "--porcelain"]) {
        Ok(s) => println!("{s}"),
        Err(e) => eprintln!("git failed: {e}"),
    }
}
`,
  "docs/design.md": `# Design notes

Gesture actions are scoped to **navigation**: scroll, zoom, switch, toggle.
Precision work — selecting text, editing — stays on the keyboard and mouse.

1. Arm with a deliberate hold.
2. Perform the command gesture.
3. Lens disarms after a short idle period.
`,
};

const DIFF = `diff --git a/src/tracker.ts b/src/tracker.ts
index 3b18e51..a9d2c4f 100644
--- a/src/tracker.ts
+++ b/src/tracker.ts
@@ -1,5 +1,5 @@
-// Hand-tracking loop.
+// Hand-tracking loop — placeholder used by the demo workspace.
 import { clamp } from "./math";

 export interface Frame {
   timestamp: number;
@@ -8,15 +8,17 @@ export interface Frame {
   confidence: number;
 }

-const TARGET_FPS = 24;
+const TARGET_FPS = 30;

 export class Tracker {
   private last = 0;
   private frames = 0;

-  constructor() {}
+  constructor(private readonly minConfidence = 0.6) {}

   accept(frame: Frame): boolean {
+    if (frame.confidence < this.minConfidence) return false;
     this.frames += 1;
     this.last = frame.timestamp;
     return true;
   }
diff --git a/src/math.ts b/src/math.ts
index 1c2d3e4..5f6a7b8 100644
--- a/src/math.ts
+++ b/src/math.ts
@@ -1,3 +1,7 @@
 export function clamp(v: number, lo: number, hi: number): number {
   return Math.min(hi, Math.max(lo, v));
 }
+
+export function lerp(a: number, b: number, t: number): number {
+  return a + (b - a) * t;
+}
`;

const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 30));
const rel = (p: string) => p.replace(DEMO_ROOT, "").replace(/^\//, "");

export const openWorkspace = (_path: string): Promise<Workspace> =>
  delay({ root: DEMO_ROOT, name: "lens-demo" });

export function listDir(path: string): Promise<DirEntry[]> {
  const prefix = rel(path);
  const seen = new Map<string, DirEntry>();
  for (const f of Object.keys(FILES)) {
    if (prefix && !f.startsWith(prefix + "/")) continue;
    const rest = prefix ? f.slice(prefix.length + 1) : f;
    const [head, ...tail] = rest.split("/");
    const full = `${DEMO_ROOT}/${prefix ? prefix + "/" : ""}${head}`;
    if (!seen.has(head)) {
      seen.set(head, { name: head, path: full, isDir: tail.length > 0, size: FILES[f].length });
    }
  }
  return delay(
    [...seen.values()].sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name)),
  );
}

export function readTextFile(path: string): Promise<FileContent> {
  const content = FILES[rel(path)];
  if (content === undefined) return Promise.reject(`${path}: not found`);
  return delay({ path, content, size: content.length, binary: false });
}

export const repoInfo = (_p: string): Promise<RepoInfo | null> =>
  delay({ root: DEMO_ROOT, branch: "main", head: "a9d2c4f" });

export const changes = (_root: string): Promise<Change[]> =>
  delay([
    { path: "src/tracker.ts", oldPath: null, index: " ", worktree: "M" },
    { path: "src/math.ts", oldPath: null, index: "M", worktree: " " },
  ]);

export function diff(req: DiffRequest): Promise<string> {
  if (!req.path) return delay(DIFF);
  const start = DIFF.indexOf(`diff --git a/${req.path} `);
  if (start < 0) return delay("");
  const next = DIFF.indexOf("diff --git", start + 1);
  return delay(DIFF.slice(start, next < 0 ? undefined : next));
}

const now = Math.floor(Date.now() / 1000);
export const log = (_root: string): Promise<Commit[]> =>
  delay([
    { sha: "a9d2c4f0", short: "a9d2c4f", author: "Demo", time: now - 3600, subject: "Gate frames on tracker confidence" },
    { sha: "3b18e510", short: "3b18e51", author: "Demo", time: now - 86400, subject: "Add lerp helper" },
  ]);

export const show = (_root: string, _rev: string): Promise<string> => delay(DIFF);
