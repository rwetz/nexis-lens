// A developer panel that emits synthetic gesture events straight into the
// dispatcher. It exercises everything downstream of recognition — arming,
// cooldown, confidence floor, context bindings, HUD — so all of that can be
// built and tuned before the camera pipeline exists.
import { useRef, useState } from "react";
import { motion, useDragControls } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, DragDropVerticalIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { dispatchGesture } from "./dispatcher";
import { useGestures } from "./store";
import type { Direction, GestureEvent } from "./types";

type Payload = GestureEvent extends infer E ? (E extends GestureEvent ? Omit<E, "confidence" | "timestamp"> : never) : never;

export function GestureSimulator() {
  const show = useGestures((s) => s.enabled && s.showSimulator);
  const setConfig = useGestures((s) => s.setConfig);
  const [confidence, setConfidence] = useState(0.9);
  const drag = useDragControls();
  const constraints = useRef<HTMLDivElement>(null);
  const lastPoint = useRef(0);

  if (!show) return null;

  const emit = (p: Payload) =>
    dispatchGesture({ ...p, confidence, timestamp: performance.now() } as GestureEvent);

  /** Continuous gestures arrive as a stream of small deltas. */
  const burst = (make: (i: number) => Payload, frames = 14, intervalMs = 16) => {
    for (let i = 0; i < frames; i++) setTimeout(() => emit(make(i)), i * intervalMs);
  };

  const swipe = (direction: Direction) => emit({ type: "swipe", direction, velocity: 2.5 });

  return (
    <div ref={constraints} className="pointer-events-none fixed inset-2 z-50">
      <motion.div
        drag
        dragListener={false}
        dragControls={drag}
        dragConstraints={constraints}
        dragMomentum={false}
        className="pointer-events-auto absolute bottom-10 right-4 w-72 rounded-2xl border border-border bg-popover/95 text-popover-foreground shadow-xl backdrop-blur"
      >
        <div
          onPointerDown={(e) => drag.start(e)}
          className="flex cursor-grab items-center gap-2 border-b border-border/70 px-3 py-2 text-xs font-medium active:cursor-grabbing"
        >
          <HugeiconsIcon icon={DragDropVerticalIcon} size={13} className="text-muted-foreground" />
          Gesture simulator
          <button
            type="button"
            aria-label="Hide simulator"
            className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setConfig({ showSimulator: false })}
          >
            <HugeiconsIcon icon={Cancel01Icon} size={13} />
          </button>
        </div>

        <div className="space-y-3 p-3 text-xs">
          <Row label="Arming">
            <Btn onClick={() => emit({ type: "arm" })}>Arm</Btn>
            <Btn onClick={() => emit({ type: "disarm" })}>Disarm</Btn>
          </Row>
          <Row label="Swipe">
            <Btn onClick={() => swipe("left")}>←</Btn>
            <Btn onClick={() => swipe("right")}>→</Btn>
            <Btn onClick={() => swipe("up")}>↑</Btn>
            <Btn onClick={() => swipe("down")}>↓</Btn>
          </Row>
          <Row label="Palm">
            <Btn onClick={() => burst(() => ({ type: "palm-move", dx: 0, dy: -0.012 }))}>Raise</Btn>
            <Btn onClick={() => burst(() => ({ type: "palm-move", dx: 0, dy: 0.012 }))}>Lower</Btn>
          </Row>
          <Row label="Pinch">
            <Btn onClick={() => burst(() => ({ type: "pinch", scale: 1.025, center: { x: 0.5, y: 0.4 } }))}>Spread</Btn>
            <Btn onClick={() => burst(() => ({ type: "pinch", scale: 1 / 1.025, center: { x: 0.5, y: 0.4 } }))}>Close</Btn>
          </Row>
          <Row label="Pose">
            <Btn onClick={() => emit({ type: "fist" })}>Fist</Btn>
            <Btn onClick={() => emit({ type: "palm-flip" })}>Flip</Btn>
            <Btn onClick={() => emit({ type: "two-hand-spread" })}>Spread ×2</Btn>
          </Row>

          <div>
            <div className="mb-1 flex items-center justify-between text-muted-foreground">
              <span>Point pad (camera frame)</span>
              <Btn onClick={() => emit({ type: "select" })}>Select</Btn>
            </div>
            <div
              className="relative h-24 cursor-crosshair rounded-lg border border-dashed border-border bg-muted/40"
              onPointerMove={(e) => {
                const now = performance.now();
                if (now - lastPoint.current < 33) return; // ~30 Hz, like a camera
                lastPoint.current = now;
                const r = e.currentTarget.getBoundingClientRect();
                emit({ type: "point", at: { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height } });
              }}
              onClick={() => emit({ type: "select" })}
            />
          </div>

          <div>
            <div className="mb-1.5 flex justify-between text-muted-foreground">
              <span>Confidence</span>
              <span className="font-mono tabular-nums">{confidence.toFixed(2)}</span>
            </div>
            <Slider min={0} max={1} step={0.01} value={[confidence]} onValueChange={([v]) => setConfidence(v)} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Btn({ onClick, children, className }: { onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("rounded-md border border-border bg-background px-2 py-1 hover:bg-accent", className)}
    >
      {children}
    </button>
  );
}
