// Owns the camera + recogniser lifecycle while gesture mode is on, and the
// commands that toggle it. Renders a hidden <video> the recogniser reads.
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useCommand } from "@/modules/commands/useCommand";
import { cameraErrorText, openCamera, stopStream } from "./camera";
import { dispatchGesture, setArmed } from "./dispatcher";
import { createGestureSource } from "./sources";
import { useGestures } from "./store";

export function GestureController() {
  const video = useRef<HTMLVideoElement>(null);
  const enabled = useGestures((s) => s.enabled);
  const cameraId = useGestures((s) => s.cameraId);
  const resolution = useGestures((s) => s.resolution);
  const targetFps = useGestures((s) => s.targetFps);
  const delegate = useGestures((s) => s.delegate);
  const labActive = useGestures((s) => s.labActive);
  const setRuntime = useGestures((s) => s.setRuntime);

  useCommand("gestures.toggle", () => {
    const next = !useGestures.getState().enabled;
    useGestures.getState().setConfig({ enabled: next });
    toast(next ? "Gesture mode on" : "Gesture mode off", {
      description: next ? "Keyboard and mouse keep working as usual." : undefined,
    });
  });

  useEffect(() => {
    if (!enabled) {
      setArmed(false);
      setRuntime({ status: "off", statusDetail: undefined, stats: null });
      return;
    }
    if (labActive) {
      setRuntime({ status: "starting", statusDetail: "Paused while the Gesture lab is using the camera." });
      return;
    }
    const source = createGestureSource();
    if (!source) {
      setRuntime({
        status: "unavailable",
        statusDetail: "No hand-tracking recogniser is installed yet. Use the gesture simulator to try bindings.",
      });
      return;
    }

    let stream: MediaStream | null = null;
    let cancelled = false;
    setRuntime({ status: "starting", statusDetail: undefined });
    (async () => {
      try {
        stream = await openCamera({ cameraId, resolution, targetFps });
        if (cancelled || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        await source.start({
          video: video.current,
          emit: dispatchGesture,
          stats: (stats) => {
            const st = useGestures.getState();
            const status = stats.hands === 0 ? "no-hand" : st.status === "low-confidence" ? st.status : "tracking";
            st.setRuntime({ stats, status });
          },
        });
        if (!cancelled) setRuntime({ status: "tracking" });
      } catch (e) {
        if (!cancelled) setRuntime({ status: "error", statusDetail: cameraErrorText(e) });
      }
    })();

    return () => {
      cancelled = true;
      source.stop();
      stopStream(stream);
      if (video.current) video.current.srcObject = null;
    };
  }, [enabled, labActive, cameraId, resolution, targetFps, delegate, setRuntime]);

  return <video ref={video} className="hidden" muted playsInline aria-hidden />;
}
