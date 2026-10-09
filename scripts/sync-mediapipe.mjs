// Copies the MediaPipe WASM runtime into public/ and fetches the hand
// landmark model once, so hand tracking is served from the app itself — no
// CDN at runtime, the CSP stays closed and it works offline.
//
// Runs on postinstall. The model is checked against a pinned SHA-256.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "mediapipe");
const wasmSrc = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");

// FilesetResolver picks the SIMD build when supported, the no-SIMD one otherwise.
const WASM = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const MODEL_SHA256 = "fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1";

mkdirSync(join(out, "wasm"), { recursive: true });
for (const f of WASM) copyFileSync(join(wasmSrc, f), join(out, "wasm", f));
console.log(`mediapipe: wasm -> ${join(out, "wasm")}`);

const modelPath = join(out, "hand_landmarker.task");
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

if (existsSync(modelPath) && sha(readFileSync(modelPath)) === MODEL_SHA256) {
  console.log("mediapipe: hand model present");
} else {
  console.log(`mediapipe: fetching ${MODEL_URL}`);
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`mediapipe: model download failed (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = sha(buf);
  if (got !== MODEL_SHA256) throw new Error(`mediapipe: model checksum mismatch (got ${got})`);
  writeFileSync(modelPath, buf);
  console.log(`mediapipe: hand model -> ${modelPath}`);
}
