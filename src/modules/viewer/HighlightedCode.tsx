import { useEffect, useState } from "react";
import { highlightLines, type Token } from "@/lib/highlight";

/** Async-highlighted `lines` of `code`; plain text until the grammar loads. */
export function useHighlightedLines(code: string, lang: string): Token[][] | null {
  const [lines, setLines] = useState<Token[][] | null>(null);
  useEffect(() => {
    let live = true;
    setLines(null);
    void highlightLines(code, lang).then((l) => live && setLines(l));
    return () => {
      live = false;
    };
  }, [code, lang]);
  return lines;
}

export function TokenLine({ tokens, fallback }: { tokens?: Token[]; fallback: string }) {
  if (!tokens) return <>{fallback}</>;
  return (
    <>
      {tokens.map((t, i) =>
        t.cls ? (
          <span key={i} className={t.cls}>
            {t.text}
          </span>
        ) : (
          t.text
        ),
      )}
    </>
  );
}

/** A static highlighted code block (markdown fences). */
export function HighlightedCode({ code, lang }: { code: string; lang: string }) {
  const lines = useHighlightedLines(code, lang);
  const raw = code.split("\n");
  return (
    <code>
      {raw.map((l, i) => (
        <span key={i} className="block">
          <TokenLine tokens={lines?.[i]} fallback={l} />
          {l === "" && "​"}
        </span>
      ))}
    </code>
  );
}
