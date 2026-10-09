import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SidebarTab = "files" | "changes";
export type SettingsSection = "appearance" | "viewer" | "gestures" | "camera" | "lab" | "shortcuts";

type UiState = {
  sidebarOpen: boolean;
  sidebarTab: SidebarTab;
  sidebarWidth: number;
  overviewOpen: boolean;
  settingsOpen: boolean;
  settingsSection: SettingsSection;
  /** Fullscreen, sidebar hidden — the stand-up-and-present layout. */
  presenting: boolean;
  setSidebarOpen: (v: boolean) => void;
  setSidebarTab: (t: SidebarTab) => void;
  setSidebarWidth: (w: number) => void;
  setOverviewOpen: (v: boolean) => void;
  openSettings: (section?: SettingsSection) => void;
  setSettingsOpen: (v: boolean) => void;
  setSettingsSection: (s: SettingsSection) => void;
  setPresenting: (v: boolean) => void;
};

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidebarTab: "files",
      sidebarWidth: 264,
      overviewOpen: false,
      settingsOpen: false,
      settingsSection: "appearance",
      presenting: false,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setSidebarTab: (sidebarTab) => set({ sidebarTab, sidebarOpen: true }),
      setSidebarWidth: (w) => set({ sidebarWidth: Math.round(Math.min(560, Math.max(180, w))) }),
      setOverviewOpen: (overviewOpen) => set({ overviewOpen }),
      openSettings: (section) =>
        set((s) => ({ settingsOpen: true, settingsSection: section ?? s.settingsSection, overviewOpen: false })),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setSettingsSection: (settingsSection) => set({ settingsSection }),
      setPresenting: (presenting) => set({ presenting }),
    }),
    {
      name: "lens-ui",
      partialize: (s) => ({ sidebarOpen: s.sidebarOpen, sidebarTab: s.sidebarTab, sidebarWidth: s.sidebarWidth }),
    },
  ),
);
