// Per-view toolbar: the mouse path to every view command. Each button fires
// the same command a shortcut or gesture would.
import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CodeIcon,
  ViewIcon,
  ZoomInAreaIcon,
  ZoomOutAreaIcon,
  ArrowShrinkIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { COMMAND_TITLES, runCommand, type CommandId } from "@/modules/commands/registry";
import { shortcutFor } from "@/modules/commands/keymap";
import type { Tab } from "@/modules/tabs/store";

export function ToolButton({
  command,
  label,
  onClick,
  active,
  children,
  className,
}: {
  command?: CommandId;
  label?: string;
  onClick?: () => void;
  active?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const title = label ?? (command ? COMMAND_TITLES[command] : "");
  const keys = command ? shortcutFor(command) : null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={title}
          aria-pressed={active}
          onClick={onClick ?? (() => command && (runCommand as (id: CommandId, a?: unknown, s?: "mouse") => boolean)(command, undefined, "mouse"))}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            active && "bg-accent text-foreground",
            className,
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {title}
        {keys && <span className="ml-2 font-mono text-[10px] opacity-60">{keys}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; icon?: typeof CodeIcon }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex h-7 items-center rounded-lg bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors",
            value === o.value ? "bg-background text-foreground shadow-xs" : "hover:text-foreground",
          )}
        >
          {o.icon && <HugeiconsIcon icon={o.icon} size={13} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ZoomControls({ zoom }: { zoom: number }) {
  return (
    <div className="flex items-center gap-0.5">
      <ToolButton label="Zoom out" command="view.zoom" onClick={() => runCommand("view.zoom", { factor: 1 / 1.15 }, "mouse")}>
        <HugeiconsIcon icon={ZoomOutAreaIcon} size={14} />
      </ToolButton>
      <ToolButton command="view.zoomReset" className="w-12 justify-center font-mono tabular-nums">
        {Math.round(zoom * 100)}%
      </ToolButton>
      <ToolButton label="Zoom in" command="view.zoom" onClick={() => runCommand("view.zoom", { factor: 1.15 }, "mouse")}>
        <HugeiconsIcon icon={ZoomInAreaIcon} size={14} />
      </ToolButton>
      <ToolButton command="view.zoomFit">
        <HugeiconsIcon icon={ArrowShrinkIcon} size={14} />
      </ToolButton>
    </div>
  );
}

export function ViewerToolbar({
  tab,
  markdown,
  children,
}: {
  tab: Tab;
  markdown?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/60 px-3">
      <div className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground" title={tab.subtitle}>
        {tab.subtitle}
      </div>
      {children}
      {markdown && (
        <Segmented
          value={tab.view.markdownMode}
          onChange={(v) => v !== tab.view.markdownMode && runCommand("markdown.toggleMode", undefined, "mouse")}
          options={[
            { value: "preview", label: "Preview", icon: ViewIcon },
            { value: "raw", label: "Raw", icon: CodeIcon },
          ]}
        />
      )}
      <ZoomControls zoom={tab.view.zoom} />
    </div>
  );
}
