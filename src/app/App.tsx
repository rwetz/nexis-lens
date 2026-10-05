// ╔══════════════════════════════════════╗
// ║  Nexis Lens                          ║
// ║  Ryan Wetzstein · 2026               ║
// ╚══════════════════════════════════════╝

import { useEffect } from "react";
import { MotionConfig } from "motion/react";
import { ResizeHandles, ThemeProvider } from "@nexis/design";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useKeybindings } from "@/modules/commands/keymap";
import { GestureController } from "@/modules/gestures/GestureController";
import { ArmedRing, GestureHud } from "@/modules/gestures/GestureHud";
import { GestureSimulator } from "@/modules/gestures/GestureSimulator";
import { Overview } from "@/modules/overview/Overview";
import { SettingsDialog } from "@/modules/settings/SettingsDialog";
import { Sidebar } from "@/modules/shell/Sidebar";
import { Stage } from "@/modules/shell/Stage";
import { StatusBar } from "@/modules/shell/StatusBar";
import { TitleBar } from "@/modules/shell/TitleBar";
import { useAppCommands } from "@/modules/shell/useAppCommands";
import { useUi } from "@/modules/shell/uiStore";
import { TabBar } from "@/modules/tabs/TabBar";
import { Welcome } from "@/modules/welcome/Welcome";
import { useWorkspace } from "@/modules/workspace/store";

function Shell() {
  useKeybindings();
  useAppCommands();
  const workspace = useWorkspace((s) => s.workspace);
  const sidebarOpen = useUi((s) => s.sidebarOpen);
  const presenting = useUi((s) => s.presenting);

  // Re-open the last workspace on launch (persisted by the store).
  useEffect(() => {
    const ws = useWorkspace.getState().workspace;
    if (ws) void useWorkspace.getState().open(ws.root);
  }, []);

  return (
    <div className="flex h-full flex-col">
      {!presenting && <TitleBar />}
      <div className="flex min-h-0 flex-1">
        {workspace && sidebarOpen && <Sidebar />}
        <main className="zoom-content relative flex min-w-0 flex-1 flex-col">
          {workspace ? (
            <>
              <TabBar />
              <Stage />
            </>
          ) : (
            <Welcome />
          )}
          <Overview />
          <ArmedRing />
          <GestureHud />
        </main>
      </div>
      {!presenting && <StatusBar />}
      <GestureController />
      <GestureSimulator />
      <SettingsDialog />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultMode="system">
      <MotionConfig reducedMotion="user" transition={{ duration: 0.2 }}>
        <TooltipProvider>
          <Shell />
          <Toaster position="top-right" />
          <ResizeHandles />
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
