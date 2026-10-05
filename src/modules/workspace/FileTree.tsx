import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, File01Icon, Folder01Icon, FolderOpenIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { useTabs } from "@/modules/tabs/store";
import { useWorkspace } from "./store";

export function FileTree() {
  const ws = useWorkspace((s) => s.workspace);
  if (!ws) return null;
  return (
    <div role="tree" className="py-1 text-[13px]">
      <DirChildren path={ws.root} depth={0} />
    </div>
  );
}

function DirChildren({ path, depth }: { path: string; depth: number }) {
  const entries = useWorkspace((s) => s.dirs[path]);
  if (!entries) return <div className="px-3 py-1 text-xs text-muted-foreground" style={{ paddingLeft: 12 + depth * 14 }}>Loading…</div>;
  if (!entries.length) return <div className="px-3 py-1 text-xs italic text-muted-foreground" style={{ paddingLeft: 28 + depth * 14 }}>Empty</div>;
  return (
    <>
      {entries.map((e) => (e.isDir ? <DirNode key={e.path} path={e.path} name={e.name} depth={depth} /> : <FileNode key={e.path} path={e.path} name={e.name} depth={depth} />))}
    </>
  );
}

function DirNode({ path, name, depth }: { path: string; name: string; depth: number }) {
  const open = useWorkspace((s) => !!s.expanded[path]);
  const toggle = useWorkspace((s) => s.toggleDir);
  return (
    <div role="treeitem" aria-expanded={open}>
      <Row depth={depth} onClick={() => toggle(path)}>
        <HugeiconsIcon icon={ArrowRight01Icon} size={12} className={cn("shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
        <HugeiconsIcon icon={open ? FolderOpenIcon : Folder01Icon} size={14} className="shrink-0 text-muted-foreground" />
        <span className="truncate">{name}</span>
      </Row>
      {open && <DirChildren path={path} depth={depth + 1} />}
    </div>
  );
}

function FileNode({ path, name, depth }: { path: string; name: string; depth: number }) {
  const active = useTabs((s) => s.activeId === `file:${path}`);
  const open = useTabs((s) => s.open);
  return (
    <Row depth={depth} active={active} onClick={() => open({ kind: "file", path })} title={path}>
      <span className="w-3 shrink-0" />
      <HugeiconsIcon icon={File01Icon} size={14} className="shrink-0 text-muted-foreground" />
      <span className="truncate">{name}</span>
    </Row>
  );
}

function Row({
  depth,
  active,
  onClick,
  title,
  children,
}: {
  depth: number;
  active?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{ paddingLeft: 8 + depth * 14 }}
      className={cn(
        "flex h-7 w-full items-center gap-1.5 rounded-md pr-2 text-left transition-colors",
        active ? "bg-accent text-foreground" : "text-foreground/85 hover:bg-accent/60",
      )}
    >
      {children}
    </button>
  );
}
