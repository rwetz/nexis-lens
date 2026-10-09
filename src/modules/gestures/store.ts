// Gesture configuration (persisted) and live runtime state.
//
// Configuration is changed only from Settings — calibration is a setup step,
// keyboard/mouse by design. Runtime state is written by the dispatcher and
// the controller and read by the HUD and status bar.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CommandId } from "@/modules/commands/registry";
import type { FrameStats, GestureType, TrackingStatus } from "./types";

export type GestureConfig = {
  enabled: boolean;
  /** Require a deliberate arming gesture before command gestures act. */
  requireArming: boolean;
  /** How long the arming pose must be held (read by the recogniser). */
  armHoldMs: number;
  /** Disarm after this long without an accepted gesture. */
  disarmAfterMs: number;
  /** Events below this confidence are ignored. */
  minConfidence: number;
  /** Minimum gap between two discrete gestures. */
  cooldownMs: number;
  /** Palm-move scroll gain: viewport heights per full frame of hand travel. */
  scrollGain: number;
  /** Pinch zoom exponent; >1 exaggerates, <1 dampens. */
  pinchGain: number;
  /** Swipes slower than this (frame-widths / s) are treated as normal movement. */
  swipeMinVelocity: number;
  cameraId: string | null;
  mirror: boolean;
  resolution: "480p" | "720p";
  /** 30 is the floor on target hardware; 45 is the stretch goal. */
  targetFps: 30 | 45;
  /** Region of the camera frame the hand is tracked in (normalised). */
  framing: { x: number; y: number; w: number; h: number };
  showHud: boolean;
  showSimulator: boolean;
  /** Developer: draw tracked hands over the app while gesture mode is on. */
  showTrackingOverlay: boolean;
  /** Where hand-tracking inference runs. GPU falls back to CPU if unavailable. */
  delegate: "GPU" | "CPU";
};

export type GestureFeedback = {
  key: number;
  gesture: GestureType;
  command: CommandId | null;
  /** Why nothing happened, when nothing did. */
  note?: string;
};

type GestureRuntime = {
  status: TrackingStatus;
  statusDetail?: string;
  armed: boolean;
  stats: FrameStats | null;
  feedback: GestureFeedback | null;
  /** The Gesture lab owns the camera; live gesture mode pauses meanwhile. */
  labActive: boolean;
};

type GestureState = GestureConfig &
  GestureRuntime & {
    setConfig: (patch: Partial<GestureConfig>) => void;
    resetConfig: () => void;
    setRuntime: (patch: Partial<GestureRuntime>) => void;
  };

export const DEFAULT_GESTURE_CONFIG: GestureConfig = {
  enabled: false,
  requireArming: true,
  armHoldMs: 600,
  disarmAfterMs: 4000,
  minConfidence: 0.6,
  cooldownMs: 450,
  scrollGain: 1.4,
  pinchGain: 1,
  swipeMinVelocity: 1.2,
  cameraId: null,
  mirror: true,
  resolution: "480p",
  targetFps: 30,
  framing: { x: 0.1, y: 0.05, w: 0.8, h: 0.9 },
  showHud: true,
  showSimulator: false,
  showTrackingOverlay: false,
  delegate: "GPU",
};

export const useGestures = create<GestureState>()(
  persist(
    (set) => ({
      ...DEFAULT_GESTURE_CONFIG,
      status: "off",
      armed: false,
      stats: null,
      feedback: null,
      labActive: false,
      setConfig: (patch) => set(patch),
      resetConfig: () => set(DEFAULT_GESTURE_CONFIG),
      setRuntime: (patch) => set(patch),
    }),
    {
      name: "lens-gestures",
      version: 1,
      partialize: (s) => {
        const { status: _s, statusDetail: _d, armed: _a, stats: _t, feedback: _f, labActive: _l, setConfig: _1, resetConfig: _2, setRuntime: _3, ...config } = s;
        return config;
      },
    },
  ),
);
