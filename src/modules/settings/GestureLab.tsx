// Gesture lab — a developer bench for the hand-tracking pipeline.
//
// Runs the real pipeline (camera → MediaPipe → recogniser) against its own
// camera stream, draws what it sees, and measures it against the frame
// budget: camera and inference rate, inference time, capture-to-result
// latency, dropped frames, detection rate. A timed run produces a summary
// that can be copied into an issue. Live gesture mode pauses meanwhile.
import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, Copy01Icon, PlayIcon, StopIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { cameraErrorText, openCamera, stopStream } from "@/modules/gestures/camera";
import { chip, drawHands, readPalette, type Palette } from "@/modules/gestures/draw";
import { GESTURE_LABELS } from "@/modules/gestures/GestureHud";
import { HandPipeline, type PipelineFrame } from "@/modules/gestures/sources/mediapipe";
import { useGestures } from "@/modules/gestures/store";
import type { GestureEvent, GestureType, Point } from "@/modules/gestures/types";
import { Segmented } from "@/modules/viewer/ViewerToolbar";
import { SectionTitle } from "./SettingsDialog";

const WINDOW = 180; // frames kept for live stats and the timeline
const RUN_MS = 10_000;
const CONTINUOUS: ReadonlySet<GestureType> = new Set(["palm-move", "pinch", "point"]);

type Sample = Pick<PipelineFrame, "t" | "inferenceMs" | "latencyMs" | "dropped"> & { hands: number; confidence: number };
type LogEntry = { key: number; at: number; text: string };

type Summary = {
  frames: number;
  seconds: number;
  cameraFps: number;
  inferenceFps: number;
  inference: Percentiles;
  latency: Percentiles;
  overBudget: number;
  detection: number;
  confidence: number;
  dropped: number;
};
type Percentiles = { mean: number; p50: number; p95: number; p99: number; max: number };
type RunResult = Summary & { counts: Partial<Record<GestureType, number>>; delegate: string; size: string; loadMs: number; budgetMs: number };

