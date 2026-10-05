// Path helpers that work on both separators. Paths come from Rust already
// absolute and normalised, so this only needs to split and join.

const SEP_RE = /[\\/]/;

export const sep = (p: string) => (p.includes("\\") && !p.includes("/") ? "\\" : "/");

export function basename(p: string): string {
  const parts = p.split(SEP_RE).filter(Boolean);
  return parts[parts.length - 1] ?? p;
}

export function dirname(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i <= 0 ? p : p.slice(0, i);
}

export function extname(p: string): string {
  const b = basename(p);
  const i = b.lastIndexOf(".");
  return i <= 0 ? "" : b.slice(i + 1).toLowerCase();
}

export function join(base: string, rel: string): string {
  const s = sep(base);
  const out = base.replace(/[\\/]+$/, "").split(SEP_RE);
  for (const part of rel.split(SEP_RE)) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join(s);
}

/** `p` relative to `root`, with forward slashes; `p` unchanged if outside. */
export function relative(root: string, p: string): string {
  const norm = (x: string) => x.replace(/\\/g, "/").replace(/\/+$/, "");
  const r = norm(root);
  const n = norm(p);
  if (n === r) return "";
  return n.toLowerCase().startsWith(r.toLowerCase() + "/") ? n.slice(r.length + 1) : n;
}

const MARKDOWN_EXT = new Set(["md", "markdown", "mdx", "mdown"]);
export const isMarkdownPath = (p: string) => MARKDOWN_EXT.has(extname(p));
