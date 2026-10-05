// The command bus — the single seam between *input* and *behaviour*.
//
// Keyboard shortcuts, toolbar clicks and (later) recognised hand gestures all
// end up as `runCommand(id, args, source)`. Nothing in the UI listens for a
// specific input device; it registers handlers for commands. That is what
// keeps gesture support additive: a gesture recogniser only has to emit
// commands that already work from the keyboard.
//
// Handlers are a stack per command. The most recently registered handler
// runs first, and may return `false` to let the next one try — so the active
// viewer can claim `view.zoom` while it is mounted and the claim disappears
// with it.

export type Point = { x: number; y: number };

export interface CommandArgs {
  /** Scroll the active view. `dy` in px, or `pages` as a fraction of the viewport. */
  "view.scroll": { dy?: number; pages?: number; smooth?: boolean };
  /** Multiply the zoom level. `focus` is a viewport point (0..1) to zoom around. */
  "view.zoom": { factor: number; focus?: Point };
  "view.zoomReset": void;
  /** Zoom out until the whole document fits — the "overview of the file". */
  "view.zoomFit": void;
  "view.scrollTop": void;
  "view.scrollBottom": void;
  "tabs.next": void;
  "tabs.prev": void;
  "tabs.close": void;
  "diff.nextHunk": void;
  "diff.prevHunk": void;
  "diff.toggleLayout": void;
  "markdown.toggleMode": void;
  "overview.toggle": void;
  "overview.open": void;
  "overview.close": void;
  /** Move the overview highlight by grid cells. */
  "overview.move": { dx: number; dy: number };
  /** Highlight the overview item under a viewport point (0..1) — gesture pointing. */
  "overview.pointAt": Point;
  "overview.select": void;
  "workspace.openFolder": void;
  "workspace.refresh": void;
  "sidebar.toggle": void;
  "settings.open": void;
  "gestures.toggle": void;
  "present.toggle": void;
}

export type CommandId = keyof CommandArgs;
export type CommandSource = "keyboard" | "mouse" | "gesture";

type ArgsOf<K extends CommandId> = CommandArgs[K] extends void ? undefined : CommandArgs[K];
export type CommandHandler<K extends CommandId> = (
  args: ArgsOf<K>,
  source: CommandSource,
) => boolean | void;

export type CommandRecord = {
  id: CommandId;
  args: unknown;
  source: CommandSource;
  handled: boolean;
  at: number;
};

/** Human labels — used by the shortcut list, the gesture HUD and tooltips. */
export const COMMAND_TITLES: Record<CommandId, string> = {
  "view.scroll": "Scroll",
  "view.zoom": "Zoom",
  "view.zoomReset": "Reset zoom",
  "view.zoomFit": "Zoom to fit",
  "view.scrollTop": "Jump to top",
  "view.scrollBottom": "Jump to bottom",
  "tabs.next": "Next tab",
  "tabs.prev": "Previous tab",
  "tabs.close": "Close tab",
  "diff.nextHunk": "Next hunk",
  "diff.prevHunk": "Previous hunk",
  "diff.toggleLayout": "Unified / split diff",
  "markdown.toggleMode": "Raw / preview",
  "overview.toggle": "Session overview",
  "overview.open": "Open overview",
  "overview.close": "Close overview",
  "overview.move": "Move highlight",
  "overview.pointAt": "Point",
  "overview.select": "Select",
  "workspace.openFolder": "Open folder",
  "workspace.refresh": "Refresh workspace",
  "sidebar.toggle": "Toggle sidebar",
  "settings.open": "Settings",
  "gestures.toggle": "Toggle gesture mode",
  "present.toggle": "Presentation mode",
};

const handlers = new Map<CommandId, CommandHandler<CommandId>[]>();
const listeners = new Set<(r: CommandRecord) => void>();

export function registerCommand<K extends CommandId>(id: K, handler: CommandHandler<K>): () => void {
  const stack = handlers.get(id) ?? [];
  const h = handler as unknown as CommandHandler<CommandId>;
  stack.push(h);
  handlers.set(id, stack);
  return () => {
    const s = handlers.get(id);
    if (!s) return;
    const i = s.lastIndexOf(h);
    if (i >= 0) s.splice(i, 1);
  };
}

export function runCommand<K extends CommandId>(
  id: K,
  ...rest: CommandArgs[K] extends void
    ? [args?: undefined, source?: CommandSource]
    : [args: CommandArgs[K], source?: CommandSource]
): boolean {
  const [args, source = "keyboard"] = rest as [ArgsOf<K>, CommandSource | undefined];
  const stack = handlers.get(id) ?? [];
  let handled = false;
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i](args as never, source) !== false) {
      handled = true;
      break;
    }
  }
  const record: CommandRecord = { id, args, source, handled, at: performance.now() };
  listeners.forEach((l) => l(record));
  return handled;
}

/** Observe every command run (HUD feedback, telemetry, latency profiling). */
export function onCommand(listener: (r: CommandRecord) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
