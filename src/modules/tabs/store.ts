// Open items. A tab is either a file or a diff; each carries its own view
// state (zoom, scroll, layout) so flipping between tabs mid-presentation —
// by keyboard or swipe — lands exactly where you left off.
import { create } from "zustand";
import { basename } from "@/lib/path";
import { useSettings, type DiffLayout, type MarkdownMode } from "@/modules/settings/store";

export type DiffSource =
  | {
      type: "worktree";
      root: string;
      /** Repo-relative path; omit for every change in the working tree. */
      path?: string;
      staged?: boolean;
      untracked?: boolean;
    }
  | { type: "commit"; root: string; sha: string; short: string; subject: string };

export type TabItem = { kind: "file"; path: string } | { kind: "diff"; source: DiffSource };

export type TabView = {
  zoom: number;
  scrollTop: number;
  markdownMode: MarkdownMode;
  diffLayout: DiffLayout;
  hunkIndex: number;
};

export type Tab = {
  id: string;
  title: string;
  subtitle?: string;
  item: TabItem;
  view: TabView;
};

export function tabKey(item: TabItem): string {
  if (item.kind === "file") return `file:${item.path}`;
  const s = item.source;
  if (s.type === "commit") return `commit:${s.root}:${s.sha}`;
  return `diff:${s.root}:${s.path ?? "*"}:${s.staged ? "staged" : "work"}`;
}

function describe(item: TabItem): { title: string; subtitle?: string } {
  if (item.kind === "file") return { title: basename(item.path), subtitle: item.path };
  const s = item.source;
  if (s.type === "commit") return { title: s.short, subtitle: s.subject };
  if (!s.path) return { title: s.staged ? "Staged changes" : "Working changes", subtitle: s.root };
  return { title: `Δ ${basename(s.path)}`, subtitle: `${s.staged ? "staged · " : ""}${s.path}` };
}

type TabsState = {
  tabs: Tab[];
  activeId: string | null;
  open: (item: TabItem, opts?: { background?: boolean }) => string;
  close: (id: string) => void;
  closeAll: () => void;
  activate: (id: string) => void;
  cycle: (delta: number) => void;
  move: (from: number, to: number) => void;
  updateView: (id: string, patch: Partial<TabView>) => void;
};

export const useTabs = create<TabsState>()((set, get) => ({
  tabs: [],
  activeId: null,

  open: (item, opts) => {
    const id = tabKey(item);
    if (!get().tabs.some((t) => t.id === id)) {
      const s = useSettings.getState();
      const tab: Tab = {
        id,
        item,
        ...describe(item),
        view: {
          zoom: 1,
          scrollTop: 0,
          markdownMode: s.defaultMarkdownMode,
          diffLayout: s.defaultDiffLayout,
          hunkIndex: -1,
        },
      };
      // Insert next to the active tab, like a browser.
      set((st) => {
        const at = st.tabs.findIndex((t) => t.id === st.activeId);
        const tabs = [...st.tabs];
        tabs.splice(at < 0 ? tabs.length : at + 1, 0, tab);
        return { tabs };
      });
    }
    if (!opts?.background) set({ activeId: id });
    return id;
  },

  close: (id) =>
    set((st) => {
      const i = st.tabs.findIndex((t) => t.id === id);
      if (i < 0) return st;
      const tabs = st.tabs.filter((t) => t.id !== id);
      const activeId =
        st.activeId === id ? (tabs[Math.min(i, tabs.length - 1)]?.id ?? null) : st.activeId;
      return { tabs, activeId };
    }),

  closeAll: () => set({ tabs: [], activeId: null }),

  activate: (id) => set({ activeId: id }),

  cycle: (delta) => {
    const { tabs, activeId } = get();
    if (tabs.length < 2) return;
    const i = tabs.findIndex((t) => t.id === activeId);
    set({ activeId: tabs[(i + delta + tabs.length) % tabs.length].id });
  },

  move: (from, to) =>
    set((st) => {
      const tabs = [...st.tabs];
      const [t] = tabs.splice(from, 1);
      tabs.splice(to, 0, t);
      return { tabs };
    }),

  updateView: (id, patch) =>
    set((st) => ({
      tabs: st.tabs.map((t) => (t.id === id ? { ...t, view: { ...t.view, ...patch } } : t)),
    })),
}));

export const useActiveTab = () => useTabs((s) => s.tabs.find((t) => t.id === s.activeId) ?? null);
