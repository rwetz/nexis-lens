// Turns per-frame hand landmarks into the gesture vocabulary (./types.ts).
//
// Pure logic — no camera, no MediaPipe import — so it can be driven by
// recorded landmark sequences in tests. Two stages:
//
//   1. Per frame, classify each hand's pose from finger geometry.
//   2. Over time, per hand, turn pose + motion into events: hold-to-arm,
//      palm scroll, pinch zoom, pinch-click, swipes, fist, palm flip, and the
//      two-hand spread.
//
// Coordinates: landmarks arrive in raw camera space (0..1). They are mirrored
// into display space first; events are then expressed relative to the
// framing box, which is what ./types.ts specifies.
import type { Direction, GestureEvent, Point } from "./types";

export type Landmark = { x: number; y: number; z: number };
export type HandInput = { landmarks: Landmark[]; handedness: string; score: number };

export type HandPose = "open" | "fist" | "point" | "pinch" | "other";

export type TrackedHand = {
  id: string;
  handedness: string;
  score: number;
  /** 21 landmarks in display space (mirrored if on), 0..1 of the full frame. */
  points: Point[];
  pose: HandPose;
  /** Thumb–index tip distance over palm size. */
  pinchRatio: number;
  /** Sign of the palm normal — flips when the hand turns over. */
  facing: 1 | -1;
  /** Palm-centre velocity in frame-widths / s. */
  velocity: Point;
  speed: number;
  /** 0..1 progress of the hold-still arming pose. */
  armProgress: number;
  primary: boolean;
};

export type RecognizerConfig = {
  mirror: boolean;
  framing: { x: number; y: number; w: number; h: number };
  armHoldMs: number;
  /** Frame width / height, so distances are measured in square units. */
  aspect: number;
};

export type RecognizerOutput = { hands: TrackedHand[]; events: GestureEvent[] };

// Landmark indices (MediaPipe hand topology).
const WRIST = 0, THUMB_IP = 3, THUMB_TIP = 4, INDEX_MCP = 5, INDEX_PIP = 6, INDEX_TIP = 8;
const MIDDLE_MCP = 9, MIDDLE_PIP = 10, MIDDLE_TIP = 12, RING_MCP = 13, RING_PIP = 14, RING_TIP = 16;
const PINKY_MCP = 17, PINKY_PIP = 18, PINKY_TIP = 20;

export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
export const FINGERTIPS = [THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP];

// Tuning. Ratios are relative to palm size (wrist → middle MCP).
const PINCH_CLOSED = 0.28;
const PINCH_OPEN = 0.4;
const CLICK_MAX_MS = 420;
const HOLD_STILL_SPEED = 0.18;
const SWIPE_SPEED = 0.9;
const SWIPE_MIN_TRAVEL = 0.1;
const SWIPE_AXIS_RATIO = 1.8;
const SWIPE_REFRACTORY_MS = 380;
const VELOCITY_WINDOW_MS = 110;
const FIST_HOLD_MS = 140;
const FLIP_WINDOW_MS = 700;
const SPREAD_WINDOW_MS = 500;
const SPREAD_MIN_GROWTH = 0.18;
const MOVE_DEADZONE = 0.0025;
const ZOOM_DEADZONE = 0.012;
const LOST_AFTER_MS = 250;

type Sample = { t: number; x: number; y: number };

