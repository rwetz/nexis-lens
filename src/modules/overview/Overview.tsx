// Session overview: every open file and diff as a grid. Arrow keys, mouse
// hover or a pointing gesture move the highlight; Enter, click, or a pinch /
// hold selects and jumps in.
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, FileEditIcon, GitCommitIcon, GitCompareIcon } from "@hugeicons/core-free-icons";
import { spring, tween } from "@nexis/design";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { cn } from "@/lib/utils";
import { useCommand } from "@/modules/commands/useCommand";
import { runCommand } from "@/modules/commands/registry";
import { formatKeys } from "@/modules/commands/keymap";
import { diffStats, parseDiff } from "@/modules/diff/parse";
import { useSettings } from "@/modules/settings/store";
import { useUi } from "@/modules/shell/uiStore";
import { useTabs, type Tab } from "@/modules/tabs/store";
import { diffKey, fileKey, peek } from "@/modules/viewer/content";
import type { FileContent } from "@/lib/ipc";

export function Overview() {
  const open = useUi((s) => s.overviewOpen);
  const setOpen = useUi((s) => s.setOverviewOpen);
  const tabs = useTabs((s) => s.tabs);
  const activeId = useTabs((s) => s.activeId);
  const activate = useTabs((s) => s.activate);
  const [highlight, setHighlight] = useState(0);
  const grid = useRef<HTMLDivElement>(null);

  // Opening starts the highlight on the current tab.
  useEffect(() => {
    if (open) setHighlight(Math.max(0, tabs.findIndex((t) => t.id === activeId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const columns = () => {
    const el = grid.current;
    if (!el) return 1;
    return getComputedStyle(el).gridTemplateColumns.split(" ").length;
  };

  const select = (i: number) => {
    const t = tabs[i];
    if (t) activate(t.id);
    setOpen(false);
  };

  useCommand("overview.toggle", () => setOpen(!useUi.getState().overviewOpen));
  useCommand("overview.open", () => setOpen(true));
  useCommand("overview.close", () => setOpen(false));
  useCommand("overview.move", ({ dx, dy }) => {
    if (!open || !tabs.length) return false;
    setHighlight((h) => Math.max(0, Math.min(tabs.length - 1, h + dx + dy * columns())));
  });
  useCommand("overview.pointAt", ({ x, y }) => {
    if (!open) return false;
    const el = document.elementFromPoint(x * window.innerWidth, y * window.innerHeight);
    const card = el?.closest<HTMLElement>("[data-overview-index]");
    if (card) setHighlight(+card.dataset.overviewIndex!);
  });
  useCommand("overview.select", () => {
    if (!open) return false;
    select(highlight);
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-40 flex flex-col bg-background/80 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={tween.base}
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="flex items-center gap-3 px-8 pb-2 pt-6">
            <h2 className="text-lg font-semibold tracking-tight">Session overview</h2>
            <span className="text-sm text-muted-foreground">
              {tabs.length} open item{tabs.length === 1 ? "" : "s"}
            </span>
            <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
              ← → ↑ ↓ to move · Enter to open · {formatKeys("Escape")} to close
            </span>
            <button
              type="button"
              aria-label="Close overview"
              onClick={() => setOpen(false)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={16} />
            </button>
          </div>

          {tabs.length === 0 ? (
            <div className="grid flex-1 place-items-center text-sm text-muted-foreground">Nothing open yet.</div>
          ) : (
            <div
              ref={grid}
              className="nexis-scrollbar grid flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5 overflow-auto px-8 pb-10 pt-4"
              onClick={(e) => e.target === e.currentTarget && setOpen(false)}
            >
              {tabs.map((t, i) => (
                <motion.div
                  key={t.id}
                  data-overview-index={i}
                  initial={{ opacity: 0, y: 14, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: i === highlight ? 1.02 : 1 }}
                  transition={{ ...spring.smooth, delay: Math.min(i, 12) * 0.025 }}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => select(i)}
                  className="cursor-pointer"
                >
                  <OverviewCard tab={t} highlighted={i === highlight} current={t.id === activeId} />
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function OverviewCard({ tab, highlighted, current }: { tab: Tab; highlighted: boolean; current: boolean }) {
  const context = useSettings((s) => s.diffContext);
  const preview = useMemo(() => {
    if (tab.item.kind === "file") {
      const f = peek<FileContent>(fileKey(tab.item.path));
      return { lines: f?.binary ? [] : (f?.content.split("\n").slice(0, 14) ?? []), stats: null };
    }
    const text = peek<string>(diffKey(tab.item.source, context));
    if (!text) return { lines: [], stats: null };
    const files = parseDiff(text);
    const lines = files.flatMap((f) => f.hunks.flatMap((h) => h.lines.filter((l) => l.type !== "ctx").map((l) => (l.type === "add" ? "+" : "-") + l.text))).slice(0, 14);
    return { lines, stats: { ...diffStats(files), files: files.length } };
  }, [tab, context]);

  const icon =
    tab.item.kind === "file" ? FileEditIcon : tab.item.source.type === "commit" ? GitCommitIcon : GitCompareIcon;

  return (
    <SpotlightCard
      active={highlighted}
      spotlightColor="rgba(240, 128, 106, 0.16)"
      className={cn(
        "flex h-56 flex-col gap-3 rounded-2xl p-4 transition-shadow",
        highlighted && "brand-glow border-brand/60",
      )}
    >
      <div className="flex items-center gap-2">
        <HugeiconsIcon icon={icon} size={15} className="shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium">{tab.title}</span>
        {current && <span className="ml-auto shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-medium text-brand">current</span>}
      </div>
      <pre className="min-h-0 flex-1 overflow-hidden font-mono text-[10px] leading-[1.45] text-muted-foreground [mask-image:linear-gradient(to_bottom,black_60%,transparent)]">
        {preview.lines.map((l, i) => (
          <div
            key={i}
            className={cn(
              "truncate",
              tab.item.kind === "diff" && l.startsWith("+") && "text-diff-add-fg",
              tab.item.kind === "diff" && l.startsWith("-") && "text-diff-del-fg",
            )}
          >
            {l || " "}
          </div>
        ))}
      </pre>
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="truncate font-mono">{tab.subtitle}</span>
        {preview.stats && (
          <span className="shrink-0 font-mono">
            <span className="text-diff-add-fg">+{preview.stats.additions}</span>{" "}
            <span className="text-diff-del-fg">−{preview.stats.deletions}</span>
          </span>
        )}
      </div>
    </SpotlightCard>
  );
}

/** Toolbar trigger. */
export function openOverview() {
  runCommand("overview.toggle", undefined, "mouse");
}
