import { useEffect, useRef } from "react";
import { registerCommand, type CommandHandler, type CommandId } from "./registry";

/** Register a command handler for the lifetime of the component. The latest
 * closure is always called, so handlers can read fresh props/state without
 * re-registering (which would reorder the handler stack). */
export function useCommand<K extends CommandId>(
  id: K,
  handler: CommandHandler<K>,
  enabled = true,
): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    return registerCommand(id, ((args, source) => ref.current(args, source)) as CommandHandler<K>);
  }, [id, enabled]);
}
