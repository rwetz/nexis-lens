// Read-only CodeMirror view. Selection, copy and Ctrl+F search work as in an
// editor; editing does not — Lens is for showing code, not changing it.
import { useEffect, useRef } from "react";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { bracketMatching, foldGutter, syntaxHighlighting } from "@codemirror/language";
import { classHighlighter } from "@lezer/highlight";
import { describeLanguage, loadLanguage } from "@/lib/highlight";
import { useSettings } from "@/modules/settings/store";

const lensTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "transparent",
    color: "var(--foreground)",
    fontSize: "calc(var(--lens-font-size) * var(--lens-zoom))",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "1.6",
  },
  ".cm-content": { padding: "12px 0 40vh", caretColor: "transparent" },
  ".cm-gutters": {
    backgroundColor: "var(--background)",
    color: "color-mix(in oklch, var(--muted-foreground) 70%, transparent)",
    border: "none",
    paddingLeft: "8px",
  },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--foreground)" },
  ".cm-activeLine": { backgroundColor: "color-mix(in oklch, var(--accent) 45%, transparent)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in oklch, var(--brand) 26%, transparent) !important",
  },
  ".cm-selectionMatch": { backgroundColor: "color-mix(in oklch, var(--brand) 14%, transparent)" },
  ".cm-searchMatch": {
    backgroundColor: "color-mix(in oklch, var(--brand) 22%, transparent)",
    outline: "1px solid color-mix(in oklch, var(--brand) 55%, transparent)",
  },
  ".cm-panels": {
    backgroundColor: "var(--card)",
    color: "var(--card-foreground)",
    borderColor: "var(--border)",
    fontFamily: "var(--font-sans)",
  },
  ".cm-foldGutter span": { opacity: 0.5 },
});

export function CodeView({
  doc,
  filename,
  zoom,
  onScroller,
}: {
  doc: string;
  filename: string;
  /** Only used to tell CodeMirror to re-measure after a font-size change. */
  zoom: number;
  /** Receives the scrolling element once the editor exists. */
  onScroller: (el: HTMLElement | null) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lang = useRef(new Compartment());
  const wrap = useRef(new Compartment());
  const gutter = useRef(new Compartment());
  const lineWrap = useSettings((s) => s.lineWrap);
  const showLineNumbers = useSettings((s) => s.lineNumbers);

  useEffect(() => {
    if (!host.current) return;
    const { lineWrap, lineNumbers: ln } = useSettings.getState();
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc,
        extensions: [
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          // Keep the content focusable so selection + Ctrl+F still work.
          EditorView.contentAttributes.of({ tabindex: "0" }),
          gutter.current.of(ln ? [lineNumbers(), foldGutter(), highlightActiveLineGutter()] : []),
          highlightActiveLine(),
          drawSelection(),
          bracketMatching(),
          highlightSelectionMatches(),
          search({ top: true }),
          keymap.of([...searchKeymap, ...defaultKeymap]),
          syntaxHighlighting(classHighlighter),
          lang.current.of([]),
          wrap.current.of(lineWrap ? EditorView.lineWrapping : []),
          lensTheme,
        ],
      }),
    });
    viewRef.current = view;
    onScroller(view.scrollDOM);

    let cancelled = false;
    void loadLanguage(describeLanguage(filename)).then((support) => {
      if (!cancelled && support) view.dispatch({ effects: lang.current.reconfigure(support) });
    });

    return () => {
      cancelled = true;
      onScroller(null);
      view.destroy();
      viewRef.current = null;
    };
    // A new doc or file means a new editor; settings are reconfigured below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, filename]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: wrap.current.reconfigure(lineWrap ? EditorView.lineWrapping : []),
    });
  }, [lineWrap]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: gutter.current.reconfigure(
        showLineNumbers ? [lineNumbers(), foldGutter(), highlightActiveLineGutter()] : [],
      ),
    });
  }, [showLineNumbers]);

  useEffect(() => {
    viewRef.current?.requestMeasure();
  }, [zoom]);

  return <div ref={host} className="lens-code h-full min-h-0" />;
}
