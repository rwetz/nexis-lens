// Gesture feedback the audience (and presenter) can read from a distance:
// a large transient chip naming the gesture and what it did, plus the
// armed ring around the stage and a compact status readout for the status bar.
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Camera01Icon,
  CameraOff01Icon,
  Hold04Icon,
  Alert02Icon,
} from "@hugeicons/core-free-icons";
import { spring } from "@nexis/design";
import { cn } from "@/lib/utils";
import { COMMAND_TITLES } from "@/modules/commands/registry";
import { useUi } from "@/modules/shell/uiStore";
import { useGestures } from "./store";
import type { GestureType, TrackingStatus } from "./types";

export const GESTURE_LABELS: Record<GestureType, string> = {
  arm: "Arm",
  disarm: "Disarm",
  "palm-move": "Palm",
  pinch: "Pinch",
  swipe: "Swipe",
  fist: "Fist",
  "palm-flip": "Flip",
  "two-hand-spread": "Spread",
  point: "Point",
  select: "Select",
};

const STATUS_TEXT: Record<TrackingStatus, string> = {
  off: "Gestures off",
  unavailable: "No recogniser",
  starting: "Starting camera…",
  tracking: "Tracking",
  "no-hand": "No hand in frame",
  "low-confidence": "Low confidence",
  error: "Camera error",
};

export function GestureHud() {
  const feedback = useGestures((s) => s.feedback);
  const enabled = useGestures((s) => s.enabled);
  const showHud = useGestures((s) => s.showHud);
  const status = useGestures((s) => s.status);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!feedback) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1300);
    return () => clearTimeout(t);
  }, [feedback]);

  const lowLight = enabled && (status === "low-confidence" || status === "no-hand");

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-8 z-40 flex flex-col items-center gap-2">
      <AnimatePresence>
        {enabled && showHud && visible && feedback && (
          <motion.div
            key={feedback.key}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={spring.snappy}
            className={cn(
              "flex items-center gap-3 rounded-2xl border border-border/70 bg-popover/90 px-4 py-2.5 text-popover-foreground shadow-lg backdrop-blur",
              feedback.command && "brand-glow",
            )}
          >
            <span className="rounded-lg bg-muted px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {GESTURE_LABELS[feedback.gesture]}
            </span>
            <span className="text-base font-medium">
              {feedback.command ? COMMAND_TITLES[feedback.command] : feedback.note}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {lowLight && showHud && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-full border border-border/70 bg-popover/90 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur"
          >
            <HugeiconsIcon icon={Alert02Icon} size={13} />
            {status === "no-hand"
              ? "Hand not in frame — keyboard and mouse still work"
              : "Tracking is unsure — try more light or step closer"}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Brand ring around the stage while armed. */
export function ArmedRing() {
  const on = useGestures((s) => s.enabled && s.requireArming && s.armed);
  return (
    <AnimatePresence>
      {on && (
        <motion.div
          className="lens-armed-ring"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        />
      )}
    </AnimatePresence>
  );
}

/** Compact status readout for the status bar. Click opens gesture settings. */
export function GestureStatus() {
  const enabled = useGestures((s) => s.enabled);
  const status = useGestures((s) => s.status);
  const armed = useGestures((s) => s.armed);
  const requireArming = useGestures((s) => s.requireArming);
  const fps = useGestures((s) => s.stats?.fps);
  const detail = useGestures((s) => s.statusDetail);
  const openSettings = useUi((s) => s.openSettings);

  const dot =
    !enabled ? "bg-muted-foreground/40"
    : status === "tracking" ? "bg-emerald-500"
    : status === "error" ? "bg-destructive"
    : "bg-amber-500";

  return (
    <button
      type="button"
      title={detail ?? STATUS_TEXT[status]}
      onClick={() => openSettings("gestures")}
      className="flex h-full items-center gap-1.5 px-2 hover:bg-accent hover:text-foreground"
    >
      <HugeiconsIcon icon={enabled ? Camera01Icon : CameraOff01Icon} size={12} />
      <span className={cn("size-1.5 rounded-full", dot)} />
      <span>{STATUS_TEXT[status]}</span>
      {enabled && requireArming && armed && (
        <span className="flex items-center gap-1 text-brand">
          <HugeiconsIcon icon={Hold04Icon} size={12} />
          Armed
        </span>
      )}
      {enabled && fps !== undefined && <span className="font-mono tabular-nums">{Math.round(fps)} fps</span>}
    </button>
  );
}
