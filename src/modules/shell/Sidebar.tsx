import { useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { ChangesPanel } from "@/modules/workspace/ChangesPanel";
import { FileTree } from "@/modules/workspace/FileTree";
import { useWorkspace } from "@/modules/workspace/store";
import { ToolButton } from "@/modules/viewer/ViewerToolbar";
import { useUi, type SidebarTab } from "./uiStore";

export function Sidebar() {
  const width = useUi((s) => s.sidebarWidth);
  const tab = useUi((s) => s.sidebarTab);
  const setTab = useUi((s) => s.setSidebarTab);
  const setWidth = useUi((s) => s.setSidebarWidth);
  const changes = useWorkspace((s) => s.changes.length);
  const loading = useWorkspace((s) => s.loading);
  const startX = useRef(0);
  const startW = useRef(0);

  const onResizeStart = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    startW.current = width;
    const move = (ev: PointerEvent) => setWidth(startW.current + ev.clientX - startX.current);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.classList.remove("cursor-col-resize");
    };
    document.body.classList.add("cursor-col-resize");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <aside style={{ width }} className="relative flex shrink-0 flex-col border-r border-border/60 bg-sidebar">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border/60 px-2">
        <TabButton id="files" current={tab} onSelect={setTab}>Files</TabButton>
        <TabButton id="changes" current={tab} onSelect={setTab}>
          Changes
          {changes > 0 && <span className="rounded-full bg-brand/15 px-1.5 font-mono text-[10px] text-brand">{changes}</span>}
        </TabButton>
        <div className="flex-1" />
        <ToolButton command="workspace.refresh">
          <HugeiconsIcon icon={RefreshIcon} size={13} className={cn(loading && "animate-spin")} />
        </ToolButton>
      </div>
      <div className="nexis-scrollbar min-h-0 flex-1 overflow-y-auto px-1">
        {tab === "files" ? <FileTree /> : <ChangesPanel />}
      </div>
      <div
        onPointerDown={onResizeStart}
        className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize"
        aria-hidden
      />
    </aside>
  );
}

function TabButton({
  id,
  current,
  onSelect,
  children,
}: {
  id: SidebarTab;
  current: SidebarTab;
  onSelect: (t: SidebarTab) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={current === id}
      onClick={() => onSelect(id)}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
        current === id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