export function GestureLab() {
  const g = useGestures();
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const timeline = useRef<HTMLCanvasElement>(null);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ delegate: string; loadMs: number; size: string } | null>(null);
  const [live, setLive] = useState<Summary | null>(null);
  const [counts, setCounts] = useState<Partial<Record<GestureType, number>>>({});
  const [log, setLog] = useState<LogEntry[]>([]);
  const [run, setRun] = useState<{ until: number } | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  const budgetMs = 1000 / g.targetFps;
  const samples = useRef<Sample[]>([]);
  const runSamples = useRef<Sample[] | null>(null);
  const runCounts = useRef<Partial<Record<GestureType, number>>>({});
  const countsRef = useRef<Partial<Record<GestureType, number>>>({});
  const flashes = useRef<{ text: string; t: number }[]>([]);
  const trail = useRef<Point[]>([]);
  const logKey = useRef(0);

  // Release the camera to gesture mode whenever the lab isn't running.
  useEffect(() => {
    g.setRuntime({ labActive: running });
    return () => useGestures.getState().setRuntime({ labActive: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const pipeline = new HandPipeline();
    let stream: MediaStream | null = null;
    let alive = true;
    const palette = readPalette();
    setError(null);
    samples.current = [];
    countsRef.current = {};
    setCounts({});
    setLog([]);

    const onFrame = (f: PipelineFrame) => {
      const s: Sample = {
        t: f.t,
        inferenceMs: f.inferenceMs,
        latencyMs: f.latencyMs,
        dropped: f.dropped,
        hands: f.hands.length,
        confidence: f.hands.length ? f.hands.reduce((a, h) => a + h.score, 0) / f.hands.length : 0,
      };
      samples.current.push(s);
      if (samples.current.length > WINDOW) samples.current.shift();
      runSamples.current?.push(s);
      for (const e of f.events) record(e);
      draw(f, palette);
    };

    const record = (e: GestureEvent) => {
      countsRef.current[e.type] = (countsRef.current[e.type] ?? 0) + 1;
      if (runSamples.current) runCounts.current[e.type] = (runCounts.current[e.type] ?? 0) + 1;
      if (CONTINUOUS.has(e.type)) return;
      const text = describe(e);
      flashes.current.push({ text, t: performance.now() });
      setLog((l) => [{ key: ++logKey.current, at: performance.now(), text }, ...l].slice(0, 12));
    };

    (async () => {
      try {
        stream = await openCamera(g);
        const v = video.current;
        if (!alive || !v) return;
        v.srcObject = stream;
        await v.play();
        const loaded = await pipeline.start(v, g.delegate, { onFrame });
        if (alive) setInfo({ delegate: loaded.delegate, loadMs: loaded.loadMs, size: `${v.videoWidth}×${v.videoHeight}` });
      } catch (e) {
        if (alive) {
          setError(loadErrorText(e));
          setRunning(false);
        }
      }
    })();

    // Numbers refresh at 4 Hz; the canvas draws every frame.
    const ui = setInterval(() => {
      setLive(summarise(samples.current, budgetMs));
      setCounts({ ...countsRef.current });
      drawTimeline(timeline.current, samples.current, budgetMs, palette);
    }, 250);

    return () => {
      alive = false;
      clearInterval(ui);
      pipeline.stop();
      stopStream(stream);
      if (video.current) video.current.srcObject = null;
      runSamples.current = null;
      setRun(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, g.delegate, g.cameraId, g.resolution, g.targetFps]);

  // Timed benchmark run.
  useEffect(() => {
    if (!run) return;
    const t = setTimeout(() => {
      const s = runSamples.current ?? [];
      runSamples.current = null;
      setRun(null);
      if (!s.length) return;
      setResult({
        ...summarise(s, budgetMs),
        counts: { ...runCounts.current },
        delegate: info?.delegate ?? g.delegate,
        size: info?.size ?? "?",
        loadMs: info?.loadMs ?? 0,
        budgetMs,
      });
    }, run.until - performance.now());
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  const startRun = () => {
    runSamples.current = [];
    runCounts.current = {};
    setResult(null);
    setRun({ until: performance.now() + RUN_MS });
  };

  function draw(f: PipelineFrame, palette: Palette) {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(r.width * dpr);
    const h = Math.round(r.height * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    ctx.clearRect(0, 0, w, h);
    const map = (p: Point) => ({ x: p.x * w, y: p.y * h });
    const { framing } = useGestures.getState();

    // Framing box: events are measured relative to it.
    ctx.save();
    ctx.setLineDash([6 * dpr, 6 * dpr]);
    ctx.lineWidth = 1.5 * dpr;
    ctx.strokeStyle = palette.brand;
    ctx.globalAlpha = 0.7;
    ctx.strokeRect(framing.x * w, framing.y * h, framing.w * w, framing.h * h);
    ctx.restore();

    // Index-tip trail of the primary hand.
    const primary = f.hands.find((x) => x.primary);
    if (primary) trail.current.push(map(primary.points[8]));
    else trail.current.shift();
    if (trail.current.length > 24) trail.current.shift();
    ctx.save();
    for (const [i, p] of trail.current.entries()) {
      ctx.globalAlpha = (i + 1) / trail.current.length * 0.6;
      ctx.fillStyle = palette.pose.point;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    drawHands(ctx, f.hands, { map, palette, px: dpr });

    // Recognised discrete gestures flash at the top.
    const now = performance.now();
    flashes.current = flashes.current.filter((x) => now - x.t < 900);
    for (const [i, fl] of flashes.current.entries()) {
      ctx.save();
      ctx.globalAlpha = 1 - (now - fl.t) / 900;
      ctx.scale(1.4, 1.4);
      chip(ctx, fl.text, { x: w / 2 / 1.4, y: (24 + i * 30) * dpr / 1.4 }, dpr, palette, palette.brand);
      ctx.restore();
    }

    if (!f.hands.length) chip(ctx, "No hand in frame", { x: w / 2, y: h - 22 * dpr }, dpr, palette);
  }

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(toMarkdown(result));
    toast("Benchmark copied as Markdown");
  };

  const recording = run !== null;

  return (
    <>
      <SectionTitle description="Developer bench for hand tracking. Runs the real camera → MediaPipe → recogniser pipeline, draws what it recognises, and measures it against the frame budget. Gesture mode pauses while this runs.">
        Gesture lab
      </SectionTitle>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant={running ? "outline" : "default"} size="sm" onClick={() => setRunning((r) => !r)}>
          <HugeiconsIcon icon={running ? StopIcon : PlayIcon} size={14} />
          {running ? "Stop" : "Start camera"}
        </Button>
        <Button variant="outline" size="sm" disabled={!running || !info || recording} onClick={startRun}>
          {recording ? "Recording…" : `Run ${RUN_MS / 1000} s benchmark`}
        </Button>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Inference
          <Segmented
            value={g.delegate}
            onChange={(delegate) => g.setConfig({ delegate })}
            options={[
              { value: "GPU", label: "GPU" },
              { value: "CPU", label: "CPU" },
            ]}
          />
        </div>
      </div>

      <div
        className="relative w-full overflow-hidden rounded-xl border border-border bg-muted/40"
        style={{ aspectRatio: info ? info.size.replace("×", " / ") : "4 / 3" }}
      >
        <video
          ref={video}
          muted
          playsInline
          className={cn("absolute inset-0 size-full object-cover", g.mirror && "-scale-x-100", !running && "hidden")}
        />
        <canvas ref={canvas} className="absolute inset-0 size-full" aria-hidden />
        {!running && (
          <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">Camera off</div>
        )}
        {recording && (
          <RunProgress until={run.until} />
        )}
      </div>

      {error && (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <HugeiconsIcon icon={Alert02Icon} size={14} />
          {error}
        </p>
      )}

      <div className="mt-3 grid grid-cols-4 gap-2">
        <Metric label="Camera" value={live ? `${live.cameraFps.toFixed(0)} fps` : "—"} warn={!!live && live.cameraFps < g.targetFps * 0.8} />
        <Metric label="Processed" value={live ? `${live.inferenceFps.toFixed(0)} fps` : "—"} warn={!!live && live.inferenceFps < g.targetFps * 0.8} />
        <Metric
          label="Inference p50 / p95"
          value={live ? `${live.inference.p50.toFixed(1)} / ${live.inference.p95.toFixed(1)} ms` : "—"}
          warn={!!live && live.inference.p95 > budgetMs}
        />
        <Metric label="Latency p50 / p95" value={live ? `${live.latency.p50.toFixed(0)} / ${live.latency.p95.toFixed(0)} ms` : "—"} />
        <Metric label="Over budget" value={live ? pct(live.overBudget) : "—"} warn={!!live && live.overBudget > 0.05} hint={`${budgetMs.toFixed(1)} ms / frame`} />
        <Metric label="Hand detected" value={live ? pct(live.detection) : "—"} />
        <Metric label="Confidence" value={live && live.detection > 0 ? live.confidence.toFixed(2) : "—"} />
        <Metric label="Dropped frames" value={live ? String(live.dropped) : "—"} warn={!!live && live.dropped > 0} />
      </div>

      <div className="mt-3 rounded-xl border border-border/70 p-3">
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>Inference time, last {WINDOW} frames</span>
          <span className="font-mono tabular-nums">
            {info ? `${info.delegate} · ${info.size} · model ${info.loadMs.toFixed(0)} ms` : "budget line = 1 frame"}
          </span>
        </div>
        <canvas ref={timeline} className="h-16 w-full text-muted-foreground" aria-label="Inference time per frame" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/70 p-3">
          <div className="mb-2 text-xs text-muted-foreground">Recognised</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(GESTURE_LABELS) as GestureType[])
              .filter((t) => t !== "disarm")
              .map((t) => (
                <span
                  key={t}
                  className={cn(
                    "rounded-md border px-1.5 py-0.5 text-xs tabular-nums",
                    counts[t] ? "border-brand/50 bg-brand/10 text-foreground" : "border-border text-muted-foreground",
                  )}
                >
                  {GESTURE_LABELS[t]} <span className="font-mono">{counts[t] ?? 0}</span>
                </span>
              ))}
          </div>
        </div>
        <div className="rounded-xl border border-border/70 p-3">
          <div className="mb-2 text-xs text-muted-foreground">Event log</div>
          <ol className="h-24 space-y-0.5 overflow-hidden font-mono text-xs">
            {log.length === 0 && <li className="text-muted-foreground">Discrete gestures appear here.</li>}
            {log.map((e) => (
              <li key={e.key} className="truncate">{e.text}</li>
            ))}
          </ol>
        </div>
      </div>

      {result && (
        <div className="mt-3 rounded-xl border border-brand/40 bg-brand/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium">
              Benchmark · {result.seconds.toFixed(1)} s · {result.frames} frames
            </div>
            <Button variant="ghost" size="xs" onClick={copy}>
              <HugeiconsIcon icon={Copy01Icon} size={12} />
              Copy as Markdown
            </Button>
          </div>
          <dl className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
            <Stat k="Processed" v={`${result.inferenceFps.toFixed(1)} fps (camera ${result.cameraFps.toFixed(1)})`} />
            <Stat k="Inference mean" v={`${result.inference.mean.toFixed(1)} ms`} />
            <Stat k="Inference p99 / max" v={`${result.inference.p99.toFixed(1)} / ${result.inference.max.toFixed(1)} ms`} />
            <Stat k="Latency p50 / p95" v={`${result.latency.p50.toFixed(0)} / ${result.latency.p95.toFixed(0)} ms`} />
            <Stat k="Over budget" v={pct(result.overBudget)} />
            <Stat k="Dropped" v={String(result.dropped)} />
            <Stat k="Hand detected" v={pct(result.detection)} />
            <Stat k="Delegate" v={result.delegate} />
            <Stat k="Verdict" v={result.inferenceFps >= g.targetFps * 0.95 && result.overBudget < 0.05 ? `Meets ${g.targetFps} fps` : `Below ${g.targetFps} fps`} />
          </dl>
        </div>
      )}
    </>
  );
}

function RunProgress({ until }: { until: number }) {
  const [left, setLeft] = useState(until - performance.now());
  useEffect(() => {
    const t = setInterval(() => setLeft(until - performance.now()), 100);
    return () => clearInterval(t);
  }, [until]);
  return (
    <div className="absolute inset-x-0 bottom-0 h-1 bg-black/30">
      <div className="h-full bg-brand transition-[width]" style={{ width: `${(1 - Math.max(0, left) / RUN_MS) * 100}%` }} />
    </div>
  );
}

function Metric({ label, value, warn, hint }: { label: string; value: string; warn?: boolean; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/70 px-3 py-2" title={hint}>
      <div className="truncate text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 font-mono text-sm tabular-nums", warn && "text-amber-600 dark:text-amber-400")}>{value}</div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-mono tabular-nums">{v}</dd>
    </div>
  );
}

const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

function describe(e: GestureEvent): string {
  const label = GESTURE_LABELS[e.type];
  const conf = e.confidence.toFixed(2);
  if (e.type === "swipe") return `${label} ${e.direction} · ${e.velocity.toFixed(1)}/s · ${conf}`;
  return `${label} · ${conf}`;
}

function percentiles(xs: number[]): Percentiles {
  if (!xs.length) return { mean: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  const s = [...xs].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.floor(q * s.length))];
  return { mean: s.reduce((a, b) => a + b, 0) / s.length, p50: at(0.5), p95: at(0.95), p99: at(0.99), max: s[s.length - 1] };
}

function summarise(s: Sample[], budgetMs: number): Summary {
  const seconds = s.length > 1 ? (s[s.length - 1].t - s[0].t) / 1000 : 0;
  const dropped = s.reduce((a, x) => a + x.dropped, 0);
  const withHand = s.filter((x) => x.hands > 0);
  return {
    frames: s.length,
    seconds,
    cameraFps: seconds ? (s.length - 1 + dropped) / seconds : 0,
    inferenceFps: seconds ? (s.length - 1) / seconds : 0,
    inference: percentiles(s.map((x) => x.inferenceMs)),
    latency: percentiles(s.map((x) => x.latencyMs)),
    overBudget: s.length ? s.filter((x) => x.inferenceMs > budgetMs).length / s.length : 0,
    detection: s.length ? withHand.length / s.length : 0,
    confidence: withHand.length ? withHand.reduce((a, x) => a + x.confidence, 0) / withHand.length : 0,
    dropped,
  };
}

function drawTimeline(c: HTMLCanvasElement | null, s: Sample[], budgetMs: number, palette: Palette) {
  if (!c) return;
  const dpr = window.devicePixelRatio || 1;
  const r = c.getBoundingClientRect();
  c.width = Math.round(r.width * dpr);
  c.height = Math.round(r.height * dpr);
  const ctx = c.getContext("2d")!;
  const w = c.width;
  const h = c.height;
  const top = Math.max(budgetMs * 1.5, ...s.map((x) => x.inferenceMs));
  const y = (ms: number) => h - (ms / top) * h;
  const bw = w / WINDOW;
  const muted = getComputedStyle(c).color;

  for (const [i, x] of s.entries()) {
    ctx.fillStyle = x.inferenceMs > budgetMs ? "oklch(0.78 0.16 75)" : palette.brand;
    ctx.globalAlpha = x.hands ? 0.9 : 0.4;
    ctx.fillRect(w - (s.length - i) * bw, y(x.inferenceMs), Math.max(1, bw - dpr), h - y(x.inferenceMs));
  }
  ctx.globalAlpha = 1;
  ctx.setLineDash([4 * dpr, 4 * dpr]);
  ctx.strokeStyle = muted;
  ctx.lineWidth = dpr;
  ctx.beginPath();
  ctx.moveTo(0, y(budgetMs));
  ctx.lineTo(w, y(budgetMs));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = muted;
  ctx.font = `${10 * dpr}px ui-monospace, monospace`;
  ctx.fillText(`${budgetMs.toFixed(1)} ms`, 4 * dpr, y(budgetMs) - 4 * dpr);
}

function toMarkdown(r: RunResult): string {
  const counts = Object.entries(r.counts)
    .map(([k, v]) => `${GESTURE_LABELS[k as GestureType]} ${v}`)
    .join(", ");
  return [
    `### Nexis Lens gesture benchmark`,
    ``,
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Duration | ${r.seconds.toFixed(1)} s, ${r.frames} frames |`,
    `| Delegate / resolution | ${r.delegate} / ${r.size} |`,
    `| Model load | ${r.loadMs.toFixed(0)} ms |`,
    `| Camera / processed | ${r.cameraFps.toFixed(1)} / ${r.inferenceFps.toFixed(1)} fps |`,
    `| Inference mean / p50 / p95 / p99 / max | ${[r.inference.mean, r.inference.p50, r.inference.p95, r.inference.p99, r.inference.max].map((v) => v.toFixed(1)).join(" / ")} ms |`,
    `| Latency p50 / p95 | ${r.latency.p50.toFixed(0)} / ${r.latency.p95.toFixed(0)} ms |`,
    `| Over ${r.budgetMs.toFixed(1)} ms budget | ${pct(r.overBudget)} |`,
    `| Dropped frames | ${r.dropped} |`,
    `| Hand detected | ${pct(r.detection)} (mean confidence ${r.confidence.toFixed(2)}) |`,
    `| Gestures | ${counts || "none"} |`,
    `| Platform | ${navigator.userAgent} |`,
  ].join("\n");
}

function loadErrorText(e: unknown): string {
  const text = cameraErrorText(e);
  if (/hand_landmarker|\.task|wasm|404|fetch/i.test(text)) {
    return `Could not load the hand-tracking model (${text}). Run pnpm install to fetch it into public/mediapipe.`;
  }
  return text;
}
