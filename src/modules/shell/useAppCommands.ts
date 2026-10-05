// App-level command handlers — the ones not owned by a specific view.
import { getCurrentWindow } from "@tauri-apps/api/window";
import { IN_TAURI, pickFolder } from "@/lib/ipc";
import { useCommand } from "@/modules/commands/useCommand";
import { useTabs } from "@/modules/tabs/store";
import { invalidateContent } from "@/modules/viewer/content";
import { useWorkspace } from "@/modules/workspace/store";
import { useUi } from "./uiStore";

export async function openFolderFlow(path?: string) {
  const picked = path ?? (await pickFolder());
  if (!picked) return;
  const prev = useWorkspace.getState().workspace?.root;
  const ok = await useWorkspace.getState().open(picked);
  if (ok && prev !== useWorkspace.getState().workspace?.root) useTabs.getState().closeAll();
}

let sidebarBeforePresenting = true;

export function useAppCommands() {
  useCommand("workspace.openFolder", () => void openFolderFlow());
  useCommand("workspace.refresh", () => {
    invalidateContent();
    void useWorkspace.getState().refresh();
  });
  useCommand("sidebar.toggle", () => {
    const ui = useUi.getState();
    ui.setSidebarOpen(!ui.sidebarOpen);
  });
  useCommand("settings.open", () => useUi.getState().openSettings());
  useCommand("present.toggle", () => {
    const ui = useUi.getState();
    const next = !ui.presenting;
    if (next) {
      sidebarBeforePresenting = ui.sidebarOpen;
      ui.setSidebarOpen(false);
    } else {
      ui.setSidebarOpen(sidebarBeforePresenting);
    }
    ui.setPresenting(next);
    if (IN_TAURI) void getCurrentWindow().setFullscreen(next);
    else if (next) void document.documentElement.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) void document.exitFullscreen();
  });
}