type Track = {
  id: string;
  lastSeen: number;
  pose: HandPose;
  poseSince: number;
  history: Sample[];
  palm: Point | null;
  still: number | null;
  armed: boolean;
  lastSwipe: number;
  fistFired: boolean;
  openFacing: { sign: 1 | -1; t: number } | null;
  lastFlip: number;
  pinchClosedAt: number | null;
  pinchClosed: boolean;
  zoomRatio: number | null;
};

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export class GestureRecognizer {
  private tracks = new Map<string, Track>();
  private primaryId: string | null = null;
  private spread: Sample[] = [];
  private lastSpread = -Infinity;

  reset() {
    this.tracks.clear();
    this.primaryId = null;
    this.spread = [];
  }

  update(input: HandInput[], t: number, cfg: RecognizerConfig): RecognizerOutput {
    const events: GestureEvent[] = [];
    const ids = assignIds(input);
    const hands: TrackedHand[] = [];
    const seen: Array<{ track: Track; hand: TrackedHand; geo: Geometry; palm: Point }> = [];

    for (const [i, hand] of input.entries()) {
      const id = ids[i];
      const points = hand.landmarks.map((l) => ({ x: cfg.mirror ? 1 - l.x : l.x, y: l.y }));
      // Square space for geometry: x scaled by aspect.
      const sq = points.map((p) => ({ x: p.x * cfg.aspect, y: p.y }));
      const geo = measure(sq);

      let track = this.tracks.get(id);
      if (!track || t - track.lastSeen > LOST_AFTER_MS) {
        track = newTrack(id, t);
        this.tracks.set(id, track);
      }
      track.lastSeen = t;
      const pose = classify(geo, track.pinchClosed);
      if (pose !== track.pose) {
        track.pose = pose;
        track.poseSince = t;
      }

      const palm = palmCentre(points);
      track.history.push({ t, x: palm.x, y: palm.y });
      while (track.history.length > 2 && t - track.history[0].t > 400) track.history.shift();
      const velocity = velocityOf(track.history, t);
      const speed = Math.hypot(velocity.x, velocity.y);

      const tracked: TrackedHand = {
        id,
        handedness: hand.handedness,
        score: hand.score,
        points,
        pose,
        pinchRatio: geo.pinchRatio,
        facing: geo.facing,
        velocity,
        speed,
        armProgress: 0,
        primary: false,
      };
      hands.push(tracked);
      seen.push({ track, hand: tracked, geo, palm });
    }

    // Forget hands that left the frame.
    for (const [id, tr] of this.tracks) if (t - tr.lastSeen > LOST_AFTER_MS) this.tracks.delete(id);

    // Single-hand gestures follow one hand so two hands never double-fire.
    if (!hands.some((h) => h.id === this.primaryId)) {
      this.primaryId = hands.length ? [...hands].sort((a, b) => b.score - a.score)[0].id : null;
    }
    for (const { track, hand, geo, palm } of seen) {
      if (hand.id === this.primaryId) {
        hand.primary = true;
        this.singleHand(track, hand, geo, palm, t, cfg, events);
      }
      track.palm = palm;
    }
    const primary = hands.find((h) => h.primary);

    this.twoHands(hands, t, events);

    const confidence = primary?.score ?? 0;
    return { hands, events: events.map((e) => ({ ...e, confidence: e.confidence || confidence })) };
  }

  private singleHand(
    track: Track,
    hand: TrackedHand,
    geo: Geometry,
    palm: Point,
    t: number,
    cfg: RecognizerConfig,
    events: GestureEvent[],
  ) {
    const meta = { confidence: hand.score, timestamp: t };
    const f = cfg.framing;
    const toBox = (p: Point): Point => ({ x: (p.x - f.x) / f.w, y: (p.y - f.y) / f.h });

    // Hold an open palm still → arm (once per hold).
    if (hand.pose === "open" && hand.speed < HOLD_STILL_SPEED) {
      track.still ??= t;
      hand.armProgress = Math.min(1, (t - track.still) / cfg.armHoldMs);
      if (hand.armProgress >= 1 && !track.armed) {
        track.armed = true;
        events.push({ type: "arm", ...meta });
      }
    } else {
      track.still = null;
      // Small drift after arming doesn't re-arm; a real move or new pose does.
      if (hand.pose !== "open" || hand.speed > HOLD_STILL_SPEED * 3) track.armed = false;
    }

    // Fast flick → swipe. Takes precedence over palm scrolling.
    const swipe = detectSwipe(track.history, t);
    const swiping = hand.speed >= SWIPE_SPEED;
    if (swipe && hand.pose !== "fist" && hand.pose !== "pinch" && t - track.lastSwipe > SWIPE_REFRACTORY_MS) {
      track.lastSwipe = t;
      track.history = track.history.slice(-1);
      events.push({ type: "swipe", direction: swipe.direction, velocity: swipe.velocity, ...meta });
    }

    // Open palm moving → scroll deltas in framing-box units.
    if (hand.pose === "open" && !swiping && track.palm && hand.armProgress === 0) {
      const dx = (palm.x - track.palm.x) / f.w;
      const dy = (palm.y - track.palm.y) / f.h;
      if (Math.hypot(dx, dy) > MOVE_DEADZONE) events.push({ type: "palm-move", dx, dy, ...meta });
    }

    // Fist, held briefly → once.
    if (hand.pose === "fist") {
      if (!track.fistFired && t - track.poseSince >= FIST_HOLD_MS) {
        track.fistFired = true;
        events.push({ type: "fist", ...meta });
      }
    } else track.fistFired = false;

    // Palm flip: open hand seen facing one way, then the other, quickly.
    if (hand.pose === "open" && Math.abs(geo.normal) > 0.15) {
      const prev = track.openFacing;
      if (prev && prev.sign !== geo.facing && t - prev.t < FLIP_WINDOW_MS && t - track.lastFlip > FLIP_WINDOW_MS) {
        track.lastFlip = t;
        events.push({ type: "palm-flip", ...meta });
      }
      track.openFacing = { sign: geo.facing, t };
    }

    // Thumb–index: a quick close-and-open is a click; a C-shape opening or
    // closing is zoom.
    const ratio = geo.pinchRatio;
    if (!track.pinchClosed && ratio < PINCH_CLOSED && hand.pose !== "fist") {
      track.pinchClosed = true;
      track.pinchClosedAt = t;
    } else if (track.pinchClosed && ratio > PINCH_OPEN) {
      track.pinchClosed = false;
      if (track.pinchClosedAt !== null && t - track.pinchClosedAt < CLICK_MAX_MS) events.push({ type: "select", ...meta });
      track.pinchClosedAt = null;
    }
    if (hand.pose === "pinch" && !track.pinchClosed) {
      if (track.zoomRatio !== null) {
        const scale = ratio / track.zoomRatio;
        if (Math.abs(scale - 1) > ZOOM_DEADZONE) {
          const mid = { x: (hand.points[THUMB_TIP].x + hand.points[INDEX_TIP].x) / 2, y: (hand.points[THUMB_TIP].y + hand.points[INDEX_TIP].y) / 2 };
          events.push({ type: "pinch", scale, center: toBox(mid), ...meta });
          track.zoomRatio = ratio;
        }
      } else track.zoomRatio = ratio;
    } else track.zoomRatio = null;

    if (hand.pose === "point") events.push({ type: "point", at: toBox(hand.points[INDEX_TIP]), ...meta });
  }

  private twoHands(hands: TrackedHand[], t: number, events: GestureEvent[]) {
    if (hands.length < 2) {
      this.spread = [];
      return;
    }
    const [a, b] = hands;
    const d = dist(palmCentre(a.points), palmCentre(b.points));
    this.spread.push({ t, x: d, y: 0 });
    while (this.spread.length && t - this.spread[0].t > SPREAD_WINDOW_MS) this.spread.shift();
    const min = Math.min(...this.spread.map((s) => s.x));
    if (d - min > SPREAD_MIN_GROWTH && t - this.lastSpread > SPREAD_WINDOW_MS * 2) {
      this.lastSpread = t;
      this.spread = [];
      events.push({ type: "two-hand-spread", confidence: Math.min(a.score, b.score), timestamp: t });
    }
  }
}

