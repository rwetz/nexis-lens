// Settings. Deliberately keyboard/mouse-only — calibration is a setup step,
// not a live-presentation action, so the gesture dispatcher ignores input
// while this dialog is open.
import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Camera01Icon,
  CommandIcon,
  PaintBoardIcon,
  Hold04Icon,
  TextIcon,
} from "@hugeicons/core-free-icons";
import { BUILTIN_THEMES, useTheme } from "@nexis/design";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { COMMAND_TITLES } from "@/modules/commands/registry";
import { formatKeys, KEYMAP } from "@/modules/commands/keymap";
import { CONTEXT_LABELS, GESTURE_BINDINGS } from "@/modules/gestures/bindings";
import { DEFAULT_GESTURE_CONFIG, useGestures } from "@/modules/gestures/store";
import { useUi, type SettingsSection } from "@/modules/shell/uiStore";
import { Segmented } from "@/modules/viewer/ViewerToolbar";
import { CameraCalibration } from "./CameraCalibration";
import { useSettings } from "./store";

const SECTIONS: { id: SettingsSection; label: string; icon: typeof TextIcon }[] = [
  { id: "appearance", label: "Appearance", icon: PaintBoardIcon },
  { id: "viewer", label: "Viewer", icon: TextIcon },
  { id: "gestures", label: "Gestures", icon: Hold04Icon },
  { id: "camera", label: "Camera", icon: Camera01Icon },
  { id: "shortcuts", label: "Shortcuts", icon: CommandIcon },
];

export function SettingsDialog() {
  const open = useUi((s) => s.settingsOpen);
  const setOpen = useUi((s) => s.setSettingsOpen);
  const section = useUi((s) => s.settingsSection);
  const setSection = useUi((s) => s.setSettingsSection);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex h-[min(640px,calc(100vh-4rem))] gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-3xl">
        <nav className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-border/60 bg-muted/30 p-3">
          <DialogTitle className="px-2 pb-3 pt-1 text-sm font-semibold">Settings</DialogTitle>
          <DialogDescription className="sr-only">Nexis Lens preferences</DialogDescription>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={cn(
                "flex h-8 items-center gap-2 rounded-lg px-2 text-left text-sm transition-colors",
                section === s.id ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <HugeiconsIcon icon={s.icon} size={15} />
              {s.label}
            </button>
          ))}
        </nav>
        <div className="nexis-scrollbar min-w-0 flex-1 overflow-y-auto p-6">
          {section === "appearance" && <Appearance />}
          {section === "viewer" && <Viewer />}
          {section === "gestures" && <Gestures />}
          {section === "camera" && <CameraCalibration />}
          {section === "shortcuts" && <Shortcuts />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border/50 py-3 last:border-0">
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-3">{children}</div>
    </div>
  );
}

export function SliderField({
  label,
  hint,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  hint?: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <Slider className="w-40" min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} />
      <span className="w-14 text-right font-mono text-xs tabular-nums text-muted-foreground">{format(value)}</span>
    </Field>
  );
}

export function SectionTitle({ children, description }: { children: ReactNode; description?: ReactNode }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold tracking-tight">{children}</h2>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

function Appearance() {
  const { mode, setMode, themeId, setThemeId } = useTheme();
  return (
    <>
      <SectionTitle>Appearance</SectionTitle>
      <Field label="Mode">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "System" },
          ]}
        />
      </Field>
      <Field label="Theme">
        <Select value={themeId} onValueChange={setThemeId}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BUILTIN_THEMES.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </>
  );
}

function Viewer() {
  const s = useSettings();
  return (
    <>
      <SectionTitle>Viewer</SectionTitle>
      <SliderField
        label="Base font size"
        hint="Per-tab zoom multiplies this."
        value={s.fontSize}
        min={11}
        max={22}
        step={1}
        format={(v) => `${v}px`}
        onChange={(fontSize) => s.set({ fontSize })}
      />
      <Field label="Line numbers">
        <Switch checked={s.lineNumbers} onCheckedChange={(lineNumbers) => s.set({ lineNumbers })} />
      </Field>
      <Field label="Wrap long lines">
        <Switch checked={s.lineWrap} onCheckedChange={(lineWrap) => s.set({ lineWrap })} />
      </Field>
      <Field label="Smooth scrolling" hint="Animate hunk and page jumps.">
        <Switch checked={s.smoothScroll} onCheckedChange={(smoothScroll) => s.set({ smoothScroll })} />
      </Field>
      <Field label="Default diff layout">
        <Segmented
          value={s.defaultDiffLayout}
          onChange={(defaultDiffLayout) => s.set({ defaultDiffLayout })}
          options={[
            { value: "unified", label: "Unified" },
            { value: "split", label: "Split" },
          ]}
        />
      </Field>
      <SliderField
        label="Diff context lines"
        value={s.diffContext}
        min={0}
        max={20}
        step={1}
        format={(v) => String(v)}
        onChange={(diffContext) => s.set({ diffContext })}
      />
      <Field label="Markdown opens as">
        <Segmented
          value={s.defaultMarkdownMode}
          onChange={(defaultMarkdownMode) => s.set({ defaultMarkdownMode })}
          options={[
            { value: "preview", label: "Preview" },
            { value: "raw", label: "Raw" },
          ]}
        />
      </Field>
    </>
  );
}

