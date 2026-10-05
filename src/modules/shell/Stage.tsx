// The main viewing area: the active tab's viewer, or an empty state.
import { HugeiconsIcon } from "@hugeicons/react";
import { DashboardSquare02Icon } from "@hugeicons/core-free-icons";
import { DiffViewer } from "@/modules/diff/DiffViewer";
import { formatKeys, KEYMAP } from "@/modules/commands/keymap";
import { COMMAND_TITLES, type CommandId } from "@/modules/commands/registry";
import { useActiveTab } from "@/modules/tabs/store";
import { FileViewer } from "@/modules/viewer/FileViewer";
import { useSettings } from "@/modules/settings/store";

export function Stage() {
  const tab = useActiveTab();
  const fontSize = useSettings((s) => s.fontSize);
  return (
    <div
      className="relative min-h-0 flex-1"
      style={{ "--lens-zoom": tab?.view.zoom ?? 1, "--lens-font-size": `${fontSize}px` } as React.CSSProperties}
    >
      {!tab ? (
        <EmptyStage />
      ) : tab.item.kind === "file" ? (
        <FileViewer key={tab.id} tab={tab} path={tab.item.path} />
      ) : (
        <DiffViewer key={tab.id} tab={tab} source={tab.item.source} />
      )}
    </div>
  );
}

const HINTS: CommandId[] = ["overview.toggle", "tabs.next", "view.zoom", "diff.nextHunk", "markdown.toggleMode", "present.toggle"];

function EmptyStage() {
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="flex max-w-sm flex-col items-center gap-5 text-center">
        <HugeiconsIcon icon={DashboardSquare02Icon} size={28} className="text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">Open a file from the sidebar, or a diff from the Changes tab.</p>
        <dl className="grid w-full grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-xs">
          {HINTS.map((id) => {
            const b = KEYMAP.find((k) => k.command === id && k.listed !== false);
            return b ? (
              <div key={id} className="contents">
                <dt className="text-left text-muted-foreground">{COMMAND_TITLES[id]}</dt>
                <dd className="font-mono text-foreground/80">{formatKeys(b.keys)}</dd>
              </div>
            ) : null;
          })}
        </dl>
      </div>
    </div>
  );
}
