// A tiny async resource cache for file contents and diff text. Tabs remount
// their viewer on switch, so content must outlive the component; the overview
// also peeks at it synchronously to draw previews.
import { useEffect, useSyncExternalStore } from "react";
import { ipc, type FileContent } from "@/lib/ipc";
import type { DiffSource } from "@/modules/tabs/store";

export type Resource<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; error: string };

const cache = new Map<string, Resource<unknown>>();
const inflight = new Set<string>();
const subs = new Set<() => void>();
let version = 0;

function emit() {
  version++;
  subs.forEach((s) => s());
}

function subscribe(cb: () => void) {
  subs.add(cb);
  return () => subs.delete(cb);
}

function load<T>(key: string, loader: () => Promise<T>) {
  if (cache.has(key) || inflight.has(key)) return;
  inflight.add(key);
  cache.set(key, { status: "loading" });
  loader()
    .then((data) => cache.set(key, { status: "ready", data }))
    .catch((e) => cache.set(key, { status: "error", error: typeof e === "string" ? e : String(e?.message ?? e) }))
    .finally(() => {
      inflight.delete(key);
      emit();
    });
}

function useResource<T>(key: string | null, loader: () => Promise<T>): Resource<T> {
  useSyncExternalStore(subscribe, () => version);
  useEffect(() => {
    if (key) load(key, loader);
    // loader is derived from key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);
  if (!key) return { status: "loading" };
  return (cache.get(key) as Resource<T> | undefined) ?? { status: "loading" };
}

export function peek<T>(key: string): T | undefined {
  const r = cache.get(key);
  return r?.status === "ready" ? (r.data as T) : undefined;
}

/** Drop everything; mounted viewers refetch. Called on workspace refresh. */
export function invalidateContent() {
  cache.clear();
  emit();
}

export const fileKey = (path: string) => `file:${path}`;

export function useFile(path: string): Resource<FileContent> {
  return useResource(fileKey(path), () => ipc.readTextFile(path));
}

export function diffKey(source: DiffSource, context: number): string {
  return source.type === "commit"
    ? `show:${source.root}:${source.sha}:${context}`
    : `diff:${source.root}:${source.path ?? "*"}:${source.staged ? 1 : 0}:${source.untracked ? 1 : 0}:${context}`;
}

export function useDiffText(source: DiffSource, context: number): Resource<string> {
  return useResource(diffKey(source, context), () =>
    source.type === "commit"
      ? ipc.show(source.root, source.sha, context)
      : ipc.diff({
          root: source.root,
          path: source.path,
          staged: source.staged,
          untracked: source.untracked,
          context,
        }),
  );
}
