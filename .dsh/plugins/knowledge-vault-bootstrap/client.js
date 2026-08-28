window.__ModuleLoader__.load({
  id: "@knowledge-vault/dsh-bootstrap",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const e = React.createElement;
    const API_PREFIX = "/knowledge-vault/api";
    const BRAND_LOGO_URL = "/knowledge-vault/assets/bkcs-logo.png";
    const STYLE_ID = "@knowledge-vault/dsh-bootstrap/client.css";
    const css = `
      :root{--kv-browser-width:360px}
      @media(max-width:1200px){:root{--kv-browser-width:320px}}
      .kv-sidebar-logo{display:block;width:150px;max-width:100%;height:auto;border-radius:5px}
      .kv-hero-logo{display:block;width:min(360px,70vw);height:auto;border-radius:10px;box-shadow:0 10px 30px #00000014}
      span:has(> .kv-hero-logo){grid-column:1/4;justify-self:center;width:auto;height:auto}
      span:has(> .kv-hero-logo)~span{display:none}
      .kv-explorer{position:absolute;top:0;right:0;bottom:0;width:var(--kv-browser-width);box-sizing:border-box;min-width:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-left:1px solid var(--dsw-alias-border-l2);font-family:var(--dsw-font-family);box-shadow:-8px 0 24px #0000000a}
      .kv-explorer-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:10px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:0 0 auto}
      .kv-explorer-title{min-width:0;flex:1;font-size:14px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .kv-icon-button{width:30px;height:30px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:17px;display:grid;place-items:center}
      .kv-icon-button:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .kv-explorer-status{padding:12px 14px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
      .kv-tree{flex:1 1 52%;min-height:180px;overflow:auto;padding:8px 8px 14px}
      .kv-tree-row{width:100%;height:30px;box-sizing:border-box;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);display:flex;align-items:center;gap:6px;padding:0 8px;text-align:left;cursor:pointer;font:inherit;font-size:13px}
      .kv-tree-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .kv-tree-row[data-selected="true"]{background:var(--dsw-specific-sidebar-nav-item-active-accent)}
      .kv-tree-chevron{width:12px;color:var(--dsw-alias-label-tertiary);font-size:10px;text-align:center;flex:0 0 12px}
      .kv-tree-kind{width:16px;text-align:center;flex:0 0 16px;font-size:13px}
      .kv-tree-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .kv-preview{flex:1 1 48%;min-height:150px;display:flex;flex-direction:column;border-top:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2)}
      .kv-preview-header{min-height:42px;box-sizing:border-box;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1)}
      .kv-preview-name{font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .kv-preview-meta{margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .kv-preview-body{margin:0;padding:12px;overflow:auto;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-secondary);font:12px/1.65 var(--ds-font-family-code);flex:1}
      .kv-preview-empty{padding:14px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:20px}
    `;
    if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`) === null) {
      const tag = document.createElement("style");
      tag.dataset.plugin = "@knowledge-vault/dsh-bootstrap";
      tag.dataset.pluginCss = STYLE_ID;
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    async function getJson(route, path) {
      const response = await fetch(`${API_PREFIX}/${route}?path=${encodeURIComponent(path || "")}`, {
        headers: { accept: "application/json" },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
      return body;
    }

    function formatBytes(bytes) {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    }

    function TreeNode({ entry, depth, selectedPath, onSelect }) {
      const [expanded, setExpanded] = React.useState(false);
      const [children, setChildren] = React.useState(null);
      const [error, setError] = React.useState("");
      const isDirectory = entry.type === "directory";

      const activate = async () => {
        if (!isDirectory) {
          onSelect(entry);
          return;
        }
        const nextExpanded = !expanded;
        setExpanded(nextExpanded);
        if (nextExpanded && children === null) {
          try {
            setError("");
            const result = await getJson("list", entry.path);
            setChildren(result.entries);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
          }
        }
      };

      return e(React.Fragment, null,
        e("button", {
          type: "button",
          className: "kv-tree-row",
          style: { paddingLeft: `${8 + depth * 16}px` },
          "data-selected": selectedPath === entry.path ? "true" : "false",
          onClick: () => void activate(),
          title: entry.path,
        },
          e("span", { className: "kv-tree-chevron", "aria-hidden": true }, isDirectory ? (expanded ? "▼" : "▶") : ""),
          e("span", { className: "kv-tree-kind", "aria-hidden": true }, isDirectory ? "📁" : "📄"),
          e("span", { className: "kv-tree-label" }, entry.name),
        ),
        error ? e("div", { className: "kv-explorer-status", style: { paddingLeft: `${24 + depth * 16}px` } }, error) : null,
        expanded && children ? children.map((child) => e(TreeNode, {
          key: child.path,
          entry: child,
          depth: depth + 1,
          selectedPath,
          onSelect,
        })) : null,
      );
    }

    function VaultExplorer() {
      const panelRef = React.useRef(null);
      const [rootName, setRootName] = React.useState("知识库");
      const [entries, setEntries] = React.useState([]);
      const [selected, setSelected] = React.useState(null);
      const [preview, setPreview] = React.useState(null);
      const [loading, setLoading] = React.useState(true);
      const [error, setError] = React.useState("");
      const [revision, setRevision] = React.useState(0);

      React.useLayoutEffect(() => {
        const overlay = panelRef.current?.closest("[data-shell-overlay]");
        const frame = overlay?.parentElement;
        if (!frame) return undefined;
        const previousBoxSizing = frame.style.boxSizing;
        const previousPaddingRight = frame.style.paddingRight;
        frame.style.boxSizing = "border-box";
        frame.style.paddingRight = "var(--kv-browser-width)";
        return () => {
          frame.style.boxSizing = previousBoxSizing;
          frame.style.paddingRight = previousPaddingRight;
        };
      }, []);

      React.useEffect(() => {
        let alive = true;
        setLoading(true);
        setError("");
        getJson("list", "").then((result) => {
          if (!alive) return;
          setRootName(result.rootName || "知识库");
          setEntries(result.entries || []);
          setLoading(false);
        }).catch((cause) => {
          if (!alive) return;
          setError(cause instanceof Error ? cause.message : String(cause));
          setLoading(false);
        });
        return () => { alive = false; };
      }, [revision]);

      const selectFile = async (entry) => {
        setSelected(entry);
        setPreview({ loading: true, name: entry.name, path: entry.path });
        try {
          const result = await getJson("file", entry.path);
          setPreview(result);
        } catch (cause) {
          setPreview({
            name: entry.name,
            path: entry.path,
            error: cause instanceof Error ? cause.message : String(cause),
          });
        }
      };

      let previewContent = e("div", { className: "kv-preview-empty" }, "选择 Markdown 或文本文件即可在这里预览。");
      if (preview?.loading) previewContent = e("div", { className: "kv-preview-empty" }, "正在读取…");
      else if (preview?.error) previewContent = e("div", { className: "kv-preview-empty" }, preview.error);
      else if (preview && !preview.previewable) previewContent = e("div", { className: "kv-preview-empty" }, "这是附件或较大的文件，目录中已保留其位置和大小。");
      else if (preview?.previewable) previewContent = e("pre", { className: "kv-preview-body" }, preview.content || "");

      return e("aside", { ref: panelRef, className: "kv-explorer", "aria-label": "知识库浏览器" },
        e("header", { className: "kv-explorer-header" },
          e("div", { className: "kv-explorer-title", title: rootName }, rootName),
          e("button", {
            type: "button",
            className: "kv-icon-button",
            title: "刷新知识库目录",
            "aria-label": "刷新知识库目录",
            onClick: () => setRevision((value) => value + 1),
          }, "↻"),
        ),
        e("div", { className: "kv-tree", key: revision, role: "tree" },
          loading ? e("div", { className: "kv-explorer-status" }, "正在读取知识库…") : null,
          error ? e("div", { className: "kv-explorer-status" }, error) : null,
          !loading && !error ? entries.map((entry) => e(TreeNode, {
            key: entry.path,
            entry,
            depth: 0,
            selectedPath: selected?.path,
            onSelect: selectFile,
          })) : null,
        ),
        e("section", { className: "kv-preview" },
          preview ? e("div", { className: "kv-preview-header" },
            e("div", { className: "kv-preview-name", title: preview.name }, preview.name),
            e("div", { className: "kv-preview-meta", title: preview.path },
              preview.bytes === undefined ? preview.path : `${preview.path} · ${formatBytes(preview.bytes)}`,
            ),
          ) : null,
          previewContent,
        ),
      );
    }

    function BrandMark() {
      return null;
    }

    function BrandName() {
      return e("img", {
        className: "kv-sidebar-logo",
        src: BRAND_LOGO_URL,
        alt: "BKCS · 贝内克长顺",
      });
    }

    function HeroBrandMark() {
      return e("img", {
        className: "kv-hero-logo",
        src: BRAND_LOGO_URL,
        alt: "BKCS · 贝内克长顺",
      });
    }

    const inject = ["slots"];
    function apply(ctx) {
      ctx.slots.inject("shell.overlay", () => ctx.slots.register({
        name: "shell.overlay",
        id: "knowledge-vault-browser",
        order: 100,
      }, VaultExplorer));
      ctx.slots.inject("sidebar.brand.mark", () => ctx.slots.register({ name: "sidebar.brand.mark", priority: -100 }, BrandMark));
      ctx.slots.inject("sidebar.brand.name", () => ctx.slots.register({ name: "sidebar.brand.name", priority: -100 }, BrandName));
      ctx.slots.inject("conversation.hero.brand.mark", () => ctx.slots.register({ name: "conversation.hero.brand.mark", priority: -100 }, HeroBrandMark));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
