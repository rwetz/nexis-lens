// Git diff review: every file in the patch, stacked, in a unified or split
// layout. Hunks are the unit of navigation — `]` / `[` (or a vertical swipe)
// steps through them across files, and the current hunk carries the brand
// focus ring so an audience can follow along.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  LayoutTwoColumnIcon,
  ParagraphIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import type { Token } from "@/lib/highlight";
import { useCommand } from "@/modules/commands/useCommand";
import { runCommand } from "@/modules/commands/registry";
import { useSettings } from "@/modules/settings/store";
import { useTabs, type DiffSource, type Tab } from "@/modules/tabs/store";
import { useDiffText } from "@/modules/viewer/content";
import { Centered } from "@/modules/viewer/FileViewer";
import { useHighlightedLines, TokenLine } from "@/modules/viewer/HighlightedCode";
import { revealInScroller, useViewport } from "@/modules/viewer/useViewport";
import { Segmented, ToolButton, ViewerToolbar } from "@/modules/viewer/ViewerToolbar";
import { diffStats, parseDiff, toSplitRows, type DiffFile, type DiffLine, type Hunk } from "./parse";

/** Files with more changed lines than this start collapsed. */
const AUTO_COLLAPSE_LINES = 1500;

export function DiffViewer({ tab, source }: { tab: Tab; source: DiffSource }) {
  const context = useSettings((s) => s.diffContext);
  const res = useDiffText(source, context);
  const files = useMemo(() => (res.status === "ready" ? parseDiff(res.data) : []), [res]);

  if (res.status === "loading") return <Centered spin label="Loading diff…" />;
  if (res.status === "error") return <Centered label={res.error} />;
  if (!files.length) return <Centered label="No changes." />;
  return <DiffBody tab={tab} files={files} />;
}

