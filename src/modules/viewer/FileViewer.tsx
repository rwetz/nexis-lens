import { useCallback, useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { FileUnknownIcon, Loading03Icon } from "@hugeicons/core-free-icons";
import { localFileUrl } from "@/lib/ipc";
import { extname, isMarkdownPath } from "@/lib/path";
import { useCommand } from "@/modules/commands/useCommand";
import { useTabs, type Tab } from "@/modules/tabs/store";
import { CodeView } from "./CodeView";
import { useFile } from "./content";
import { MarkdownView } from "./MarkdownView";
import { useViewport } from "./useViewport";
import { ViewerToolbar } from "./ViewerToolbar";

const IMAGE = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"]);

export function FileViewer({ tab, path }: { tab: Tab; path: string }) {
  const ext = extname(path);
  if (IMAGE.has(ext)) return <ImageViewer tab={tab} path={path} />;
  return <TextViewer tab={tab} path={path} />;
}

function TextViewer({ tab, path }: { tab: Tab; path: string }) {
  const res = useFile(path);
  const updateView = useTabs((s) => s.updateView);
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const getScroller = useCallback(() => scroller, [scroller]);
  useViewport({ tab, getScroller });

  const md = isMarkdownPath(path);
  const mode = md ? tab.view.markdownMode : null;

  useCommand(
    "markdown.toggleMode",
    () => {
      updateView(tab.id, { markdownMode: mode === "raw" ? "preview" : "raw", scrollTop: 0 });
    },
    md,
  );

  if (res.status === "loading") return <Centered spin label="Loading…" />;
  if (res.status === "error") return <Centered label={res.error} />;
  if (res.data.binary) return <Centered label="Binary file — nothing to show." />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ViewerToolbar tab={tab} markdown={md} />
      <div className="relative min-h-0 flex-1">
        {mode === "preview" ? (
          <MarkdownView doc={res.data.content} path={path} scrollerRef={setScroller} />
        ) : (
          <CodeView doc={res.data.content} filename={path} zoom={tab.view.zoom} onScroller={setScroller} />
        )}
      </div>
    </div>
  );
}

function ImageViewer({ tab, path }: { tab: Tab; path: string }) {
  const [url, setUrl] = useState<string>();
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const getScroller = useCallback(() => scroller, [scroller]);
  useViewport({ tab, getScroller });
  useEffect(() => {
    void localFileUrl(path).then(setUrl);
  }, [path]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ViewerToolbar tab={tab} />
      <div ref={setScroller} className="nexis-scrollbar grid min-h-0 flex-1 place-items-center overflow-auto p-8">
        {url && (
          <img
            src={url}
            alt=""
            className="max-w-none rounded-md shadow-sm"
            style={{ width: `calc(min(100%, 960px) * var(--lens-zoom))` }}
          />
        )}
      </div>
    </div>
  );
}

export function Centered({ label, spin }: { label: string; spin?: boolean }) {
  return (
    <div className="grid h-full place-items-center p-8 text-sm text-muted-foreground">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <HugeiconsIcon
          icon={spin ? Loading03Icon : FileUnknownIcon}
          size={22}
          className={spin ? "animate-spin" : "opacity-70"}
        />
        <span className="break-words">{label}</span>
      </div>
    </div>
  );
}
