// Gesture → command bindings, by context.
//
// The same physical gesture means different things in different places — a
// vertical swipe jumps hunks in a diff but pages through a document — so a
// binding is (gesture, contexts) → command. The table is data so Settings can
// show it and a future editor can let users rebind.
import type { CommandArgs, CommandId } from "@/modules/commands/registry";
import { isMarkdownPath } from "@/lib/path";
import { useTabs } from "@/modules/tabs/store";
import { useUi } from "@/modules/shell/uiStore";
import type { GestureConfig } from "./store";
import type { Direction, GestureEvent, GestureType, Point } from "./types";

export type GestureContext = "overview" | "diff" | "markdown" | "code" | "empty";

export const CONTEXT_LABELS: Record<GestureContext, string> = {
  overview: "Overview",
  diff: "Diff",
  markdown: "Markdown",
  code: "Code",
  empty: "No tab",
};

export function currentContext(): GestureContext {
  if (useUi.getState().overviewOpen) return "overview";
  const { tabs, activeId } = useTabs.getState();
  const tab = tabs.find((t) => t.id === activeId);
  if (!tab) return "empty";
  if (tab.item.kind === "diff") return "diff";
  return isMarkdownPath(tab.item.path) ? "markdown" : "code";
}

type Resolved = { [K in CommandId]: { command: K; args?: CommandArgs[K] } }[CommandId];

export type GestureBinding = {
  /** Display name of the physical gesture. */
  label: string;
  type: GestureType;
  direction?: Direction;
  contexts: GestureContext[];
  resolve: (e: GestureEvent, cfg: GestureConfig) => Resolved;
};

const VIEWS: GestureContext[] = ["diff", "markdown", "code"];

/** Map a point in the camera frame to the window, through the framing box. */
export function frameToViewport(p: Point, cfg: GestureConfig): Point {
  const f = cfg.framing;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return { x: clamp((p.x - f.x) / f.w), y: clamp((p.y - f.y) / f.h) };
}

const swipe = (direction: Direction, contexts: GestureContext[], r: () => Resolved): GestureBinding => ({
  label: `Swipe ${direction}`,
  type: "swipe",
  direction,
  contexts,
  resolve: r,
});

export const GESTURE_BINDINGS: GestureBinding[] = [
  {
    label: "Open palm, move vertically",
    type: "palm-move",
    contexts: VIEWS,
    // Drag-the-page metaphor: raising the hand moves the content up.
    resolve: (e, cfg) => ({
      command: "view.scroll",
      args: { dy: e.type === "palm-move" ? -e.dy * cfg.scrollGain * window.innerHeight : 0 },
    }),
  },
  {
    label: "Pinch in / out",
    type: "pinch",
    contexts: VIEWS,
    resolve: (e, cfg) =>
      e.type === "pinch"
        ? { command: "view.zoom", args: { factor: Math.pow(e.scale, cfg.pinchGain), focus: frameToViewport(e.center, cfg) } }
        : { command: "view.zoom", args: { factor: 1 } },
  },
  swipe("left", ["diff", "markdown", "code", "empty"], () => ({ command: "tabs.next" })),
  swipe("right", ["diff", "markdown", "code", "empty"], () => ({ command: "tabs.prev" })),
  swipe("up", ["diff"], () => ({ command: "diff.nextHunk" })),
  swipe("down", ["diff"], () => ({ command: "diff.prevHunk" })),
  swipe("up", ["markdown", "code"], () => ({ command: "view.scroll", args: { pages: 0.85, smooth: true } })),
  swipe("down", ["markdown", "code"], () => ({ command: "view.scroll", args: { pages: -0.85, smooth: true } })),
  swipe("left", ["overview"], () => ({ command: "overview.move", args: { dx: 1, dy: 0 } })),
  swipe("right", ["overview"], () => ({ command: "overview.move", args: { dx: -1, dy: 0 } })),
  swipe("up", ["overview"], () => ({ command: "overview.move", args: { dx: 0, dy: -1 } })),
  swipe("down", ["overview"], () => ({ command: "overview.move", args: { dx: 0, dy: 1 } })),
  { label: "Closed fist", type: "fist", contexts: ["diff"], resolve: () => ({ command: "diff.toggleLayout" }) },
  { label: "Flat-hand flip", type: "palm-flip", contexts: ["markdown"], resolve: () => ({ command: "markdown.toggleMode" }) },
  {
    label: "Two-hand spread",
    type: "two-hand-spread",
    contexts: ["diff", "markdown", "code", "empty", "overview"],
    resolve: () => ({ command: "overview.toggle" }),
  },
  {
    label: "Point",
    type: "point",
    contexts: ["overview"],
    resolve: (e, cfg) => ({
      command: "overview.pointAt",
      args: e.type === "point" ? frameToViewport(e.at, cfg) : { x: 0.5, y: 0.5 },
    }),
  },
  { label: "Pinch or hold", type: "select", contexts: ["overview"], resolve: () => ({ command: "overview.select" }) },
];

export function resolveGesture(e: GestureEvent, ctx: GestureContext, cfg: GestureConfig): Resolved | null {
  const b = GESTURE_BINDINGS.find(
    (b) =>
      b.type === e.type &&
      b.contexts.includes(ctx) &&
      (b.direction === undefined || (e.type === "swipe" && e.direction === b.direction)),
  );
  return b ? b.resolve(e, cfg) : null;
}
