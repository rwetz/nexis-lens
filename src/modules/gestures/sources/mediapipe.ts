// MediaPipe HandLandmarker → GestureRecognizer, on-device.
//
// `HandPipeline` is the frame loop: it runs the landmarker on every new camera
// frame (requestVideoFrameCallback), feeds the recogniser, and reports timing.
// The live gesture source and the Gesture lab benchmark both drive it.
//
// The WASM runtime and the model are served from public/mediapipe (copied by
// scripts/sync-mediapipe.mjs), never from a CDN.
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { useGestures, type GestureConfig } from "../store";
import { GestureRecognizer, type HandInput, type TrackedHand } from "../recognizer";
import { publishTrackingFrame } from "../tracking";
import type { GestureEvent, GestureSource } from "../types";

export type Delegate = "GPU" | "CPU";

const BASE = `${import.meta.env.BASE_URL}mediapipe`;

type Loaded = { landmarker: HandLandmarker; delegate: Delegate; loadMs: number };
const cache = new Map<Delegate, Promise<Loaded>>();

/** Load (once per delegate) the hand landmarker. GPU falls back to CPU. */
export function loadHandLandmarker(delegate: Delegate): Promise<Loaded> {
  let p = cache.get(delegate);
  if (!p) {
    p = (async () => {
      const t0 = performance.now();
      const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(`${BASE}/wasm`);
      const create = (d: Delegate) =>
        HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: `${BASE}/hand_landmarker.task`, delegate: d },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      let landmarker: HandLandmarker;
      let used = delegate;
      try {
        landmarker = await create(delegate);
      } catch (e) {
        if (delegate === "CPU") throw e;
        console.warn("Hand tracking: GPU delegate unavailable, using CPU", e);
        landmarker = await create("CPU");
        used = "CPU";
      }
      // The first GPU inference compiles shaders (seconds); pay it here so it
      // counts as load time instead of stalling the first camera frame.
      const blank = document.createElement("canvas");
      blank.width = 64;
      blank.height = 64;
      landmarker.detectForVideo(blank, 1);
      return { landmarker, delegate: used, loadMs: performance.now() - t0 };
    })();
    p.catch(() => cache.delete(delegate));
    cache.set(delegate, p);
  }
  return p;
}

/** Everything known about one processed camera frame. */
export type PipelineFrame = {
  /** Frame capture time (performance.now() clock). */
  t: number;
  width: number;
  height: number;
  hands: TrackedHand[];
  events: GestureEvent[];
  /** Time spent inside detectForVideo. */
  inferenceMs: number;
  /** Capture → recogniser output. */
  latencyMs: number;
  /** Camera frames that arrived while this one was processing and were skipped. */
  dropped: number;
};

type Handlers = { onFrame: (f: PipelineFrame) => void };

export class HandPipeline {
  private recognizer = new GestureRecognizer();
  private handle = 0;
  private live = false;
  private video: HTMLVideoElement | null = null;
  private lastTs = 0;
  private lastPresented: number | null = null;
  loaded: Loaded | null = null;

  async start(video: HTMLVideoElement, delegate: Delegate, handlers: Handlers): Promise<Loaded> {
    this.stop();
    this.live = true;
    this.video = video;
    this.recognizer.reset();
    this.lastPresented = null;
    const loaded = await loadHandLandmarker(delegate);
    this.loaded = loaded;
    if (!this.live) return loaded;

    const tick = (now: number, meta?: VideoFrameCallbackMetadata) => {
      if (!this.live) return;
      this.process(loaded.landmarker, video, now, meta, handlers);
      this.schedule(video, tick);
    };
    this.schedule(video, tick);
    return loaded;
  }

  stop() {
    this.live = false;
    const v = this.video;
    if (v && this.handle) {
      if ("cancelVideoFrameCallback" in v) v.cancelVideoFrameCallback(this.handle);
      else cancelAnimationFrame(this.handle);
    }
    this.handle = 0;
    this.video = null;
  }

  private schedule(video: HTMLVideoElement, tick: (now: number, meta?: VideoFrameCallbackMetadata) => void) {
    this.handle =
      "requestVideoFrameCallback" in video
        ? video.requestVideoFrameCallback(tick)
        : requestAnimationFrame((now) => tick(now));
  }

  private process(
    landmarker: HandLandmarker,
    video: HTMLVideoElement,
    now: number,
    meta: VideoFrameCallbackMetadata | undefined,
    { onFrame }: Handlers,
  ) {
    if (!video.videoWidth) return;
    const capture = meta?.captureTime ?? meta?.presentationTime ?? now;
    let dropped = 0;
    if (meta) {
      if (this.lastPresented !== null) dropped = Math.max(0, meta.presentedFrames - this.lastPresented - 1);
      this.lastPresented = meta.presentedFrames;
    }

    // detectForVideo needs strictly increasing timestamps.
    const ts = Math.max(this.lastTs + 1, Math.round(now));
    this.lastTs = ts;
    const t0 = performance.now();
    const result = landmarker.detectForVideo(video, ts);
    const inferenceMs = performance.now() - t0;

    const cfg = useGestures.getState();
    const input: HandInput[] = result.landmarks.map((landmarks, i) => ({
      landmarks,
      handedness: result.handedness[i]?.[0]?.categoryName ?? "Hand",
      score: result.handedness[i]?.[0]?.score ?? 0,
    }));
    const { hands, events } = this.recognizer.update(input, capture, {
      mirror: cfg.mirror,
      framing: cfg.framing,
      armHoldMs: cfg.armHoldMs,
      aspect: video.videoWidth / video.videoHeight,
    });

    onFrame({
      t: capture,
      width: video.videoWidth,
      height: video.videoHeight,
      hands,
      events,
      inferenceMs,
      latencyMs: performance.now() - capture,
      dropped,
    });
  }
}

/** The live gesture source used by gesture mode. */
export function createMediaPipeSource(config: () => Pick<GestureConfig, "delegate">): GestureSource {
  const pipeline = new HandPipeline();
  const stamps: number[] = [];
  return {
    id: "mediapipe-hands",
    label: "MediaPipe Hands",
    async start({ video, emit, stats }) {
      await pipeline.start(video, config().delegate, {
        onFrame: (f) => {
          for (const e of f.events) emit(e);
          stamps.push(f.t);
          while (stamps.length && f.t - stamps[0] > 1000) stamps.shift();
          stats({
            fps: stamps.length,
            latencyMs: f.latencyMs,
            hands: f.hands.length,
            confidence: f.hands.length ? f.hands.reduce((s, h) => s + h.score, 0) / f.hands.length : 0,
          });
          publishTrackingFrame(f);
        },
      });
    },
    stop() {
      pipeline.stop();
      publishTrackingFrame(null);
    },
  };
}
