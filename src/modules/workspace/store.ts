import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import { ipc, type Change, type Commit, type DirEntry, type RepoInfo, type Workspace } from "@/lib/ipc";

type WorkspaceState = {
  workspace: Workspace | null;
  repo: RepoInfo | null;
  /** Directory listings, keyed by absolute path; loaded lazily as folders expand. */
  dirs: Record<string, DirEntry[] | undefined>;
  expanded: Record<string, boolean>;
  changes: Change[];
  commits: Commit[];
  loading: boolean;
  recent: Workspace[];
  open: (path: string) => Promise<boolean>;
  close: () => void;
  refresh: () => Promise<void>;
  loadDir: (path: string) => Promise<void>;
  toggleDir: (path: string) => void;
  forgetRecent: (root: string) => void;
};

const errText = (e: unknown) => (typeof e === "string" ? e : e instanceof Error ? e.message : String(e));

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspace: null,
      repo: null,
      dirs: {},
      expanded: {},
      changes: [],
      commits: [],
      loading: false,
      recent: [],

      open: async (path) => {
        set({ loading: true });
        try {
          const ws = await ipc.openWorkspace(path);
          set((s) => ({
            workspace: ws,
            repo: null,
            dirs: {},
            expanded: {},
            changes: [],
            commits: [],
            recent: [ws, ...s.recent.filter((r) => r.root !== ws.root)].slice(0, 8),
          }));
          await get().refresh();
          return true;
        } catch (e) {
          toast.error("Could not open folder", { description: errText(e) });
          return false;
        } finally {
          set({ loading: false });
        }
      },

      close: () => set({ workspace: null, repo: null, dirs: {}, expanded: {}, changes: [], commits: [] }),

      refresh: async () => {
        const ws = get().workspace;
        if (!ws) return;
        // Reload the root and every expanded folder so the tree keeps its shape.
        const toReload = [ws.root, ...Object.keys(get().expanded).filter((p) => get().expanded[p])];
        const [repo] = await Promise.all([
          ipc.repoInfo(ws.root).catch(() => null),
          ...toReload.map((p) => get().loadDir(p)),
        ]);
        set({ repo });
        if (!repo) {
          set({ changes: [], commits: [] });
          return;
        }
        const [changes, commits] = await Promise.all([
          ipc.changes(repo.root).catch((e) => {
            toast.error("git status failed", { description: errText(e) });
            return [] as Change[];
          }),
          ipc.log(repo.root, 60).catch(() => [] as Commit[]),
        ]);
        set({ changes, commits });
      },

      loadDir: async (path) => {
        try {
          const entries = await ipc.listDir(path);
          set((s) => ({ dirs: { ...s.dirs, [path]: entries } }));
        } catch (e) {
          set((s) => ({ dirs: { ...s.dirs, [path]: [] } }));
          toast.error("Could not read folder", { description: errText(e) });
        }
      },

      toggleDir: (path) => {
        const open = !get().expanded[path];
        set((s) => ({ expanded: { ...s.expanded, [path]: open } }));
        if (open && !get().dirs[path]) void get().loadDir(path);
      },

      forgetRecent: (root) => set((s) => ({ recent: s.recent.filter((r) => r.root !== root) })),
    }),
    {
      name: "lens-workspace",
      partialize: (s) => ({ recent: s.recent, workspace: s.workspace }),
    },
  ),
);

/** Group porcelain status into the two lists the Changes panel shows. */
export function splitChanges(changes: Change[]) {
  const staged = changes.filter((c) => c.index !== " " && c.index !== "?");
  const unstaged = changes.filter((c) => c.worktree !== " ");
  return { staged, unstaged };
}
