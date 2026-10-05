// Rendered markdown preview. Relative links to other documents open as tabs,
// relative images load from disk through the asset protocol, and external
// links go to the system browser.
import { useEffect, useState, type ComponentProps } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { localFileUrl, openExternal } from "@/lib/ipc";
import { dirname, extname, join } from "@/lib/path";
import { useTabs } from "@/modules/tabs/store";
import { HighlightedCode } from "./HighlightedCode";

const isExternal = (href: string) => /^[a-z][a-z0-9+.-]*:/i.test(href);

function LocalImage({ src, base, ...rest }: ComponentProps<"img"> & { base: string }) {
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!src) return;
    if (isExternal(src)) setUrl(src);
    else void localFileUrl(join(base, decodeURI(src))).then(setUrl);
  }, [src, base]);
  return url ? <img {...rest} src={url} loading="lazy" /> : null;
}

export function MarkdownView({
  doc,
  path,
  scrollerRef,
}: {
  doc: string;
  path: string;
  scrollerRef: (el: HTMLElement | null) => void;
}) {
  const openTab = useTabs((s) => s.open);
  const base = dirname(path);

  const components: Components = {
    a: ({ href = "", children, ...rest }) => (
      <a
        {...rest}
        href={href}
        onClick={(e) => {
          e.preventDefault();
          if (href.startsWith("#")) {
            document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" });
          } else if (isExternal(href)) {
            void openExternal(href);
          } else {
            const target = join(base, decodeURI(href.split("#")[0]));
            if (extname(target)) openTab({ kind: "file", path: target });
          }
        }}
      >
        {children}
      </a>
    ),
    img: ({ node: _node, ...props }) => <LocalImage {...props} base={base} />,
    pre: ({ children }) => <pre className="lens-pre">{children}</pre>,
    code: ({ className, children, ...rest }) => {
      const lang = /language-([\w+#-]+)/.exec(className ?? "")?.[1];
      const text = String(children ?? "").replace(/\n$/, "");
      // Fenced blocks have a language class or span lines; inline code neither.
      if (!lang && !text.includes("\n")) return <code {...rest}>{children}</code>;
      return <HighlightedCode code={text} lang={lang ?? "text"} />;
    },
  };

  return (
    <div ref={scrollerRef} className="nexis-scrollbar h-full overflow-auto">
      <article className="lens-prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {doc}
        </ReactMarkdown>
      </article>
    </div>
  );
}
