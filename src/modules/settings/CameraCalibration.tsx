// Camera setup and framing. Opens the camera only while this panel is
// visible, shows a live preview with the tracking box (drag on the preview to
// redraw it), and measures the frame rate the camera actually delivers — the
// ceiling for the gesture pipeline's 30 fps floor.
import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, Camera01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cameraErrorText, listCameras, openCamera, stopStream } from "@/modules/gestures/camera";
import { DEFAULT_GESTURE_CONFIG, useGestures } from "@/modules/gestures/store";
import { Segmented } from "@/modules/viewer/ViewerToolbar";
import { Field, SectionTitle } from "./SettingsDialog";

const DEFAULT_CAMERA = "__default";

export function CameraCalibration() {
  const g = useGestures();
  const set = g.setConfig;
  const video = useRef<HTMLVideoElement>(null);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [measuredFps, setMeasuredFps] = useState<number | null>(null);
  const [size, setSize] = useState<string | null>(null);

  useEffect(() => {
    void listCameras().then(setCameras).catch(() => setCameras([]));
  }, [previewing]);

  useEffect(() => {
    if (!previewing) return;
    let stream: MediaStream | null = null;
    let live = true;
    let handle = 0;
    setError(null);
    (async () => {
      try {
        stream = await openCamera(g);
        const v = video.current;
        if (!live || !v) return;
        v.srcObject = stream;
        await v.play();
        setSize(`${v.videoWidth}×${v.videoHeight}`);
        // Count presented frames over a sliding second.
        const stamps: number[] = [];
        const tick = (now: number) => {
          stamps.push(now);
          while (stamps.length && now - stamps[0] > 1000) stamps.shift();
          setMeasuredFps(stamps.length);
          if (live) handle = v.requestVideoFrameCallback(tick);
        };
        if ("requestVideoFrameCallback" in v) handle = v.requestVideoFrameCallback(tick);
      } catch (e) {
        if (live) setError(cameraErrorText(e));
      }
    })();
    return () => {
      live = false;
      if (video.current && handle) video.current.cancelVideoFrameCallback?.(handle);
      stopStream(stream);
      setMeasuredFps(null);
    };
    // Re-open when the camera choice changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewing, g.cameraId, g.resolution, g.targetFps]);

  return (
    <>
      <SectionTitle description="Calibrate once per room. Video is processed on this machine and never leaves it.">
        Camera & framing
      </SectionTitle>

      <Field label="Camera">
        <Select value={g.cameraId ?? DEFAULT_CAMERA} onValueChange={(v) => set({ cameraId: v === DEFAULT_CAMERA ? null : v })}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_CAMERA}>System default</SelectItem>
            {cameras
              .filter((c) => c.deviceId)
              .map((c, i) => (
                <SelectItem key={c.deviceId} value={c.deviceId}>
                  {c.label || `Camera ${i + 1}`}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Resolution" hint="480p is plenty for hand tracking and cheaper on integrated GPUs.">
        <Segmented value={g.resolution} onChange={(resolution) => set({ resolution })} options={[{ value: "480p", label: "480p" }, { value: "720p", label: "720p" }]} />
      </Field>
      <Field label="Target frame rate" hint="30 fps is the floor on 8 GB / integrated-GPU laptops; 45 is the stretch goal.">
        <Segmented
          value={String(g.targetFps) as "30" | "45"}
          onChange={(v) => set({ targetFps: v === "45" ? 45 : 30 })}
          options={[{ value: "30", label: "30 fps" }, { value: "45", label: "45 fps" }]}
        />
      </Field>
      <Field label="Mirror" hint="Match what you see in a video call.">
        <Switch checked={g.mirror} onCheckedChange={(mirror) => set({ mirror })} />
      </Field>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm">Preview & tracking area</div>
          <div className="flex items-center gap-2">
            {previewing && (
              <Button variant="ghost" size="xs" onClick={() => set({ framing: DEFAULT_GESTURE_CONFIG.framing })}>
                Reset area
              </Button>
            )}
            <Button variant={previewing ? "outline" : "default"} size="sm" onClick={() => setPreviewing((p) => !p)}>
              <HugeiconsIcon icon={Camera01Icon} size={14} />
              {previewing ? "Stop preview" : "Start preview"}
            </Button>
          </div>
        </div>

        <FramingPreview
          videoRef={video}
          active={previewing}
          mirror={g.mirror}
          framing={g.framing}
          onFraming={(framing) => set({ framing })}
        />

        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Drag on the preview to set where your hand is tracked.</span>
          {previewing && measuredFps !== null && (
            <span className={cn("font-mono tabular-nums", measuredFps < 30 ? "text-amber-500" : "text-foreground")}>
              {size} · {measuredFps} fps from camera
            </span>
          )}
        </div>
        {error && (
          <p className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <HugeiconsIcon icon={Alert02Icon} size={14} />
            {error}
          </p>
        )}
        {previewing && measuredFps !== null && measuredFps < 24 && (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
            The camera is delivering fewer frames than the gesture pipeline needs. More light usually helps — many webcams
            drop their frame rate to lengthen exposure in dim rooms.
          </p>
        )}
      </div>
    </>
  );
}

type Framing = { x: number; y: number; w: number; h: number };

function FramingPreview({
  videoRef,
  active,
  mirror,
  framing,
  onFraming,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  active: boolean;
  mirror: boolean;
  framing: Framing;
  onFraming: (f: Framing) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Framing | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  // Pointer position in display coordinates — the space gesture events use.
  const toFrame = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };

  const shown = draft ?? framing;

  return (
    <div
      ref={box}
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-muted/40",
        active && "cursor-crosshair",
      )}
      onPointerDown={(e) => {
        if (!active) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = toFrame(e);
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const p = toFrame(e);
        const s = start.current;
        setDraft({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
      }}
      onPointerUp={() => {
        if (draft && draft.w > 0.1 && draft.h > 0.1) onFraming(draft);
        setDraft(null);
        start.current = null;
      }}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        className={cn("absolute inset-0 size-full object-cover", mirror && "-scale-x-100", !active && "hidden")}
      />
      {!active && (
        <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">Camera off</div>
      )}
      {/* The framing box is stored in display (post-mirror) coordinates, which
          is what the recogniser is specified to emit. */}
      <div
        className="pointer-events-none absolute rounded-lg border-2 border-brand/80 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]"
        style={{ left: `${shown.x * 100}%`, top: `${shown.y * 100}%`, width: `${shown.w * 100}%`, height: `${shown.h * 100}%` }}
      />
    </div>
  );
}
