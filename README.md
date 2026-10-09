# Nexis Lens

A gesture-augmented viewer for presenting code, git diffs and markdown. Keyboard
and mouse do everything; hand gestures are an extra layer for when you step
back from the laptop to stay on camera or in front of a room.

Tauri v2 + React 19 + TypeScript, styled with [`@nexis/design`](https://github.com/rwetz/nexis-design)
(tokens, theme engine, borderless chrome, cursors), shadcn/ui components and a
few [React Bits](https://reactbits.dev) pieces (Aurora, BlurText, ShinyText,
SpotlightCard).

## Run

```bash
pnpm install          # also syncs the design-system cursors into public/
pnpm tauri dev        # native app
pnpm dev              # browser only — serves an in-memory demo workspace
```

## What works today

| Task | Keyboard / mouse | Gesture (binding) |
| --- | --- | --- |
| Open and browse files | Sidebar tree, scroll, select, `Ctrl+F` | Palm scroll, pinch zoom |
| Zoom | `Ctrl+=` / `Ctrl+-` / `Ctrl+0`, `Ctrl+9` fit, Ctrl+wheel / trackpad pinch | Pinch |
| Switch tabs | Click, `Ctrl+Tab` / `Ctrl+Shift+Tab` | Swipe left / right |
| Review a diff | Changes tab, `]` / `[` hunks, `Ctrl+Shift+U` unified/split | Swipe up / down, fist |
| Markdown raw / preview | Toolbar toggle, `Ctrl+Shift+V` | Flat-hand flip |
| Session overview | `Ctrl+G`, arrows, Enter | Two-hand spread, point, pinch/hold |
| Presentation mode | `F5` (fullscreen, chrome hidden) | — |
| Settings & calibration | `Ctrl+,` | Not gesture-controlled, by design |

Diffs come from the git CLI: working tree (staged / unstaged / untracked, per
file or whole tree) and any commit from the History list.

## How gesture support plugs in

Everything is driven by a **command bus** (`src/modules/commands/registry.ts`).
Shortcuts, toolbar buttons and gestures all call `runCommand(id, args, source)`;
views register handlers for the commands they own while they are active. No
view knows which device triggered it.

```
camera ─▶ GestureSource ─▶ GestureEvent ─▶ dispatcher ─▶ bindings ─▶ runCommand ─▶ active view
           (MediaPipe)      types.ts        arming,        context →
                                            confidence,    command
                                            cooldown
```

- `src/modules/gestures/types.ts` — the event vocabulary and the
  `GestureSource` interface a recogniser implements.
- `src/modules/gestures/sources/mediapipe.ts` — MediaPipe HandLandmarker
  (GPU delegate, CPU fallback) driven by `requestVideoFrameCallback`; registered
  in `sources/index.ts`. The WASM runtime and model are served from
  `public/mediapipe/`, which `pnpm install` fills (`scripts/sync-mediapipe.mjs`).
- `src/modules/gestures/recognizer.ts` — pure landmarks → pose → gesture
  events logic (arm, palm-move, pinch, select, swipe, fist, flip, spread,
  point). No camera or MediaPipe imports, so it can be driven by recordings.
- `src/modules/gestures/dispatcher.ts` — confidence floor, arming gate,
  auto-disarm, discrete-gesture cooldown, swipe-velocity floor.
- `src/modules/gestures/bindings.ts` — gesture × context → command table
  (also rendered in Settings → Gestures).
- `GestureSimulator` (Settings → Gestures → Gesture simulator) fires synthetic
  events through the real dispatcher, so bindings, arming and the HUD can be
  exercised without a camera.
- Settings → Camera opens a live preview, lets you drag the tracking box, and
  measures the frame rate the camera actually delivers against the 30 fps floor.
- Settings → Gesture lab runs the real pipeline on its own camera stream, draws
  the tracked hands, poses and recognised gestures over the preview, and
  benchmarks it: camera vs processed fps, inference p50/p95, capture-to-result
  latency, frames over budget, dropped frames, detection rate. A 10 s run gives
  a summary you can copy as Markdown. Settings → Gestures → Tracking overlay
  draws the same hand skeletons over the app while gesture mode is on.

## Layout

```
src/
  app/App.tsx               provider stack + shell
  lib/                      ipc (typed Tauri calls + browser demo), paths, highlighting
  modules/
    commands/               command bus, keymap
    gestures/               event types, dispatcher, bindings, camera, HUD, simulator
    tabs/                   open items + per-tab view state (zoom, scroll, layout)
    viewer/                 code (CodeMirror), markdown, image, shared scroll/zoom
    diff/                   unified-diff parser, unified/split diff view
    overview/               session overview grid
    workspace/              folder, file tree, git changes + history
    settings/               preferences, camera calibration
    shell/                  title bar, sidebar, status bar, app commands
src-tauri/src/
  fs.rs                     open folder, gitignore-aware listing, read files
  git.rs                    status, diff, log, show via the git CLI
```

## License

[Apache-2.0](LICENSE), matching the rest of the Nexis family.
