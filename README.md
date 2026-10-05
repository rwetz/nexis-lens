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
           (to build)       types.ts        arming,        context →
                                            confidence,    command
                                            cooldown
```

- `src/modules/gestures/types.ts` — the event vocabulary and the
  `GestureSource` interface a recogniser implements.
- `src/modules/gestures/sources/index.ts` — the registry, and the plan for the
  MediaPipe Hands implementation. **This is where hand tracking goes.**
  Register a source and `GestureController` will open the camera and start it
  when gesture mode is on.
- `src/modules/gestures/dispatcher.ts` — confidence floor, arming gate,
  auto-disarm, discrete-gesture cooldown, swipe-velocity floor.
- `src/modules/gestures/bindings.ts` — gesture × context → command table
  (also rendered in Settings → Gestures).
- `GestureSimulator` (Settings → Gestures → Gesture simulator) fires synthetic
  events through the real dispatcher, so bindings, arming and the HUD can be
  exercised before recognition exists.
- Settings → Camera opens a live preview, lets you drag the tracking box, and
  measures the frame rate the camera actually delivers against the 30 fps floor.

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
