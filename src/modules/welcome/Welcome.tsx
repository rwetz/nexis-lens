// First-run / no-workspace screen.
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Folder01Icon, FolderOpenIcon } from "@hugeicons/core-free-icons";
import { useTheme } from "@nexis/design";
import Aurora from "@/components/reactbits/Aurora";
import BlurText from "@/components/reactbits/BlurText";
import ShinyText from "@/components/reactbits/ShinyText";
import { AppLogo } from "@/components/AppLogo";
import { Button } from "@/components/ui/button";
import { formatKeys } from "@/modules/commands/keymap";
import { openFolderFlow } from "@/modules/shell/useAppCommands";
import { useWorkspace } from "@/modules/workspace/store";
import { IN_TAURI } from "@/lib/ipc";

export function Welcome() {
  const recent = useWorkspace((s) => s.recent);
  const forget = useWorkspace((s) => s.forgetRecent);
  const loading = useWorkspace((s) => s.loading);
  const { resolvedMode } = useTheme();
  const dark = resolvedMode === "dark";

  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[55%] opacity-70">
        <Aurora
          colorStops={dark ? ["#2a2f36", "#f0806a", "#3a4150"] : ["#dfe3e8", "#f5a08e", "#cfd6de"]}
          amplitude={0.9}
          blend={0.55}
          speed={0.6}
          lightMode={!dark}
        />
      </div>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
        <AppLogo className="mb-6 size-14" />
        <BlurText
          text="Nexis Lens"
          animateBy="letters"
          delay={45}
          className="justify-center text-4xl font-semibold tracking-tight"
        />
        <ShinyText
          text="Present code, diffs and docs — from the keyboard or across the room."
          speed={3.5}
          className="mt-3 text-sm"
          color="var(--muted-foreground)"
          shineColor="var(--foreground)"
        />

        <Button size="lg" className="mt-8 gap-2" disabled={loading} onClick={() => void openFolderFlow()}>
          <HugeiconsIcon icon={FolderOpenIcon} size={16} />
          {IN_TAURI ? "Open folder" : "Open demo workspace"}
          <span className="ml-1 font-mono text-xs opacity-60">{formatKeys("Mod+O")}</span>
        </Button>

        {recent.length > 0 && (
          <div className="mt-10 w-full text-left">
            <h3 className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Recent</h3>
            <ul className="overflow-hidden rounded-xl border border-border/70 bg-card/70 backdrop-blur">
              {recent.map((r) => (
                <li key={r.root} className="group flex items-center border-b border-border/50 last:border-0">
                  <button
                    type="button"
                    onClick={() => void openFolderFlow(r.root)}
                    className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left hover:bg-accent/60"
                  >
                    <HugeiconsIcon icon={Folder01Icon} size={15} className="shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{r.name}</span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">{r.root}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${r.name} from recent`}
                    onClick={() => forget(r.root)}
                    className="mr-2 rounded p-1 text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
