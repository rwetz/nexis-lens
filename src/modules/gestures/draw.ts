// Canvas drawing for tracked hands — shared by the Gesture lab preview and
// the in-app tracking overlay. Input is display-space (0..1, mirrored);
// `map` places it on the canvas.
import { FINGERTIPS, HAND_CONNECTIONS, type HandPose, type TrackedHand } from "./recognizer";
import type { Point } from "./types";

export const POSE_LABELS: Record<HandPose, string> = {
  open: "Open palm",
  fist: "Fist",
  point: "Point",
  pinch: "Pinch",
  other: "—",
};

export type Palette = { brand: string; pose: Record<HandPose, string>; text: string; chip: string };

/** Pose colours, with the theme's brand colour for the arming pose. */
export function readPalette(el: Element = document.documentElement): Palette {
  const css = getComputedStyle(el);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const brand = v("--brand", "oklch(0.72 0.15 35)");
  return {
    brand,
    pose: {
      open: brand,
      fist: "oklch(0.78 0.16 75)",
      point: "oklch(0.72 0.13 230)",
      pinch: "oklch(0.7 0.17 300)",
      other: "oklch(0.75 0 0)",
    },
    text: "#fff",
    chip: "rgb(0 0 0 / 0.6)",
  };
}

type DrawOptions = {
  map: (p: Point) => Point;
  palette: Palette;
  /** Pixel scale for line widths and text (devicePixelRatio × zoom). */
  px: number;
  labels?: boolean;
  vectors?: boolean;
};

export function drawHands(ctx: CanvasRenderingContext2D, hands: TrackedHand[], o: DrawOptions) {
  for (const h of hands) drawHand(ctx, h, o);
}

function drawHand(ctx: CanvasRenderingContext2D, h: TrackedHand, { map, palette, px, labels = true, vectors = true }: DrawOptions) {
  const pts = h.points.map(map);
  const colour = palette.pose[h.pose];
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = h.primary ? 1 : 0.55;

  // Bones.
  ctx.strokeStyle = colour;
  ctx.lineWidth = 3 * px;
  ctx.beginPath();
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.moveTo(pts[a].x, pts[a].y);
    ctx.lineTo(pts[b].x, pts[b].y);
  }
  ctx.stroke();

  // Joints; fingertips larger.
  for (const [i, p] of pts.entries()) {
    const tip = FINGERTIPS.includes(i);
    ctx.beginPath();
    ctx.arc(p.x, p.y, (tip ? 5 : 3) * px, 0, Math.PI * 2);
    ctx.fillStyle = tip ? "#fff" : colour;
    ctx.fill();
    if (tip) {
      ctx.lineWidth = 2 * px;
      ctx.strokeStyle = colour;
      ctx.stroke();
    }
  }

  // Thumb–index span, the input for pinch zoom and click.
  const thumb = pts[4];
  const index = pts[8];
  ctx.setLineDash([4 * px, 4 * px]);
  ctx.lineWidth = 1.5 * px;
  ctx.strokeStyle = palette.pose.pinch;
  ctx.beginPath();
  ctx.moveTo(thumb.x, thumb.y);
  ctx.lineTo(index.x, index.y);
  ctx.stroke();
  ctx.setLineDash([]);

  const palm = centroid([pts[0], pts[5], pts[9], pts[13], pts[17]]);

  // Arming progress ring around the palm.
  if (h.armProgress > 0) {
    ctx.lineWidth = 4 * px;
    ctx.strokeStyle = palette.brand;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(palm.x, palm.y, 26 * px, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * h.armProgress);
    ctx.stroke();
    ctx.globalAlpha = h.primary ? 1 : 0.55;
  }

  // Palm velocity vector (display-space units per second, drawn over 150 ms).
  if (vectors && h.speed > 0.05) {
    const c = centroidOf(h.points);
    arrow(ctx, palm, map({ x: c.x + h.velocity.x * 0.15, y: c.y + h.velocity.y * 0.15 }), px, "#fff");
  }

  if (labels) {
    const text = `${POSE_LABELS[h.pose]} · ${h.handedness} ${Math.round(h.score * 100)}%`;
    chip(ctx, text, { x: pts[0].x, y: pts[0].y + 22 * px }, px, palette, colour);
  }
  ctx.restore();
}

export function chip(ctx: CanvasRenderingContext2D, text: string, at: Point, px: number, palette: Palette, dot?: string) {
  ctx.save();
  ctx.font = `600 ${12 * px}px "Inter Variable", system-ui, sans-serif`;
  const w = ctx.measureText(text).width + (dot ? 26 : 16) * px;
  const h = 22 * px;
  const x = at.x - w / 2;
  ctx.fillStyle = palette.chip;
  ctx.beginPath();
  ctx.roundRect(x, at.y - h / 2, w, h, h / 2);
  ctx.fill();
  let tx = x + 8 * px;
  if (dot) {
    ctx.fillStyle = dot;
    ctx.beginPath();
    ctx.arc(tx + 4 * px, at.y, 4 * px, 0, Math.PI * 2);
    ctx.fill();
    tx += 12 * px;
  }
  ctx.fillStyle = palette.text;
  ctx.textBaseline = "middle";
  ctx.fillText(text, tx, at.y + 0.5 * px);
  ctx.restore();
}

function arrow(ctx: CanvasRenderingContext2D, a: Point, b: Point, px: number, colour: string) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const head = 8 * px;
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = 2 * px;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - head * Math.cos(ang - 0.45), b.y - head * Math.sin(ang - 0.45));
  ctx.lineTo(b.x - head * Math.cos(ang + 0.45), b.y - head * Math.sin(ang + 0.45));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function centroid(ps: Point[]): Point {
  return { x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length };
}

/** Palm centre in display space (wrist + knuckles). */
export function centroidOf(points: Point[]): Point {
  return centroid([points[0], points[5], points[9], points[13], points[17]]);
}
