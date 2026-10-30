# Nexis Lens

A gesture-augmented viewer for presenting code, git diffs and markdown. Keyboard and mouse do everything; hand gestures (MediaPipe) are an extra layer. Tauri 2, React 19, TypeScript.

Workspace rules live in `Dev/AGENTS.md`.

## Design family

Nexis (Frosted Glass). Styled with `@nexis/design`, shadcn/ui and a few React Bits pieces. Contract: `nexis-suite/nexis-design/AGENTS.md`.

## Commands (pnpm)

| Task | Command |
|---|---|
| Dev | `pnpm dev` |
| Test | `pnpm test` (vitest) |
| Typecheck | `pnpm typecheck` |
| Build | `pnpm build` |
| Desktop shell | `pnpm tauri ...` (avoid local Rust builds; let CI build) |

`postinstall` syncs design assets and MediaPipe files; do not skip it.

## Layout

| Path | What lives there |
|---|---|
| `src/` | React app |
| `src-tauri/` | Tauri shell (Rust) |
| `scripts/` | Asset and MediaPipe sync |
| `ROADMAP.md` | What is next |
| `docs/` | Notes |

## Do not touch

- Gestures never replace the keyboard and mouse path; every action must stay reachable without a camera.
- `.mcp.json` is local configuration.