function newTrack(id: string, t: number): Track {
  return {
    id,
    lastSeen: t,
    pose: "other",
    poseSince: t,
    history: [],
    palm: null,
    still: null,
    armed: false,
    lastSwipe: -Infinity,
    fistFired: false,
    openFacing: null,
    lastFlip: -Infinity,
    pinchClosedAt: null,
    pinchClosed: false,
    zoomRatio: null,
  };
}

/** Stable ids across frames: MediaPipe's handedness label, de-duplicated. */
function assignIds(input: HandInput[]): string[] {
  const seen = new Map<string, number>();
  return input.map((h) => {
    const n = seen.get(h.handedness) ?? 0;
    seen.set(h.handedness, n + 1);
    return n ? `${h.handedness}-${n}` : h.handedness;
  });
}

type Geometry = {
  extended: [boolean, boolean, boolean, boolean, boolean];
  pinchRatio: number;
  normal: number;
  facing: 1 | -1;
  indexReach: number;
  thumbOut: boolean;
};

function measure(p: Point[]): Geometry {
  const scale = Math.max(1e-6, dist(p[WRIST], p[MIDDLE_MCP]));
  const out = (tip: number, pip: number) => dist(p[WRIST], p[tip]) > dist(p[WRIST], p[pip]) * 1.15;
  const thumbOut =
    dist(p[THUMB_TIP], p[PINKY_MCP]) > dist(p[THUMB_IP], p[PINKY_MCP]) * 1.05 &&
    dist(p[THUMB_TIP], p[INDEX_MCP]) / scale > 0.5;
  const u = { x: p[INDEX_MCP].x - p[WRIST].x, y: p[INDEX_MCP].y - p[WRIST].y };
  const v = { x: p[PINKY_MCP].x - p[WRIST].x, y: p[PINKY_MCP].y - p[WRIST].y };
  const normal = (u.x * v.y - u.y * v.x) / (scale * scale);
  return {
    extended: [thumbOut, out(INDEX_TIP, INDEX_PIP), out(MIDDLE_TIP, MIDDLE_PIP), out(RING_TIP, RING_PIP), out(PINKY_TIP, PINKY_PIP)],
    pinchRatio: dist(p[THUMB_TIP], p[INDEX_TIP]) / scale,
    normal,
    facing: normal >= 0 ? 1 : -1,
    indexReach: dist(p[WRIST], p[INDEX_TIP]) / scale,
    thumbOut,
  };
}

