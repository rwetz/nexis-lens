// Keyboard bindings. Each entry maps a chord to a command on the bus; the
// same commands are what gestures will fire, so this table doubles as the
// reference for "what can be done hands-free".
import { useEffect } from "react";
import { IS_MAC } from "@nexis/design";
import { useUi } from "@/modules/shell/uiStore";
import { runCommand, type CommandArgs, type CommandId } from "./registry";

type Binding = {
  [K in CommandId]: {
    /** `Mod` = Cmd on macOS, Ctrl elsewhere. Key names follow KeyboardEvent.key. */
    keys: string;
    command: K;
    args?: CommandArgs[K];
    /** Only active when this returns true. */
    when?: () => boolean;
    /** Show in the shortcuts list (default true). */
    listed?: boolean;
  };
}[CommandId];

const overviewOpen = () => useUi.getState().overviewOpen;
const notOverview = () => !useUi.getState().overviewOpen;
const noModal = () => !useUi.getState().settingsOpen;

export const KEYMAP: Binding[] = [
  { keys: "Mod+O", command: "workspace.openFolder" },
  { keys: "Mod+R", command: "workspace.refresh" },
  { keys: "Mod+B", command: "sidebar.toggle" },
  { keys: "Mod+,", command: "settings.open" },
  { keys: "Mod+Tab", command: "tabs.next" },
  { keys: "Mod+Shift+Tab", command: "tabs.prev" },
  { keys: "Mod+PageDown", command: "tabs.next", listed: false },
  { keys: "Mod+PageUp", command: "tabs.prev", listed: false },
  { keys: "Mod+W", command: "tabs.close" },
  { keys: "Mod+=", command: "view.zoom", args: { factor: 1.15 } },
  { keys: "Mod++", command: "view.zoom", args: { factor: 1.15 }, listed: false },
  { keys: "Mod+-", command: "view.zoom", args: { factor: 1 / 1.15 } },
  { keys: "Mod+0", command: "view.zoomReset" },
  { keys: "Mod+9", command: "view.zoomFit" },
  { keys: "]", command: "diff.nextHunk", when: notOverview },
  { keys: "[", command: "diff.prevHunk", when: notOverview },
  { keys: "Alt+ArrowDown", command: "diff.nextHunk", when: notOverview, listed: false },
  { keys: "Alt+ArrowUp", command: "diff.prevHunk", when: notOverview, listed: false },
  { keys: "Mod+Shift+U", command: "diff.toggleLayout" },
  { keys: "Mod+Shift+V", command: "markdown.toggleMode" },
  { keys: "Mod+G", command: "overview.toggle" },
  { keys: "Escape", command: "overview.close", when: overviewOpen, listed: false },
  { keys: "ArrowLeft", command: "overview.move", args: { dx: -1, dy: 0 }, when: overviewOpen, listed: false },
  { keys: "ArrowRight", command: "overview.move", args: { dx: 1, dy: 0 }, when: overviewOpen, listed: false },
  { keys: "ArrowUp", command: "overview.move", args: { dx: 0, dy: -1 }, when: overviewOpen, listed: false },
  { keys: "ArrowDown", command: "overview.move", args: { dx: 0, dy: 1 }, when: overviewOpen, listed: false },
  { keys: "Enter", command: "overview.select", when: overviewOpen, listed: false },
  { keys: "Mod+Shift+G", command: "gestures.toggle" },
  { keys: "F5", command: "present.toggle" },
];

function chordOf(e: KeyboardEvent): string {
  const parts: string[] = [];
  const mod = IS_MAC ? e.metaKey : e.ctrlKey;
  if (mod) parts.push("Mod");
  if (e.altKey) parts.push("Alt");
  // Shift is implied by the character for printable symbols ("+", "?").
  const printable = e.key.length === 1 && !/[a-z0-9]/i.test(e.key);
  if (e.shiftKey && !printable) parts.push("Shift");
  parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
  return parts.join("+");
}

function splitKeys(keys: string): string[] {
  // "Mod++" — the key itself is "+".
  return keys.endsWith("++") ? [...keys.slice(0, -2).split("+"), "+"] : keys.split("+");
}

const normalize = (keys: string) =>
  splitKeys(keys)
    .map((k, i, all) => (i === all.length - 1 && k.length === 1 ? k.toUpperCase() : k))
    .join("+");

const TABLE = KEYMAP.map((b) => ({ ...b, chord: normalize(b.keys) }));

/** Render a binding for display, e.g. "Ctrl+Shift+U" or "⌘⇧U". */
export function formatKeys(keys: string): string {
  const map: Record<string, string> = IS_MAC
    ? { Mod: "⌘", Shift: "⇧", Alt: "⌥", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Escape: "Esc" }
    : { Mod: "Ctrl", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Escape: "Esc" };
  const parts = splitKeys(keys);
  return parts.map((p) => map[p] ?? p).join(IS_MAC ? "" : "+");
}

export function shortcutFor(command: CommandId): string | null {
  const b = KEYMAP.find((k) => k.command === command && k.listed !== false);
  return b ? formatKeys(b.keys) : null;
}

function isTextInput(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.closest(".cm-editor")) return false; // read-only editor: our keys still apply
  return t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
}

export function useKeybindings(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const chord = chordOf(e);
      const typing = isTextInput(e.target);
      for (const b of TABLE) {
        if (b.chord !== chord) continue;
        // Bare keys ("[", "Enter") never fire while typing in a field.
        if (typing && !chord.includes("Mod")) continue;
        if (b.command !== "settings.open" && !noModal()) continue;
        if (b.when && !b.when()) continue;
        e.preventDefault();
        (runCommand as (id: CommandId, args: unknown, src: "keyboard") => boolean)(
          b.command,
          b.args,
          "keyboard",
        );
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
