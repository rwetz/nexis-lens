// Developer overlay: draws the tracked hands over the whole window while
// gesture mode is on, mapped through the framing box — so the framing box
// fills the screen and a pointing finger lands where `point` events do.
import { useEffect, useRef } from "react";
import { drawHands, readPalette } from "./draw";
import { useGestures } from "./store";
import { subscribeTrackingFrames } from "./tracking";

export function TrackingOverlay() {
  const show = useGestures((s) => s.enabled && s.showTrackingOverlay);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!show) return;
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    const palette = readPalette();
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.round(window.innerWidth * dpr);
      c.height = Math.round(window.innerHeight * dpr);
    };
    fit();
    window.addEventListener("resize", fit);

    const unsubscribe = subscribeTrackingFrames((f) => {
      ctx.clearRect(0, 0, c.width, c.height);
      if (!f) return;
      const { framing } = useGestures.getState();
      const px = window.devicePixelRatio || 1;
      drawHands(ctx, f.hands, {
        palette,
        px,
        labels: true,
        vectors: false,
        map: (p) => ({ x: ((p.x - framing.x) / framing.w) * c.width, y: ((p.y - framing.y) / framing.h) * c.height }),
      });
    });
    return () => {
      unsubscribe();
      window.removeEventListener("resize", fit);
      ctx.clearRect(0, 0, c.width, c.height);
    };
  }, [show]);

  if (!show) return null;
  return <canvas ref={canvas} aria-hidden className="pointer-events-none fixed inset-0 z-[60] size-full opacity-80" />;
}
