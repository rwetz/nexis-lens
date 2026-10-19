// Gesture → command bindings, by context.
//
// Gestures are locked to one target at a time. In Focus mode they act only on
// the open file (scroll, zoom, and Raw / Preview in markdown), so no gesture
// can change files by accident. Showing both palms switches to File mode,
// where they act only on the sidebar list (./picker.ts). A binding is
// (gesture, contexts) → command; the table is data so Settings can show it.
import type { CommandArgs, CommandId } from "@/modules/commands/registry";
import { isMarkdownPath } from "@/lib/path";
import { useTabs } from "@/modules/tabs/store";
import { useUi } from "@/modules/shell/uiStore";
import { useGestures, type GestureConfig } from "./store";
import type { GestureEvent, GestureType, Point } from "./types";

export type GestureContext = "files" | "diff" | "markdown" | "code" | "empty";

export const CONTEXT_LABELS: Record<GestureContext, string> = {
  files: "File mode",
  diff: "Diff",
  markdown: "Markdown",
  code: "Code",
  empty: "No tab",
};

/** Overview and other overlays take no gestures: they return null. */
export function currentContext(): GestureContext | null {
  if (useGestures.getState().mode === "files") return "files";
  if (useUi.getState().overviewOpen) return null;
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

export const GESTURE_BINDINGS: GestureBinding[] = [
  {
    label: "Pinch and drag",
    type: "pinch-drag",
    contexts: VIEWS,
    // Drag-the-page metaphor: raising the hand moves the content up.
    resolve: (e, cfg) => ({
      command: "view.scroll",
      args: { dy: e.type === "pinch-drag" ? -e.dy * cfg.scrollGain * window.innerHeight : 0 },
    }),
  },
  {
    label: "Pinch with both hands, pull apart / together",
    type: "two-hand-pinch",
    contexts: VIEWS,
    resolve: (e, cfg) =>
      e.type === "two-hand-pinch"
        ? { command: "view.zoom", args: { factor: Math.pow(e.scale, cfg.pinchGain), focus: frameToViewport(e.center, cfg) } }
        : { command: "view.zoom", args: { factor: 1 } },
  },
  { label: "Turn the hand over", type: "palm-flip", contexts: ["markdown"], resolve: () => ({ command: "markdown.toggleMode" }) },
  { label: "Show both palms", type: "both-palms", contexts: [...VIEWS, "empty"], resolve: () => ({ command: "picker.open" }) },
  {
    label: "Pinch and drag",
    type: "pinch-drag",
    contexts: ["files"],
    resolve: (e) => ({ command: "picker.move", args: { dy: e.type === "pinch-drag" ? e.dy : 0 } }),
  },
  { label: "Open hand, then close it", type: "grab", contexts: ["files"], resolve: () => ({ command: "picker.choose" }) },
  { label: "Show both palms", type: "both-palms", contexts: ["files"], resolve: () => ({ command: "picker.cancel" }) },
];

export function resolveGesture(e: GestureEvent, ctx: GestureContext | null, cfg: GestureConfig): Resolved | null {
  if (!ctx) return null;
  const b = GESTURE_BINDINGS.find((b) => b.type === e.type && b.contexts.includes(ctx));
  return b ? b.resolve(e, cfg) : null;
}
