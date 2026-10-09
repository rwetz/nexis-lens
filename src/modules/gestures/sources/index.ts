// Gesture recogniser registry. The first registered source that is available
// wins; today that is MediaPipe Hands (./mediapipe.ts → ../recognizer.ts).
//
// The model and WASM files are bundled under public/mediapipe rather than
// fetched from a CDN, so the CSP stays closed and it works offline.
import { useGestures } from "../store";
import type { GestureSource } from "../types";
import { createMediaPipeSource } from "./mediapipe";

const factories: Array<() => GestureSource | null> = [];

export function registerGestureSource(factory: () => GestureSource | null) {
  factories.push(factory);
}

registerGestureSource(() =>
  typeof navigator !== "undefined" && "getUserMedia" in (navigator.mediaDevices ?? {})
    ? createMediaPipeSource(() => useGestures.getState())
    : null,
);

/** The first available recogniser, or null if none is installed. */
export function createGestureSource(): GestureSource | null {
  for (const f of factories) {
    const s = f();
    if (s) return s;
  }
  return null;
}
