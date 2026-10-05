# Roadmap

Two things are on the agenda, in order, plus one stretch goal. Each builds on the command bus
(`src/modules/commands/registry.ts`): every input method — keyboard, mouse,
gesture, and later voice — only has to emit commands that already work.

---

## 1. Windows and macOS releases

**Goal:** downloadable, signed installers for both platforms, built by CI from a tag.

- [x] GitHub Actions release workflow using `tauri-apps/tauri-action`, triggered on `v*` tags, drafting a GitHub Release. See [docs/RELEASING.md](docs/RELEASING.md).
- [ ] **Windows:** NSIS installer (already configured, per-user install) plus MSI. Code-sign with Authenticode (Azure Trusted Signing or an OV/EV cert) so SmartScreen does not block first launch.
- [x] **macOS:** universal binary (`--target universal-apple-darwin`) as a `.dmg`.
- [ ] **macOS:** Developer ID signing + notarization — workflow is wired, needs the Apple secrets.
- [x] macOS hardened runtime with the `com.apple.security.device.camera` entitlement (`src-tauri/Entitlements.plist`); `NSCameraUsageDescription` is in `src-tauri/Info.plist`. Without the entitlement, a signed build silently gets no camera.
- [ ] Smoke-test each build on clean machines: borderless chrome + resize on Windows, traffic lights on macOS, opening a repo, diffs, camera permission prompt.
- [ ] Optional: `tauri-plugin-updater` with signed update manifests once the first release is out.
- [ ] Linux bundles come along for free from the same workflow; ship them as best-effort.

**Done when:** pushing a tag produces signed Windows and macOS installers attached to a GitHub Release, and both launch cleanly on machines that have never seen a dev build.

---

## 2. Gestures working

**Goal:** real hand tracking driving the existing gesture bindings, at ≥ 30 fps on an 8 GB / integrated-GPU laptop.

Everything downstream of recognition already exists and is exercised by the gesture simulator: dispatcher (arming, auto-disarm, confidence floor, cooldown, swipe-velocity floor), context-aware bindings, HUD, armed ring, camera calibration and framing. What is missing is the recogniser.

- [ ] Add `@mediapipe/tasks-vision`; bundle the WASM runtime and the hand model under `public/` (no CDN — keeps the CSP closed and works offline).
- [ ] Implement `GestureSource` in `src/modules/gestures/sources/mediapipe.ts` and register it (see the notes in `sources/index.ts`): `HandLandmarker` on the GPU delegate, driven by `requestVideoFrameCallback`.
- [ ] Normalise landmarks into the framing box and mirror x when mirroring is on.
- [ ] Pose classifiers, each with temporal smoothing:
  - open palm held still ≥ `armHoldMs` → `arm`
  - open palm moving → `palm-move`
  - thumb–index distance → `pinch`, pinch-click → `select`
  - wrist velocity over a short window → `swipe`
  - `fist`, `palm-flip`, `two-hand-spread`, `point`
- [ ] Report `FrameStats` every frame; profile against the 30 fps floor before adding gestures. If needed: drop to 480p, skip frames, or move inference into a worker with `OffscreenCanvas`.
- [ ] Tune defaults with real people talking with their hands — false positives matter more than misses.
- [ ] Unit-test the classifiers on recorded landmark sequences so tuning does not regress.

**Done when:** every row in the README's task table works hands-free on target hardware, with no accidental commands during five minutes of normal presenting.

---

## Stretch goal: voice control

**Goal:** spoken commands as a third input path — "next hunk", "zoom in", "open overview", "go to tracker dot ts" — for when hands are busy or out of frame.

A stretch goal, picked up only once releases and gestures are done. Start with a design and a spike before building it.

- [ ] **Recognition engine.** The Web Speech API is not dependable inside Tauri's webviews (WebView2 and WKWebView), so plan for on-device recognition in Rust:
  - `whisper.cpp` via `whisper-rs` (tiny / base model) for free-form phrases, or
  - a constrained-grammar recogniser (e.g. Vosk) for the fixed command set — smaller, faster, fewer false matches.
  - The spike compares latency, accuracy and CPU cost against the gesture pipeline's frame budget.
- [ ] **Activation.** Push-to-talk (hotkey or a held gesture) first; consider a wake word later. Never listen continuously by default.
- [ ] **Command mapping.** A phrase table mapped onto existing `CommandId`s, mirroring `gestures/bindings.ts`, plus a few parameterised commands (open file by name, jump to hunk N, zoom to N%).
- [ ] **Privacy and permissions.** Audio stays on the machine. Add `NSMicrophoneUsageDescription` plus the `com.apple.security.device.audio-input` entitlement on macOS, and a visible listening indicator in the HUD.
- [ ] **Shared UX.** The gesture HUD becomes an input-feedback HUD ("Voice → Next hunk"); Settings gets a Voice section alongside Gestures.

**Done when:** there is a written design and a working spike that recognises the core navigation phrases with acceptable latency on target hardware.
