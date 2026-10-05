import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, File01Icon, GitCommitIcon, GitCompareIcon } from "@hugeicons/core-free-icons";
import { spring } from "@nexis/design";
import { cn } from "@/lib/utils";
import { useCommand } from "@/modules/commands/useCommand";
import { useTabs, type Tab } from "./store";

function iconFor(t: Tab) {
  if (t.item.kind === "file") return File01Icon;
  return t.item.source.type === "commit" ? GitCommitIcon : GitCompareIcon;
}

export function TabBar() {
  const tabs = useTabs((s) => s.tabs);
  const activeId = useTabs((s) => s.activeId);
  const activate = useTabs((s) => s.activate);
  const close = useTabs((s) => s.close);
  const cycle = useTabs((s) => s.cycle);
  const strip = useRef<HTMLDivElement>(null);

  useCommand("tabs.next", () => cycle(1));
  useCommand("tabs.prev", () => cycle(-1));
  useCommand("tabs.close", () => {
    const id = useTabs.getState().activeId;
    if (!id) return false;
    close(id);
  });

  // Keep the active tab visible when switching by keyboard or swipe.
  useEffect(() => {
    strip.current
      ?.querySelector<HTMLElement>(`[data-tab-active="true"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [activeId]);

  if (!tabs.length) return null;

  return (
    <div
      ref={strip}
      role="tablist"
      className="no-scrollbar flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-border/60 bg-card/50"
    >
      {tabs.map((t) => {
        const active = t.id === activeId;
        return (
          <div
            key={t.id}
            role="tab"
            aria-selected={active}
            data-tab-active={active}
            title={t.subtitle}
            onClick={() => activate(t.id)}
            onAuxClick={(e) => e.button === 1 && close(t.id)}
            className={cn(
              "group relative flex max-w-60 shrink-0 cursor-pointer items-center gap-2 border-r border-border/50 pl-3 pr-1.5 text-xs transition-colors",
              active ? "bg-background text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            {active && (
              <motion.span layoutId="tab-indicator" transition={spring.snappy} className="absolute inset-x-0 top-0 h-0.5 bg-brand" />
            )}
            <HugeiconsIcon icon={iconFor(t)} size={13} className="shrink-0 opacity-80" />
            <span className="truncate">{t.title}</span>
            <button
              type="button"
              aria-label={`Close ${t.title}`}
              onClick={(e) => {
                e.stopPropagation();
                close(t.id);
              }}
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded hover:bg-accent",
                active ? "opacity-70" : "opacity-0 group-hover:opacity-70",
              )}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
