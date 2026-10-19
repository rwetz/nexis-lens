# Handoff: Nexis Lens design document

You are picking up a course design-document task for Nexis Lens (Tauri v2 + React 19 + TypeScript; gesture-augmented viewer for code, git diffs and markdown). Read `README.md` and `ROADMAP.md` first.

## The assignment
A design document with four sections: (1) title, (2) a list of user tasks, one sentence each, (3) at least one low- or high-fidelity prototype per task, storyboards for multi-step tasks, each explained with Shneiderman's Eight Golden Rules, (4) optional non-interface components and how they are implemented.

## What exists (commit c8549c6)
`docs/design-document.html` is a single static file covering all four sections.

- **Section 2:** seven tasks: open a workspace, browse and read, review a diff, switch tabs and overview, zoom and present, enable and calibrate gestures, Gesture lab.
- **Section 3 (3.1 to 3.7):** HTML/CSS wireframes per task with Eight Golden Rules notes. Multi-step tasks are marked as storyboards (frames read top to bottom).
- **Section 3.8, Gesture design:** nine SVG gesture cards, an arming state-machine SVG, a camera-framing SVG, Eight Golden Rules notes, a validation plan, and numbered citations [1] to [5] with a References list.
- **Section 4:** Tauri backend, file and git handling, command bus, MediaPipe gesture pipeline, performance plan, privacy, distribution.
- **Theme:** CSS variables copied from `@nexis/design` (`../nexis-design/src/styles/globals.css`) and Lens's diff colours (`src/styles/lens.css`), with light and dark modes. Fonts (Geist, Geist Mono, Space Grotesk) load from Google Fonts and fall back to system fonts offline.

No app code was changed. Nothing is pushed.

## Decisions and corrections to know about
- **solidcv (github.com/solidsf-inc/solidcv) was considered and dropped.** It is an Apache-2.0 pure-Rust OpenCV replacement. It has no hand-landmark model, so it cannot replace MediaPipe, and it was not adopted. Lens never used OpenCV. Do not reintroduce either unless profiling shows a need.
- **No clone feature.** An earlier draft wireframed "Clone repository"; it was removed. Task 1 is open-folder only.
- **MediaPipe stays the tracker.** The roadmap's fallbacks if under 30 fps are 480p, frame skipping, or a worker with OffscreenCanvas; profile in Settings, Gesture lab first.
- **Gesture set matches `src/modules/gestures/bindings.ts`.** The design does not change the bindings.

## Research caveats (be honest about these)
Gesture design is backed by three quick web searches, not a literature review. Sources: Gunslinger (Waterloo), arXiv 2603.15991, US patent 11301049, Wobbrock et al. CHI 2009, MotionInput arXiv 2108.04357. Wobbrock studied touch surfaces, not mid-air hands, so it only supports the metaphors. The closed fist and flat-hand flip have no backing source and are labelled "untested" on their cards. The 2 m distance comes from one webcam study. I did not find Google's own MediaPipe guidance or the Nielsen gesture paper.

## Not done / next steps
- Wireframes are low-fidelity HTML/CSS; only section 3.8 has SVG illustrations. Other tasks could get SVG mockups.
- Checked only in the in-app preview pane: not checked at phone width, in dark mode, or printed.
- If a PDF or Word file is needed for submission, export from the HTML (nothing generated yet).
- Run the guessability test and Gesture lab benchmark described in 3.8 and record results.
- Verify the cited claims against the sources before submitting.
