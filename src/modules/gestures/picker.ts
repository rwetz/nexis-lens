// Gesture File mode: while the open file has the gestures, nothing can change
// files. Showing both palms hands the gestures to the sidebar instead, where a
// pinch-drag moves a highlight and a grab opens the highlighted row.
//
// The list is whatever the sidebar shows: rows marked `data-pick`. "item" rows
// open something (a file, a diff, a commit) and end File mode; "nav" rows
// (folders, the Files / Changes tabs) only change the list, so File mode stays.
import { useUi } from "@/modules/shell/uiStore";
import { useTabs } from "@/modules/tabs/store";
import { useGestures } from "./store";

/** Hand travel, in framing-box heights, that moves the highlight one row. */
const STEP = 0.07;

let index = 0;
let travel = 0;
let returnTo: string | null = null;

function rows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("aside [data-pick]")];
}

function mark() {
  const list = rows();
  index = Math.max(0, Math.min(index, list.length - 1));
  list.forEach((el, i) => el.toggleAttribute("data-picked", i === index));
  list[index]?.scrollIntoView({ block: "nearest" });
}

export function openFileMode() {
  useUi.getState().setSidebarOpen(true);
  returnTo = useTabs.getState().activeId;
  useGestures.getState().setRuntime({ mode: "files" });
  travel = 0;
  // Wait for React to commit, so an opening sidebar has rows to find.
  setTimeout(() => {
    const list = rows();
    const active = list.findIndex((el) => el.dataset.pickActive !== undefined);
    index = Math.max(0, active);
    mark();
  });
}

export function closeFileMode() {
  useGestures.getState().setRuntime({ mode: "focus" });
  rows().forEach((el) => el.removeAttribute("data-picked"));
  travel = 0;
}

/** Move by whole rows, or accumulate hand travel (down = later rows). */
export function moveHighlight({ steps, dy }: { steps?: number; dy?: number }) {
  let n = steps ?? 0;
  if (dy) {
    travel += dy;
    n += Math.trunc(travel / STEP);
    travel %= STEP;
  }
  if (n === 0) return;
  index += n;
  mark();
}

export function chooseHighlighted() {
  const el = rows()[index];
  if (!el) return;
  const nav = el.dataset.pick === "nav";
  el.click();
  if (nav) setTimeout(mark);
  else closeFileMode();
}

export function cancelFileMode() {
  const tabs = useTabs.getState();
  if (returnTo && tabs.tabs.some((t) => t.id === returnTo)) tabs.activate(returnTo);
  closeFileMode();
}
