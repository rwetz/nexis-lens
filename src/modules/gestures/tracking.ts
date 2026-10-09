// Per-frame tracking data for visualisation (the on-screen tracking overlay).
// A plain pub-sub rather than store state: it changes 30+ times a second and
// is drawn straight to a canvas, so it should never trigger React renders.
import type { PipelineFrame } from "./sources/mediapipe";

type Listener = (f: PipelineFrame | null) => void;
const listeners = new Set<Listener>();

export function publishTrackingFrame(f: PipelineFrame | null) {
  for (const l of listeners) l(f);
}

export function subscribeTrackingFrames(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