function classify(g: Geometry, pinchClosed: boolean): HandPose {
  const [, index, middle, ring, pinky] = g.extended;
  const others = [middle, ring, pinky].filter(Boolean).length;
  const up = [index, middle, ring, pinky].filter(Boolean).length;
  if (up === 0 && g.indexReach < 1.15) return "fist";
  if (pinchClosed || g.pinchRatio < PINCH_CLOSED) return "pinch";
  if (up >= 4) return "open";
  if (others === 0 && (index || g.indexReach > 1.2)) return g.thumbOut ? "pinch" : "point";
  return "other";
}

function palmCentre(p: Point[]): Point {
  const ids = [WRIST, INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP];
  return { x: ids.reduce((s, i) => s + p[i].x, 0) / ids.length, y: ids.reduce((s, i) => s + p[i].y, 0) / ids.length };
}

function velocityOf(h: Sample[], t: number): Point {
  const recent = h.filter((s) => t - s.t <= VELOCITY_WINDOW_MS);
  if (recent.length < 2) return { x: 0, y: 0 };
  const a = recent[0];
  const b = recent[recent.length - 1];
  const dt = (b.t - a.t) / 1000;
  return dt > 0 ? { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt } : { x: 0, y: 0 };
}

function detectSwipe(h: Sample[], t: number): { direction: Direction; velocity: number } | null {
  const v = velocityOf(h, t);
  const ax = Math.abs(v.x);
  const ay = Math.abs(v.y);
  const speed = Math.max(ax, ay);
  if (speed < SWIPE_SPEED) return null;
  if (Math.max(ax, ay) < Math.min(ax, ay) * SWIPE_AXIS_RATIO) return null;
  const window = h.filter((s) => t - s.t <= 250);
  if (window.length < 2) return null;
  const travel = ax > ay ? window[window.length - 1].x - window[0].x : window[window.length - 1].y - window[0].y;
  if (Math.abs(travel) < SWIPE_MIN_TRAVEL) return null;
  const direction: Direction = ax > ay ? (v.x > 0 ? "right" : "left") : v.y > 0 ? "down" : "up";
  return { direction, velocity: speed };
}
