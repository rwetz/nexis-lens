// Git sidebar: working-tree changes (staged / unstaged) and recent history.
// Every entry opens a diff tab.
import { HugeiconsIcon } from "@hugeicons/react";
import { GitCommitIcon, GitCompareIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { basename, dirname } from "@/lib/path";
import type { Change } from "@/lib/ipc";
import { tabKey, useTabs, type TabItem } from "@/modules/tabs/store";
import { splitChanges, useWorkspace } from "./store";

const STATUS_COLOR: Record<string, string> = {
  M: "text-amber-500",
  A: "text-diff-add-fg",
  "?": "text-diff-add-fg",
  D: "text-diff-del-fg",
  R: "text-sky-500",
  C: "text-sky-500",
  U: "text-destructive",
};

function relTime(unix: number): string {
  const s = Date.now() / 1000 - unix;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d`;
  return new Date(unix * 1000).toLocaleDateString();
}

export function ChangesPanel() {
  const repo = useWorkspace((s) => s.repo);
  const changes = useWorkspace((s) => s.changes);
  const commits = useWorkspace((s) => s.commits);
  const ws = useWorkspace((s) => s.workspace);

  if (!ws) return null;
  if (!repo)
    return <p className="px-4 py-3 text-xs text-muted-foreground">This folder is not inside a git repository.</p>;

  const { staged, unstaged } = splitChanges(changes);
  const root = repo.root;

  return (
    <div className="space-y-4 py-2 text-[13px]">
      <Section title="Working tree" count={changes.length}>
        {changes.length === 0 ? (
          <p className="px-3 py-1 text-xs text-muted-foreground">Clean — nothing to review.</p>
        ) : (
          <>
            {unstaged.length > 0 && (
              <OpenRow
                item={{ kind: "diff", source: { type: "worktree", root } }}
                icon={GitCompareIcon}
                label="All unstaged changes"
                strong
              />
            )}
            {staged.length > 0 && (
              <OpenRow
                item={{ kind: "diff", source: { type: "worktree", root, staged: true } }}
                icon={GitCompareIcon}
                label="All staged changes"
                strong
              />
            )}
          </>
        )}
      </Section>

      {staged.length > 0 && (
        <Section title="Staged" count={staged.length}>
          {staged.map((c) => (
            <ChangeRow key={"s" + c.path} change={c} letter={c.index} item={{ kind: "diff", source: { type: "worktree", root, path: c.path, staged: true } }} />
          ))}
        </Section>
      )}
      {unstaged.length > 0 && (
        <Section title="Changes" count={unstaged.length}>
          {unstaged.map((c) => (
            <ChangeRow
              key={"u" + c.path}
              change={c}
              letter={c.worktree}
              item={{ kind: "diff", source: { type: "worktree", root, path: c.path, untracked: c.worktree === "?" } }}
            />
          ))}
        </Section>
      )}

      <Section title="History" count={commits.length}>
        {commits.length === 0 && <p className="px-3 py-1 text-xs text-muted-foreground">No commits yet.</p>}
        {commits.map((c) => (
          <OpenRow
            key={c.sha}
            item={{ kind: "diff", source: { type: "commit", root, sha: c.sha, short: c.short, subject: c.subject } }}
            icon={GitCommitIcon}
            label={c.subject}
            meta={`${c.short} · ${c.author} · ${relTime(c.time)}`}
          />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="flex items-center justify-between px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
        <span className="font-mono normal-case tracking-normal">{count}</span>
      </h3>
      <div className="px-1">{children}</div>
    </section>
  );
}

function useOpen(item: TabItem) {
  const active = useTabs((s) => s.activeId === tabKey(item));
  const open = useTabs((s) => s.open);
  return { active, open: () => open(item) };
}

function ChangeRow({ change, letter, item }: { change: Change; letter: string; item: TabItem }) {
  const { active, open } = useOpen(item);
  const dir = dirname(change.path);
  return (
    <button
      type="button"
      onClick={open}
      title={change.oldPath ? `${change.oldPath} → ${change.path}` : change.path}
      className={cn(
        "flex h-7 w-full items-center gap-2 rounded-md px-2 text-left transition-colors",
        active ? "bg-accent" : "hover:bg-accent/60",
      )}
    >
      <span className={cn("w-3 shrink-0 text-center font-mono text-xs font-semibold", STATUS_COLOR[letter] ?? "text-muted-foreground")}>
        {letter === "?" ? "U" : letter}
      </span>
      <span className="truncate">{basename(change.path)}</span>
      {dir !== change.path && <span className="min-w-0 truncate text-xs text-muted-foreground">{dir}</span>}
    </button>
  );
}

function OpenRow({
  item,
  icon,
  label,
  meta,
  strong,
}: {
  item: TabItem;
  icon: typeof GitCommitIcon;
  label: string;
  meta?: string;
  strong?: boolean;
}) {
  const { active, open } = useOpen(item);
  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
        active ? "bg-accent" : "hover:bg-accent/60",
      )}
    >
      <HugeiconsIcon icon={icon} size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0">
        <span className={cn("block truncate", strong && "font-medium")}>{label}</span>
        {meta && <span className="block truncate font-mono text-[11px] text-muted-foreground">{meta}</span>}
      </span>
    </button>
  );
}
