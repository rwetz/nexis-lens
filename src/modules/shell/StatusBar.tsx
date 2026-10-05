import { HugeiconsIcon } from "@hugeicons/react";
import { GitBranchIcon } from "@hugeicons/core-free-icons";
import { describeLanguage } from "@/lib/highlight";
import { relative } from "@/lib/path";
import { GestureStatus } from "@/modules/gestures/GestureHud";
import { useActiveTab } from "@/modules/tabs/store";
import { useWorkspace } from "@/modules/workspace/store";

export function StatusBar() {
  const tab = useActiveTab();
  const ws = useWorkspace((s) => s.workspace);
  const repo = useWorkspace((s) => s.repo);

  let where = "";
  let lang = "";
  if (tab?.item.kind === "file") {
    where = ws ? relative(ws.root, tab.item.path) : tab.item.path;
    lang = describeLanguage(tab.item.path)?.name ?? "Plain text";
  } else if (tab?.item.kind === "diff") {
    const s = tab.item.source;
    where = s.type === "commit" ? `${s.short} — ${s.subject}` : (s.path ?? (s.staged ? "staged changes" : "working tree"));
    lang = tab.view.diffLayout === "split" ? "Split diff" : "Unified diff";
  }

  return (
    <footer className="flex h-6 shrink-0 select-none items-stretch border-t border-border/60 bg-card text-[11px] text-muted-foreground">
      {repo?.branch && (
        <span className="flex items-center gap-1 px-3 font-mono">
          <HugeiconsIcon icon={GitBranchIcon} size={11} />
          {repo.branch}
          {repo.head && <span className="opacity-60">@{repo.head}</span>}
        </span>
      )}
      <span className="min-w-0 truncate px-2 py-1 font-mono">{where}</span>
      <div className="flex-1" />
      {tab && <span className="px-2 py-1">{lang}</span>}
      {tab && <span className="px-2 py-1 font-mono tabular-nums">{Math.round(tab.view.zoom * 100)}%</span>}
      <GestureStatus />
    </footer>
  );
}
