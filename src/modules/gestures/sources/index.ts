// Gesture recogniser registry.
//
// Nothing is registered yet: hand tracking is the next milestone. To add it,
// implement `GestureSource` (../types.ts) — the planned implementation is
// MediaPipe Hands via `@mediapipe/tasks-vision` (HandLandmarker or
// GestureRecognizer, running on-device with the WASM + GPU delegate):
//
//   1. In `start`, load the model, then run a `requestVideoFrameCallback`
//      loop over `ctx.video`, calling `detectForVideo(video, now)`.
//   2. Crop/normalise landmarks to the configured framing box and mirror x
//      when `mirror` is on, so emitted coordinates match ../types.ts.
//   3. Classify poses per frame and track them over time:
//        - open palm held still ≥ armHoldMs → `arm`
//        - open palm moving → `palm-move` (smoothed dx/dy)
//        - thumb–index distance ratio → `pinch` / `select`
//        - wrist velocity over a short window ≥ swipeMinVelocity → `swipe`
//        - fist, palm↔back flip, two hands diverging → discrete events
//   4. Report `stats` (fps, latency, hand count, confidence) every frame so
//      the HUD and the 30 fps floor can be profiled from day one.
//
// The model and WASM files should be bundled under public/ rather than
// fetched from a CDN, so the CSP stays closed and it works offline.
import type { GestureSource } from "../types";

const factories: Array<() => GestureSource | null> = [];

export function registerGestureSource(factory: () => GestureSource | null) {
  factories.push(factory);
}

/** The first available recogniser, or null if none is installed. */
export function createGestureSource(): GestureSource | null {
  for (const f of factories) {
    const s = f();
    if (s) return s;
  }
  return null;
}
