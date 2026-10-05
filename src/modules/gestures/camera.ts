// Webcam access for the gesture pipeline and the calibration preview.
// Everything stays local: frames go from getUserMedia straight into the
// recogniser in this webview, never over IPC or the network.
import type { GestureConfig } from "./store";

const RESOLUTIONS = { "480p": { width: 640, height: 480 }, "720p": { width: 1280, height: 720 } };

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === "videoinput");
}

export async function openCamera(
  cfg: Pick<GestureConfig, "cameraId" | "resolution" | "targetFps">,
): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is not available in this webview.");
  const { width, height } = RESOLUTIONS[cfg.resolution];
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      deviceId: cfg.cameraId ? { exact: cfg.cameraId } : undefined,
      width: { ideal: width },
      height: { ideal: height },
      frameRate: { ideal: cfg.targetFps },
    },
  });
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}

export function cameraErrorText(e: unknown): string {
  if (e instanceof DOMException) {
    if (e.name === "NotAllowedError") return "Camera permission was denied.";
    if (e.name === "NotFoundError" || e.name === "OverconstrainedError") return "No matching camera was found.";
    if (e.name === "NotReadableError") return "The camera is in use by another application.";
  }
  return e instanceof Error ? e.message : String(e);
}
