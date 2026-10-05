// The gesture dispatcher: filters raw recogniser events (confidence floor,
// arming gate, cooldown, swipe velocity), resolves them against the current
// context and runs the resulting command on the bus.
//
// The filtering here is the software half of "intentional gesture vs. a
// presenter talking with their hands"; the recogniser's hold-duration check
// on the arming pose is the other half.
import { runCommand, type CommandId } from "@/modules/commands/registry";
import { useUi } from "@/modules/shell/uiStore";
import { currentContext, resolveGesture } from "./bindings";
import { useGestures } from "./store";
import { DISCRETE, type GestureEvent, type GestureType } from "./types";

let lastDiscreteAt = -Infinity;
let lastContinuousFeedbackAt = -Infinity;
let disarmTimer: ReturnType<typeof setTimeout> | undefined;
let feedbackKey = 0;

const CONTINUOUS_FEEDBACK_MS = 600;

function feedback(gesture: GestureType, command: CommandId | null, note?: string) {
  useGestures.getState().setRuntime({ feedback: { key: ++feedbackKey, gesture, command, note } });
}

function scheduleDisarm() {
  clearTimeout(disarmTimer);
  const { requireArming, disarmAfterMs } = useGestures.getState();
  if (!requireArming) return;
  disarmTimer = setTimeout(() => setArmed(false), disarmAfterMs);
}

export function setArmed(armed: boolean) {
  useGestures.getState().setRuntime({ armed });
  if (armed) scheduleDisarm();
  else clearTimeout(disarmTimer);
}

export function dispatchGesture(e: GestureEvent): void {
  const st = useGestures.getState();
  if (!st.enabled) return;

  const discrete = DISCRETE.has(e.type);

  // Calibration and settings are deliberately keyboard/mouse-only.
  if (useUi.getState().settingsOpen) return;

  if (e.confidence < st.minConfidence) {
    if (st.status !== "low-confidence") st.setRuntime({ status: "low-confidence" });
    return;
  }
  if (st.status === "low-confidence") st.setRuntime({ status: "tracking" });

  if (e.type === "arm") {
    if (!st.armed) feedback("arm", null, "Armed");
    setArmed(true);
    return;
  }
  if (e.type === "disarm") {
    setArmed(false);
    return;
  }

  if (st.requireArming && !st.armed) {
    if (discrete) feedback(e.type, null, "Not armed — hold an open palm first");
    return;
  }

  const now = performance.now();
  if (discrete) {
    if (now - lastDiscreteAt < st.cooldownMs) return;
    lastDiscreteAt = now;
  }
  if (e.type === "swipe" && e.velocity < st.swipeMinVelocity) return;

  const resolved = resolveGesture(e, currentContext(), st);
  if (!resolved) {
    if (discrete) feedback(e.type, null, "No action here");
    return;
  }

  (runCommand as (id: CommandId, args: unknown, src: "gesture") => boolean)(
    resolved.command,
    resolved.args,
    "gesture",
  );
  scheduleDisarm();

  if (discrete) feedback(e.type, resolved.command);
  else if (now - lastContinuousFeedbackAt > CONTINUOUS_FEEDBACK_MS) {
    lastContinuousFeedbackAt = now;
    feedback(e.type, resolved.command);
  }
}
