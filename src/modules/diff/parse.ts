// Unified-diff parser for `git diff` / `git show` output (prefixes pinned to
// a/ and b/ by the backend). Produces files → hunks → lines with old/new line
// numbers, plus a pairing helper for the split layout.

export type LineType = "ctx" | "add" | "del" | "note";

export type DiffLine = {
  type: LineType;
  text: string;
  oldNo: number | null;
  newNo: number | null;
};

export type Hunk = {
  header: string;
  /** Text after the second @@ — usually the enclosing function. */
  section: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
};

export type FileStatus = "modified" | "added" | "deleted" | "renamed" | "copied";

export type DiffFile = {
  oldPath: string | null;
  newPath: string | null;
  /** Display path: the new path, or the old one for deletions. */
  path: string;
  status: FileStatus;
  binary: boolean;
  hunks: Hunk[];
  additions: number;
  deletions: number;
};

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;

function stripPrefix(p: string): string | null {
  if (p === "/dev/null") return null;
  // Paths with spaces may be quoted by git.
  const unq = p.startsWith('"') && p.endsWith('"') ? p.slice(1, -1) : p;
  return unq.replace(/^[ab]\//, "");
}

export function parseDiff(text: string): DiffFile[] {
  const files: DiffFile[] = [];
  let file: DiffFile | null = null;
  let hunk: Hunk | null = null;
  let oldNo = 0;
  let newNo = 0;

  const finishFile = () => {
    if (!file) return;
    file.path = file.newPath ?? file.oldPath ?? "(unknown)";
    if (file.oldPath === null && file.newPath !== null) file.status = "added";
    else if (file.newPath === null && file.oldPath !== null) file.status = "deleted";
    files.push(file);
  };

  const lines = text.split("\n");
  // A trailing newline produces one empty final element that is not a line.
  if (lines[lines.length - 1] === "") lines.pop();

  for (const raw of lines) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;

    if (line.startsWith("diff --git ")) {
      finishFile();
      const m = /^diff --git (.+?) (b\/.+|"b\/.+")$/.exec(line);
      file = {
        oldPath: m ? stripPrefix(m[1]) : null,
        newPath: m ? stripPrefix(m[2]) : null,
        path: "",
        status: "modified",
        binary: false,
        hunks: [],
        additions: 0,
        deletions: 0,
      };
      hunk = null;
      continue;
    }
    if (!file) continue;

    // Some tools strip the single space from blank context lines.
    if (hunk && line === "") {
      hunk.lines.push({ type: "ctx", text: "", oldNo: oldNo++, newNo: newNo++ });
      continue;
    }

    if (!hunk || !/^[ +\-\\]/.test(line)) {
      // File header territory.
      if (line.startsWith("--- ")) file.oldPath = stripPrefix(line.slice(4));
      else if (line.startsWith("+++ ")) file.newPath = stripPrefix(line.slice(4));
      else if (line.startsWith("new file mode")) file.status = "added";
      else if (line.startsWith("deleted file mode")) file.status = "deleted";
      else if (line.startsWith("rename from ")) {
        file.status = "renamed";
        file.oldPath = line.slice(12);
      } else if (line.startsWith("rename to ")) file.newPath = line.slice(10);
      else if (line.startsWith("copy from ")) file.status = "copied";
      else if (line.startsWith("Binary files ") || line === "GIT binary patch") file.binary = true;
      else {
        const m = HUNK_RE.exec(line);
        if (m) {
          hunk = {
            header: line,
            section: m[5] ?? "",
            oldStart: +m[1],
            oldLines: m[2] === undefined ? 1 : +m[2],
            newStart: +m[3],
            newLines: m[4] === undefined ? 1 : +m[4],
            lines: [],
          };
          oldNo = hunk.oldStart;
          newNo = hunk.newStart;
          file.hunks.push(hunk);
        }
      }
      continue;
    }

    const body = line.slice(1);
    switch (line[0]) {
      case " ":
        hunk.lines.push({ type: "ctx", text: body, oldNo: oldNo++, newNo: newNo++ });
        break;
      case "+":
        hunk.lines.push({ type: "add", text: body, oldNo: null, newNo: newNo++ });
        file.additions++;
        break;
      case "-":
        hunk.lines.push({ type: "del", text: body, oldNo: oldNo++, newNo: null });
        file.deletions++;
        break;
      case "\\":
        hunk.lines.push({ type: "note", text: line.slice(2), oldNo: null, newNo: null });
        break;
    }
  }
  finishFile();
  return files;
}

export type SplitRow = { left: DiffLine | null; right: DiffLine | null };

/** Pair a hunk's lines side by side: context on both sides, each run of
 * deletions aligned against the run of additions that follows it. */
export function toSplitRows(h: Hunk): SplitRow[] {
  const rows: SplitRow[] = [];
  let dels: DiffLine[] = [];
  let adds: DiffLine[] = [];
  const flush = () => {
    const n = Math.max(dels.length, adds.length);
    for (let i = 0; i < n; i++) rows.push({ left: dels[i] ?? null, right: adds[i] ?? null });
    dels = [];
    adds = [];
  };
  for (const l of h.lines) {
    if (l.type === "del") {
      if (adds.length) flush();
      dels.push(l);
    } else if (l.type === "add") adds.push(l);
    else {
      flush();
      rows.push(l.type === "note" ? { left: null, right: l } : { left: l, right: l });
    }
  }
  flush();
  return rows;
}

export function diffStats(files: DiffFile[]) {
  return files.reduce(
    (a, f) => ({ additions: a.additions + f.additions, deletions: a.deletions + f.deletions }),
    { additions: 0, deletions: 0 },
  );
}
