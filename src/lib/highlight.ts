// Language detection and static syntax highlighting.
//
// CodeMirror does live highlighting inside the code view; this module covers
// everything that is *not* an editor — diff lines and markdown code blocks —
// by running the same Lezer parsers once and emitting `tok-*` classes that
// @nexis/design's code-highlight.css already colours for light and dark.
import { LanguageDescription, type LanguageSupport } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { classHighlighter, highlightTree } from "@lezer/highlight";
import { basename } from "./path";

export type Token = { text: string; cls: string };

const supportCache = new Map<string, Promise<LanguageSupport | null>>();

export function describeLanguage(filename: string): LanguageDescription | null {
  return LanguageDescription.matchFilename(languages, basename(filename));
}

/** Resolve by filename, or by a fenced-code-block info string (`ts`, `rust`). */
export function findLanguage(nameOrFile: string): LanguageDescription | null {
  return (
    LanguageDescription.matchFilename(languages, basename(nameOrFile)) ??
    LanguageDescription.matchLanguageName(languages, nameOrFile, true)
  );
}

export function loadLanguage(desc: LanguageDescription | null): Promise<LanguageSupport | null> {
  if (!desc) return Promise.resolve(null);
  let p = supportCache.get(desc.name);
  if (!p) {
    p = desc.load().catch(() => null);
    supportCache.set(desc.name, p);
  }
  return p;
}

/** Highlight a block of code and split the result back into lines. */
export async function highlightLines(code: string, lang: string): Promise<Token[][]> {
  const support = await loadLanguage(findLanguage(lang));
  const lines: Token[][] = [[]];
  const push = (text: string, cls: string) => {
    const parts = text.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ text: part, cls });
    });
  };
  if (!support) {
    push(code, "");
    return lines;
  }
  const tree = support.language.parser.parse(code);
  let pos = 0;
  highlightTree(tree, classHighlighter, (from, to, classes) => {
    if (from > pos) push(code.slice(pos, from), "");
    push(code.slice(from, to), classes);
    pos = to;
  });
  if (pos < code.length) push(code.slice(pos), "");
  return lines;
}