function DiffBody({ tab, files }: { tab: Tab; files: DiffFile[] }) {
  const updateView = useTabs((s) => s.updateView);
  const smooth = useSettings((s) => s.smoothScroll);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const getScroller = useCallback(() => scroller, [scroller]);
  useViewport({ tab, getScroller });

  const layout = tab.view.diffLayout;
  const stats = useMemo(() => diffStats(files), [files]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(files.map((f) => [f.path, f.additions + f.deletions > AUTO_COLLAPSE_LINES])),
  );

  // Flat list of hunks across files — the navigation order.
  const hunkIds = useMemo(
    () => files.flatMap((f, fi) => f.hunks.map((_, hi) => `${fi}:${hi}`)),
    [files],
  );
  const current = Math.min(tab.view.hunkIndex, hunkIds.length - 1);
  const hunkEls = useRef(new Map<string, HTMLElement>());

  const goTo = (i: number) => {
    if (!hunkIds.length) return;
    const idx = Math.max(0, Math.min(hunkIds.length - 1, i));
    const id = hunkIds[idx];
    const fileIdx = +id.split(":")[0];
    const path = files[fileIdx].path;
    if (collapsed[path]) setCollapsed((c) => ({ ...c, [path]: false }));
    updateView(tab.id, { hunkIndex: idx });
    // Wait a frame in case the file just expanded.
    requestAnimationFrame(() => {
      const el = hunkEls.current.get(id);
      if (el && scroller) revealInScroller(scroller, el, smooth);
    });
  };

  // With no hunk selected yet, navigation starts from what is on screen: the
  // first hunk starting at or below the viewport top, or the last one above it.
  const firstBelowTop = () => {
    const top = (scroller?.getBoundingClientRect().top ?? 0) - 2;
    const i = hunkIds.findIndex((id) => (hunkEls.current.get(id)?.getBoundingClientRect().top ?? -Infinity) >= top);
    return i < 0 ? hunkIds.length : i;
  };

  useCommand("diff.nextHunk", () => goTo(current < 0 ? firstBelowTop() : current + 1));
  useCommand("diff.prevHunk", () => goTo(current < 0 ? firstBelowTop() - 1 : current - 1));
  useCommand("diff.toggleLayout", () =>
    updateView(tab.id, { diffLayout: layout === "unified" ? "split" : "unified" }),
  );

  // Keep the current hunk in view across layout switches.
  useEffect(() => {
    if (current < 0) return;
    const el = hunkEls.current.get(hunkIds[current]);
    if (el && scroller) requestAnimationFrame(() => revealInScroller(scroller, el, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ViewerToolbar tab={tab}>
        <span className="font-mono text-xs tabular-nums">
          <span className="text-diff-add-fg">+{stats.additions}</span>{" "}
          <span className="text-diff-del-fg">−{stats.deletions}</span>
          <span className="ml-2 text-muted-foreground">
            {files.length} file{files.length === 1 ? "" : "s"}
          </span>
        </span>
        <div className="flex items-center gap-0.5">
          <ToolButton command="diff.prevHunk">
            <HugeiconsIcon icon={ArrowUp01Icon} size={14} />
          </ToolButton>
          <span className="w-14 text-center font-mono text-xs tabular-nums text-muted-foreground">
            {current < 0 ? "–" : current + 1}/{hunkIds.length}
          </span>
          <ToolButton command="diff.nextHunk">
            <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
          </ToolButton>
        </div>
        <Segmented
          value={layout}
          onChange={(v) => v !== layout && runCommand("diff.toggleLayout", undefined, "mouse")}
          options={[
            { value: "unified", label: "Unified", icon: ParagraphIcon },
            { value: "split", label: "Split", icon: LayoutTwoColumnIcon },
          ]}
        />
      </ViewerToolbar>

      <div ref={setScroller} className="lens-diff nexis-scrollbar min-h-0 flex-1 overflow-auto px-4 pb-[40vh] pt-4">
        {files.map((f, fi) => (
          <section key={f.path + fi} className="mb-4 overflow-hidden rounded-xl border border-border/70 bg-card/40">
            <FileHeader
              file={f}
              collapsed={!!collapsed[f.path]}
              onToggle={() => setCollapsed((c) => ({ ...c, [f.path]: !c[f.path] }))}
            />
            {!collapsed[f.path] &&
              (f.binary ? (
                <div className="px-4 py-3 text-xs text-muted-foreground">Binary file changed.</div>
              ) : (
                <FileHunks
                  file={f}
                  layout={layout}
                  currentId={current >= 0 ? hunkIds[current] : null}
                  fileIndex={fi}
                  register={(id, el) => {
                    if (el) hunkEls.current.set(id, el);
                    else hunkEls.current.delete(id);
                  }}
                  onPick={(id) => updateView(tab.id, { hunkIndex: hunkIds.indexOf(id) })}
                />
              ))}
          </section>
        ))}
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<DiffFile["status"], { label: string; cls: string }> = {
  modified: { label: "M", cls: "text-amber-500" },
  added: { label: "A", cls: "text-diff-add-fg" },
  deleted: { label: "D", cls: "text-diff-del-fg" },
  renamed: { label: "R", cls: "text-sky-500" },
  copied: { label: "C", cls: "text-sky-500" },
};

function FileHeader({ file, collapsed, onToggle }: { file: DiffFile; collapsed: boolean; onToggle: () => void }) {
  const s = STATUS_LABEL[file.status];
  return (
    <button
      type="button"
      onClick={onToggle}
      className="sticky top-0 z-10 flex w-full items-center gap-2 border-b border-border/70 bg-card px-3 py-2 text-left text-[0.8em]"
    >
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        size={14}
        className={cn("shrink-0 text-muted-foreground transition-transform", !collapsed && "rotate-90")}
      />
      <span className={cn("w-4 shrink-0 font-mono font-semibold", s.cls)}>{s.label}</span>
      <span className="min-w-0 truncate font-mono">
        {file.status === "renamed" && file.oldPath ? (
          <>
            <span className="text-muted-foreground">{file.oldPath} → </span>
            {file.newPath}
          </>
        ) : (
          file.path
        )}
      </span>
      <span className="ml-auto shrink-0 font-mono tabular-nums text-muted-foreground">
        <span className="text-diff-add-fg">+{file.additions}</span> <span className="text-diff-del-fg">−{file.deletions}</span>
      </span>
    </button>
  );
}

/** Highlight each side of a file's hunks as one document so the parser sees
 * real context, then map tokens back to individual diff lines. */
function useSideTokens(file: DiffFile) {
  const { oldText, newText, oldIdx, newIdx } = useMemo(() => {
    const oldLines: string[] = [];
    const newLines: string[] = [];
    const oldIdx = new Map<DiffLine, number>();
    const newIdx = new Map<DiffLine, number>();
    for (const h of file.hunks) {
      for (const l of h.lines) {
        if (l.type === "ctx" || l.type === "del") {
          oldIdx.set(l, oldLines.length);
          oldLines.push(l.text);
        }
        if (l.type === "ctx" || l.type === "add") {
          newIdx.set(l, newLines.length);
          newLines.push(l.text);
        }
      }
    }
    return { oldText: oldLines.join("\n"), newText: newLines.join("\n"), oldIdx, newIdx };
  }, [file]);
  const oldTokens = useHighlightedLines(oldText, file.oldPath ?? file.path);
  const newTokens = useHighlightedLines(newText, file.path);
  return (l: DiffLine): Token[] | undefined => {
    if (l.type === "del") return oldTokens?.[oldIdx.get(l) ?? -1];
    const i = newIdx.get(l);
    return i === undefined ? undefined : newTokens?.[i];
  };
}

const FileHunks = memo(function FileHunks({
  file,
  fileIndex,
  layout,
  currentId,
  register,
  onPick,
}: {
  file: DiffFile;
  fileIndex: number;
  layout: "unified" | "split";
  currentId: string | null;
  register: (id: string, el: HTMLElement | null) => void;
  onPick: (id: string) => void;
}) {
  const tokensFor = useSideTokens(file);
  return (
    <div className="font-mono text-[length:inherit]">
      {file.hunks.map((h, hi) => {
        const id = `${fileIndex}:${hi}`;
        return (
          <div
            key={id}
            ref={(el) => register(id, el)}
            onClick={() => onPick(id)}
            className={cn("relative", currentId === id && "lens-hunk-current")}
          >
            <HunkHeader hunk={h} />
            {layout === "unified" ? (
              <UnifiedHunk hunk={h} tokensFor={tokensFor} />
            ) : (
              <SplitHunk hunk={h} tokensFor={tokensFor} />
            )}
          </div>
        );
      })}
    </div>
  );
});

function HunkHeader({ hunk }: { hunk: Hunk }) {
  return (
    <div className="lens-hunk-header truncate px-3 py-1 text-[0.85em] text-muted-foreground">
      @@ −{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
      {hunk.section && <span className="ml-2 opacity-80">{hunk.section}</span>}
    </div>
  );
}

type TokensFor = (l: DiffLine) => Token[] | undefined;

function UnifiedHunk({ hunk, tokensFor }: { hunk: Hunk; tokensFor: TokensFor }) {
  return (
    <table className="lens-diff-table">
      <tbody>
        {hunk.lines.map((l, i) => (
          <tr key={i} className={`lens-line-${l.type}`}>
            <td className="lens-ln">{l.oldNo ?? ""}</td>
            <td className="lens-ln">{l.newNo ?? ""}</td>
            <td className="lens-sign">{l.type === "add" ? "+" : l.type === "del" ? "−" : ""}</td>
            <td className="lens-code-cell">
              {l.type === "note" ? <em className="opacity-70">{l.text}</em> : <TokenLine tokens={tokensFor(l)} fallback={l.text} />}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SplitHunk({ hunk, tokensFor }: { hunk: Hunk; tokensFor: TokensFor }) {
  const rows = useMemo(() => toSplitRows(hunk), [hunk]);
  const side = (l: DiffLine | null, which: "left" | "right") => {
    if (!l) return (
      <>
        <td className="lens-ln lens-empty" />
        <td className="lens-code-cell lens-empty" />
      </>
    );
    const kind = l.type === "ctx" ? "ctx" : l.type;
    return (
      <>
        <td className={`lens-ln lens-line-${kind}`}>{which === "left" ? l.oldNo : l.newNo}</td>
        <td className={`lens-code-cell lens-line-${kind}`}>
          {l.type === "note" ? <em className="opacity-70">{l.text}</em> : <TokenLine tokens={tokensFor(l)} fallback={l.text} />}
        </td>
      </>
    );
  };
  return (
    <table className="lens-diff-table lens-split">
      <colgroup>
        <col className="w-[4.5em]" />
        <col />
        <col className="w-[4.5em]" />
        <col />
      </colgroup>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {side(r.left, "left")}
            {side(r.right, "right")}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