function Gestures() {
  const g = useGestures();
  const set = g.setConfig;
  return (
    <>
      <SectionTitle description="Gestures are a layer on top of keyboard and mouse, which always keep working. Use them for navigation when you step away from the desk.">
        Gestures
      </SectionTitle>
      <Field label="Gesture mode" hint={g.statusDetail ?? `Shortcut ${formatKeys("Mod+Shift+G")}`}>
        <Switch checked={g.enabled} onCheckedChange={(enabled) => set({ enabled })} />
      </Field>
      <Field label="Require arming" hint="Hold an open palm still before command gestures act — filters out talking with your hands.">
        <Switch checked={g.requireArming} onCheckedChange={(requireArming) => set({ requireArming })} />
      </Field>
      <SliderField label="Arming hold" value={g.armHoldMs} min={200} max={1500} step={50} format={(v) => `${v}ms`} onChange={(armHoldMs) => set({ armHoldMs })} />
      <SliderField label="Auto-disarm after" value={g.disarmAfterMs} min={1000} max={15000} step={500} format={(v) => `${(v / 1000).toFixed(1)}s`} onChange={(disarmAfterMs) => set({ disarmAfterMs })} />
      <SliderField
        label="Confidence floor"
        hint="Lower lets more through in poor light; higher is stricter."
        value={g.minConfidence}
        min={0.2}
        max={0.95}
        step={0.05}
        format={(v) => v.toFixed(2)}
        onChange={(minConfidence) => set({ minConfidence })}
      />
      <SliderField label="Gesture cooldown" value={g.cooldownMs} min={100} max={1500} step={50} format={(v) => `${v}ms`} onChange={(cooldownMs) => set({ cooldownMs })} />
      <SliderField label="Scroll sensitivity" value={g.scrollGain} min={0.3} max={4} step={0.1} format={(v) => `${v.toFixed(1)}×`} onChange={(scrollGain) => set({ scrollGain })} />
      <SliderField label="Pinch sensitivity" value={g.pinchGain} min={0.3} max={3} step={0.1} format={(v) => `${v.toFixed(1)}×`} onChange={(pinchGain) => set({ pinchGain })} />
      <SliderField label="Minimum swipe speed" value={g.swipeMinVelocity} min={0.3} max={4} step={0.1} format={(v) => v.toFixed(1)} onChange={(swipeMinVelocity) => set({ swipeMinVelocity })} />
      <Field label="On-screen feedback" hint="Show what each gesture did, large enough to read from across a room.">
        <Switch checked={g.showHud} onCheckedChange={(showHud) => set({ showHud })} />
      </Field>
      <Field label="Gesture simulator" hint="Developer panel that fires synthetic gestures through the real dispatcher.">
        <Switch checked={g.showSimulator} onCheckedChange={(showSimulator) => set({ showSimulator })} />
      </Field>

      <h3 className="mb-2 mt-6 text-sm font-semibold">Bindings</h3>
      <div className="overflow-hidden rounded-xl border border-border/70">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Gesture</th>
              <th className="px-3 py-2 font-medium">Where</th>
              <th className="px-3 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {GESTURE_BINDINGS.map((b, i) => (
              <tr key={i} className="border-t border-border/50">
                <td className="px-3 py-1.5">{b.label}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{b.contexts.map((c) => CONTEXT_LABELS[c]).join(", ")}</td>
                <td className="px-3 py-1.5">{COMMAND_TITLES[b.resolve({ type: b.type, confidence: 1, timestamp: 0, ...SAMPLE } as never, DEFAULT_GESTURE_CONFIG).command]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={g.resetConfig}>
          Reset gesture settings
        </Button>
      </div>
    </>
  );
}

/** Placeholder payload so a binding can be resolved just to read its command. */
const SAMPLE = { dx: 0, dy: 0, scale: 1, center: { x: 0.5, y: 0.5 }, at: { x: 0.5, y: 0.5 }, direction: "left", velocity: 0 };

function Shortcuts() {
  return (
    <>
      <SectionTitle description="Every shortcut fires the same command a gesture or toolbar button does.">Keyboard shortcuts</SectionTitle>
      <div className="overflow-hidden rounded-xl border border-border/70">
        {KEYMAP.filter((k) => k.listed !== false).map((k) => (
          <div key={k.keys} className="flex items-center justify-between border-b border-border/50 px-3 py-2 text-sm last:border-0">
            <span>{COMMAND_TITLES[k.command]}</span>
            <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">{formatKeys(k.keys)}</kbd>
          </div>
        ))}
      </div>
    </>
  );
}
