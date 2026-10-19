// Recorded-landmark style tests: synthetic 21-point hands are fed frame by
// frame, the way MediaPipe would, and the emitted events are checked.
import { describe, expect, it, vi } from "vitest";
import { GestureRecognizer, type HandInput, type Landmark, type RecognizerConfig } from "./recognizer";
import type { GestureEvent, GestureType } from "./types";

const CFG: RecognizerConfig = { mirror: false, framing: { x: 0, y: 0, w: 1, h: 1 }, armHoldMs: 600, aspect: 1 };
const FRAME_MS = 33;

type Pose = "open" | "fist" | "pinch";

/** A right hand, palm to the camera, wrist at (0.5, 0.8). `flip` shows the back of the hand. */
function hand(pose: Pose, ox = 0, oy = 0, flip = false): Landmark[] {
  const p: Array<[number, number]> = new Array(21);
  p[0] = [0.5, 0.8];
  const mcps: Array<[number, number]> = [[0.45, 0.6], [0.5, 0.58], [0.55, 0.6], [0.6, 0.63]];
  mcps.forEach(([x, y], f) => {
    const base = 5 + f * 4;
    p[base] = [x, y];
    const curled = pose === "fist";
    p[base + 1] = [x, y - 0.06];
    p[base + 2] = curled ? [x, y - 0.03] : [x, y - 0.12];
    p[base + 3] = curled ? [x, y + 0.02] : [x, y - 0.18];
  });
  p[1] = [0.42, 0.75];
  p[2] = [0.38, 0.7];
  p[3] = [0.35, 0.66];
  p[4] = pose === "fist" ? [0.46, 0.66] : [0.32, 0.62];
  if (pose === "pinch") p[4] = [p[8][0] + 0.01, p[8][1] + 0.01];
  return p.map(([x, y]) => ({ x: (flip ? 1 - x : x) + ox, y: y + oy, z: 0 }));
}

function input(landmarks: Landmark[], handedness = "Right"): HandInput {
  return { landmarks, handedness, score: 0.95 };
}

/** Run frames through a fresh recogniser and collect every event. */
function run(frames: Array<(i: number) => HandInput[]>): GestureEvent[] {
  const r = new GestureRecognizer();
  const events: GestureEvent[] = [];
  let i = 0;
  for (const frame of frames) {
    events.push(...r.update(frame(i), i * FRAME_MS, CFG).events);
    i++;
  }
  return events;
}

const repeat = (n: number, f: (i: number) => HandInput[]) => Array.from({ length: n }, () => f);
const count = (events: GestureEvent[], type: GestureType) => events.filter((e) => e.type === type).length;

describe("pinch-drag", () => {
  it("emits drag deltas while a pinched hand moves", () => {
    const events = run(Array.from({ length: 12 }, (_, k) => () => [input(hand("pinch", 0, -0.01 * k))]));
    const drags = events.filter((e) => e.type === "pinch-drag");
    expect(drags.length).toBeGreaterThan(5);
    for (const d of drags) if (d.type === "pinch-drag") expect(d.dy).toBeCloseTo(-0.01, 3);
    expect(count(events, "palm-move")).toBe(0);
  });

  it("stays quiet while the pinched hand is still", () => {
    expect(count(run(repeat(15, () => [input(hand("pinch"))])), "pinch-drag")).toBe(0);
  });
});

describe("grab", () => {
  it("fires once when an open hand closes into a fist", () => {
    const events = run([...repeat(8, () => [input(hand("open"))]), ...repeat(10, () => [input(hand("fist"))])]);
    expect(count(events, "grab")).toBe(1);
    expect(count(events, "fist")).toBe(0);
  });

  it("a fist that was never open is a plain fist", () => {
    const events = run(repeat(12, () => [input(hand("fist"))]));
    expect(count(events, "fist")).toBe(1);
    expect(count(events, "grab")).toBe(0);
  });
});

describe("two hands", () => {
  const left = (pose: Pose, dx = 0) => input(hand(pose, -0.25 - dx, 0, true), "Left");
  const right = (pose: Pose, dx = 0) => input(hand(pose, 0.25 + dx), "Right");

  it("both open palms held still fire both-palms once", () => {
    const events = run(repeat(30, () => [left("open"), right("open")]));
    expect(count(events, "both-palms")).toBe(1);
  });

  it("both palms need the hold: a short show does nothing", () => {
    const events = run([...repeat(8, () => [left("open"), right("open")]), ...repeat(8, () => [right("open")])]);
    expect(count(events, "both-palms")).toBe(0);
  });

  it("pulling two pinches apart zooms in and does not scroll", () => {
    const events = run(Array.from({ length: 12 }, (_, k) => () => [left("pinch", 0.01 * k), right("pinch", 0.01 * k)]));
    const zooms = events.filter((e) => e.type === "two-hand-pinch");
    expect(zooms.length).toBeGreaterThan(3);
    for (const z of zooms) if (z.type === "two-hand-pinch") expect(z.scale).toBeGreaterThan(1);
    expect(count(events, "pinch-drag")).toBe(0);
  });
});

describe("bindings", async () => {
  vi.stubGlobal("window", { innerHeight: 800 });
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
  const { resolveGesture } = await import("./bindings");
  const { DEFAULT_GESTURE_CONFIG } = await import("./store");
  const ev = (e: Record<string, unknown>) => ({ confidence: 1, timestamp: 0, ...e }) as GestureEvent;
  const cmd = (e: Record<string, unknown>, ctx: Parameters<typeof resolveGesture>[1]) =>
    resolveGesture(ev(e), ctx, DEFAULT_GESTURE_CONFIG)?.command ?? null;

  it("Focus mode only scrolls, zooms and flips", () => {
    expect(cmd({ type: "pinch-drag", dx: 0, dy: 0.1 }, "code")).toBe("view.scroll");
    expect(cmd({ type: "two-hand-pinch", scale: 1.1, center: { x: 0.5, y: 0.5 } }, "diff")).toBe("view.zoom");
    expect(cmd({ type: "palm-flip" }, "markdown")).toBe("markdown.toggleMode");
    expect(cmd({ type: "palm-flip" }, "code")).toBeNull();
    expect(cmd({ type: "grab" }, "code")).toBeNull();
    expect(cmd({ type: "swipe", direction: "left", velocity: 3 }, "code")).toBeNull();
    expect(cmd({ type: "both-palms" }, "markdown")).toBe("picker.open");
  });

  it("File mode only moves the highlight, opens, or goes back", () => {
    expect(cmd({ type: "pinch-drag", dx: 0, dy: 0.1 }, "files")).toBe("picker.move");
    expect(cmd({ type: "grab" }, "files")).toBe("picker.choose");
    expect(cmd({ type: "both-palms" }, "files")).toBe("picker.cancel");
    expect(cmd({ type: "two-hand-pinch", scale: 1.1, center: { x: 0.5, y: 0.5 } }, "files")).toBeNull();
    expect(cmd({ type: "palm-flip" }, "files")).toBeNull();
  });

  it("overlays take no gestures", () => {
    expect(cmd({ type: "pinch-drag", dx: 0, dy: 0.1 }, null)).toBeNull();
  });
});
