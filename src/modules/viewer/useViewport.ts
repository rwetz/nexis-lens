// Scroll + zoom behaviour shared by every viewer (code, markdown, diff,
// image). It claims the `view.*` commands while its tab is active, so the
// keyboard, Ctrl+wheel / trackpad pinch, and future gestures all drive one
// implementation.
//
// Zoom is a CSS variable (`--lens-zoom`) the viewer multiplies into its font
// size. Changing it reflows the content, so the hook re-anchors the scroll
// position afterwards to keep the zoom focus point stationary on screen.
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useCommand } from "@/modules/commands/useCommand";
import type { Point } from "@/modules/commands/registry";
import { useSettings } from "@/modules/settings/store";
import { useTabs, type Tab } from "@/modules/tabs/store";

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +z.toFixed(3)));

type Anchor = { ratio: number; focusY: number; ratioX: number; focusX: number };

export function useViewport(opts: {
  tab: Tab;
  /** The element that actually scrolls. */
  getScroller: () => HTMLElement | null;
  /** Zoom at which the whole document fits; defaults to a height ratio. */
  fitZoom?: () => number;
}) {
  const { tab, getScroller } = opts;
  const updateView = useTabs((s) => s.updateView);
  const smooth = useSettings((s) => s.smoothScroll);
  const zoom = tab.view.zoom;
  const anchor = useRef<Anchor | null>(null);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  const setZoom = useCallback(
    (next: number, focus?: Point) => {
      const el = getScroller();
      const z = clampZoom(next);
      if (el) {
        const rect = el.getBoundingClientRect();
        // focus is viewport-normalised (0..1 of the window); convert to the
        // scroller's local coordinates. Without one (keyboard, toolbar), zoom
        // around the vertical centre and keep the left edge — line starts —
        // where it is, since code reads from the left.
        const fy = focus ? focus.y * window.innerHeight - rect.top : el.clientHeight / 2;
        const fx = focus ? focus.x * window.innerWidth - rect.left : 0;
        anchor.current = {
          ratio: (el.scrollTop + fy) / Math.max(1, el.scrollHeight),
          focusY: fy,
          ratioX: (el.scrollLeft + fx) / Math.max(1, el.scrollWidth),
          focusX: fx,
        };
      }
      updateView(tabRef.current.id, { zoom: z });
    },
    [getScroller, updateView],
  );

  // Re-anchor after the reflow. CodeMirror measures on the next frame, so
  // apply once now and once after it has settled.
  useLayoutEffect(() => {
    const a = anchor.current;
    const el = getScroller();
    if (!a || !el) return;
    const apply = () => {
      el.scrollTop = a.ratio * el.scrollHeight - a.focusY;
      el.scrollLeft = a.ratioX * el.scrollWidth - a.focusX;
    };
    apply();
    const r1 = requestAnimationFrame(() => {
      apply();
      requestAnimationFrame(() => {
        apply();
        anchor.current = null;
      });
    });
    return () => cancelAnimationFrame(r1);
  }, [zoom, getScroller]);

  // Restore the tab's scroll position on mount, save it on unmount.
  useEffect(() => {
    const el = getScroller();
    if (!el) return;
    const restore = tabRef.current.view.scrollTop;
    requestAnimationFrame(() => (el.scrollTop = restore));
    return () => updateView(tabRef.current.id, { scrollTop: el.scrollTop });
  }, [getScroller, updateView]);

  // Ctrl+wheel — also what a trackpad pinch produces in Chromium/WebKit.
  useEffect(() => {
    const el = getScroller();
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0025);
      setZoom(tabRef.current.view.zoom * factor, {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [getScroller, setZoom]);

  useCommand("view.scroll", (args) => {
    const el = getScroller();
    if (!el) return false;
    const dy = (args.dy ?? 0) + (args.pages ?? 0) * el.clientHeight;
    el.scrollBy({ top: dy, behavior: args.smooth && smooth ? "smooth" : "instant" });
  });
  useCommand("view.scrollTop", () => {
    getScroller()?.scrollTo({ top: 0, behavior: smooth ? "smooth" : "instant" });
  });
  useCommand("view.scrollBottom", () => {
    const el = getScroller();
    el?.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "instant" });
  });
  useCommand("view.zoom", (args) => setZoom(tabRef.current.view.zoom * args.factor, args.focus));
  useCommand("view.zoomReset", () => setZoom(1));
  useCommand("view.zoomFit", () => {
    const el = getScroller();
    if (!el) return false;
    const z = tabRef.current.view.zoom;
    const fit = opts.fitZoom?.() ?? (z * el.clientHeight) / Math.max(1, el.scrollHeight);
    setZoom(Math.min(1, fit));
  });

  return { zoom, setZoom };
}

/** Scroll `target` into the upper third of `scroller` — where an audience's
 * eyes go — rather than flush against the top edge. */
export function revealInScroller(scroller: HTMLElement, target: HTMLElement, smooth: boolean) {
  const s = scroller.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  const top = scroller.scrollTop + (t.top - s.top) - scroller.clientHeight * 0.18;
  scroller.scrollTo({ top: Math.max(0, top), behavior: smooth ? "smooth" : "instant" });
}
