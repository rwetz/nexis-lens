// Viewer preferences (keyboard/mouse-only to change, by design).
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DiffLayout = "unified" | "split";
export type MarkdownMode = "preview" | "raw";

type ViewerSettings = {
  /** Base code font size in px before per-tab zoom. */
  fontSize: number;
  lineWrap: boolean;
  lineNumbers: boolean;
  defaultDiffLayout: DiffLayout;
  defaultMarkdownMode: MarkdownMode;
  /** Context lines around each diff hunk. */
  diffContext: number;
  /** Smooth-scroll keyboard / gesture jumps (hunks, pages). */
  smoothScroll: boolean;
  set: (patch: Partial<Omit<ViewerSettings, "set">>) => void;
};

export const useSettings = create<ViewerSettings>()(
  persist(
    (set) => ({
      fontSize: 14,
      lineWrap: false,
      lineNumbers: true,
      defaultDiffLayout: "unified",
      defaultMarkdownMode: "preview",
      diffContext: 3,
      smoothScroll: true,
      set: (patch) => set(patch),
    }),
    { name: "lens-settings", version: 1 },
  ),
);
