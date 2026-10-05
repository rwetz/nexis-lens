// The gesture vocabulary — the contract between a recogniser (MediaPipe
// Hands, later) and the rest of the app.
//
// A recogniser's only job is to turn camera frames into these events. It does
// not know about tabs, diffs or zoom: the dispatcher maps events to commands
// using the current context, so recognition and behaviour evolve separately.
//
// All coordinates are normalised to the camera frame, 0..1, already mirrored
// if the user has mirroring on (so "right" is the presenter's right as they
// see themselves).

export type Point = { x: number; y: number };
export type Direction = "left" | "right" | "up" | "down";

type Meta = {
  /** Recogniser confidence, 0..1. Below the configured floor events are dropped. */
  confidence: number;
  /** performance.now() at frame capture — used for latency profiling. */
  timestamp: number;
};

export type GestureEvent = Meta &
  (
    /** Deliberate arming gesture (e.g. open palm held still for `armHoldMs`). */
    | { type: "arm" }
    | { type: "disarm" }
    /** Continuous: open palm moving. Deltas are frame-normalised since the last event. */
    | { type: "palm-move"; dx: number; dy: number }
    /** Continuous: pinch distance ratio since the last event (>1 spreading = zoom in). */
    | { type: "pinch"; scale: number; center: Point }
    /** Discrete: a fast directional flick. `velocity` in frame-widths per second. */
    | { type: "swipe"; direction: Direction; velocity: number }
    /** Discrete: hand closes into a fist. */
    | { type: "fist" }
    /** Discrete: flat hand flips palm ⇄ back. */
    | { type: "palm-flip" }
    /** Discrete: both hands move apart. */
    | { type: "two-hand-spread" }
    /** Continuous: index finger pointing at a location. */
    | { type: "point"; at: Point }
    /** Discrete: pinch-click or dwell on the pointed item. */
    | { type: "select" }
  );

export type GestureType = GestureEvent["type"];

/** Gestures that fire once per motion; subject to the cooldown. */
export const DISCRETE: ReadonlySet<GestureType> = new Set([
  "swipe",
  "fist",
  "palm-flip",
  "two-hand-spread",
  "select",
]);

/** What the recogniser reports about itself every frame (or every N frames). */
export type FrameStats = {
  fps: number;
  /** Capture → event latency for the last processed frame, ms. */
  latencyMs: number;
  hands: number;
  /** Mean landmark confidence of the tracked hands, 0..1. */
  confidence: number;
};

export type TrackingStatus =
  | "off" // gesture mode disabled
  | "unavailable" // no recogniser installed / supported
  | "starting"
  | "tracking"
  | "no-hand"
  | "low-confidence"
  | "error";

/**
 * A source of gesture events. The MediaPipe implementation will live behind
 * this; the simulator implements it too, which is how bindings are exercised
 * before real recognition exists.
 */
export interface GestureSource {
  readonly id: string;
  readonly label: string;
  start(ctx: {
    video: HTMLVideoElement;
    emit: (e: GestureEvent) => void;
    stats: (s: FrameStats) => void;
  }): Promise<void>;
  stop(): void;
}
