// Entry point — Nexis design system bootstrap.
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "./styles/globals.css";

import { getCurrentWindow } from "@tauri-apps/api/window";
import ReactDOM from "react-dom/client";
import { USE_CUSTOM_WINDOW_CONTROLS } from "@nexis/design";
import App from "./app/App";
import { IN_TAURI } from "./lib/ipc";

// Non-macOS: we paint our own rounded, borderless frame (see globals.css
// html[data-chrome="borderless"]). macOS keeps native traffic lights.
if (USE_CUSTOM_WINDOW_CONTROLS) {
  document.documentElement.dataset.chrome = "borderless";
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<App />);

// The window is created hidden (tauri.conf.json `visible: false`) so users never
// see a transparent shadow-only frame before React's first paint. setTimeout,
// not rAF — rAF is throttled while hidden. The second call is a safety net.
if (IN_TAURI) {
  const show = () => void getCurrentWindow().show().catch((e) => console.error("window.show failed:", e));
  setTimeout(show, 50);
  setTimeout(show, 500);
}
