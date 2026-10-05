import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare02Icon,
  FolderOpenIcon,
  PresentationBarChart01Icon,
  Settings02Icon,
  SidebarLeftIcon,
  Camera01Icon,
  CameraOff01Icon,
  GitBranchIcon,
} from "@hugeicons/core-free-icons";
import { IS_MAC, WindowControls } from "@nexis/design";
import { AppLogo } from "@/components/AppLogo";
import { cn } from "@/lib/utils";
import { useGestures } from "@/modules/gestures/store";
import { ToolButton } from "@/modules/viewer/ViewerToolbar";
import { useWorkspace } from "@/modules/workspace/store";
import { useUi } from "./uiStore";

export function TitleBar() {
  const ws = useWorkspace((s) => s.workspace);
  const repo = useWorkspace((s) => s.repo);
  const sidebarOpen = useUi((s) => s.sidebarOpen);
  const presenting = useUi((s) => s.presenting);
  const gestures = useGestures((s) => s.enabled);

  return (
    <header
      data-tauri-drag-region
      className={cn(
        "flex h-10 shrink-0 select-none items-center gap-2 border-b border-border/60 bg-card pr-1",
        IS_MAC ? "pl-20" : "pl-3",
      )}
    >
      <AppLogo className="pointer-events-none" />
      <span data-tauri-drag-region className="text-sm font-semibold tracking-tight">
        Lens
      </span>
      {ws && (
        <span data-tauri-drag-region className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="text-border">/</span>
          <span className="truncate" title={ws.root}>{ws.name}</span>
          {repo?.branch && (
            <span className="flex items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 font-mono text-[11px]">
              <HugeiconsIcon icon={GitBranchIcon} size={11} />
              {repo.branch}
            </span>
          )}
        </span>
      )}

      <div data-tauri-drag-region className="h-full flex-1" />

      <div className="flex items-center gap-0.5">
        <ToolButton command="sidebar.toggle" active={sidebarOpen}>
          <HugeiconsIcon icon={SidebarLeftIcon} size={15} />
        </ToolButton>
        <ToolButton command="workspace.openFolder">
          <HugeiconsIcon icon={FolderOpenIcon} size={15} />
        </ToolButton>
        <ToolButton command="overview.toggle">
          <HugeiconsIcon icon={DashboardSquare02Icon} size={15} />
        </ToolButton>
        <ToolButton command="gestures.toggle" active={gestures} className={cn(gestures && "text-brand hover:text-brand")}>
          <HugeiconsIcon icon={gestures ? Camera01Icon : CameraOff01Icon} size={15} />
        </ToolButton>
        <ToolButton command="present.toggle" active={presenting}>
          <HugeiconsIcon icon={PresentationBarChart01Icon} size={15} />
        </ToolButton>
        <ToolButton command="settings.open">
          <HugeiconsIcon icon={Settings02Icon} size={15} />
        </ToolButton>
      </div>
      <WindowControls />
    </header>
  );
}
