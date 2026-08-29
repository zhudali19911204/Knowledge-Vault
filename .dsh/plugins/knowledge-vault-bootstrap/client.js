window.__ModuleLoader__.load({
  id: "@knowledge-vault/dsh-bootstrap",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const e = React.createElement;
    const API_PREFIX = "/knowledge-vault/api";
    const STYLE_ID = "@knowledge-vault/dsh-bootstrap/client.css";
    const css = `
      :root{--kv-browser-width:360px}
      @media(max-width:1200px){:root{--kv-browser-width:320px}}
      .kv-brand-mark{width:24px;height:24px;border-radius:7px;display:grid;place-items:center;background:linear-gradient(145deg,#315b4c,#79a789);color:#fff;font-size:14px;font-weight:700;box-shadow:0 4px 14px #315b4c33}
      .kv-brand-name{font-size:15px;font-weight:650;letter-spacing:.02em;color:var(--dsw-alias-label-primary);white-space:nowrap}
      .kv-init-launcher{box-sizing:border-box;flex:none;margin:0 2px 8px;min-width:0;display:flex;flex-direction:column;gap:8px}
      .kv-init-button{box-sizing:border-box;width:100%;height:38px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-button-elevated-fill);color:var(--dsw-alias-label-primary);display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 12px;cursor:pointer;font:500 14px/22px var(--dsw-font-family);white-space:nowrap;overflow:hidden}
      .kv-init-button:hover{background:var(--dsw-alias-button-floating-hover)}
      .kv-init-button:disabled{cursor:wait;opacity:.65}
      .kv-init-icon{font-size:17px;line-height:18px;flex:none}
      .kv-init-status{padding:5px 6px 0;color:var(--dsw-alias-label-tertiary);font:11px/16px var(--dsw-font-family);overflow-wrap:anywhere}
      [class*="_collapsed"] .kv-init-launcher{width:36px;margin:0 0 12px}
      [class*="_collapsed"] .kv-init-button{width:36px;height:36px;border-color:transparent;background:transparent;padding:0}
      [class*="_collapsed"] .kv-init-button:hover{background:var(--dsw-alias-interactive-bg-hover)}
      [class*="_collapsed"] .kv-init-label,[class*="_collapsed"] .kv-init-status{display:none}
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

    async function postJson(route, value) {
      const response = await fetch(`${API_PREFIX}/${route}`, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(value),
      });
      const body = await response.json().catch(() => ({}));
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

      React.useEffect(() => {
        const refreshActiveVault = () => {
          setSelected(null);
          setPreview(null);
          setRevision((value) => value + 1);
        };
        window.addEventListener("knowledge-vault:changed", refreshActiveVault);
        return () => window.removeEventListener("knowledge-vault:changed", refreshActiveVault);
      }, []);

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

    function createInitializationLauncher(ctx) {
      return function KnowledgeVaultInitializationLauncher() {
        React.useEffect(() => {
          let disposed = false;
          let resetTimer = 0;
          const launcher = document.createElement("div");
          launcher.className = "kv-init-launcher";

          const createButton = (text, title, iconText) => {
            const action = document.createElement("button");
            action.type = "button";
            action.className = "kv-init-button";
            action.title = title;
            action.setAttribute("aria-label", text);
            const icon = document.createElement("span");
            icon.className = "kv-init-icon";
            icon.setAttribute("aria-hidden", "true");
            icon.textContent = iconText;
            const label = document.createElement("span");
            label.className = "kv-init-label";
            label.textContent = text;
            action.append(icon, label);
            return { action, label, title };
          };
          const initializeButton = createButton(
            "初始化知识库",
            "在指定位置初始化并切换到自己的知识库",
            "⊕",
          );
          const selectButton = createButton(
            "选择知识库",
            "选择一个已经初始化的 Knowledge Vault",
            "◉",
          );
          const status = document.createElement("div");
          status.className = "kv-init-status";
          status.setAttribute("role", "status");
          status.setAttribute("aria-live", "polite");
          launcher.append(initializeButton.action, selectButton.action, status);

          const setState = (kind, text, detail = "", busy = false) => {
            initializeButton.label.textContent = kind === "initialize" ? text : "初始化知识库";
            selectButton.label.textContent = kind === "select" ? text : "选择知识库";
            status.textContent = detail;
            initializeButton.action.title = kind === "initialize" && detail ? detail : initializeButton.title;
            selectButton.action.title = kind === "select" && detail ? detail : selectButton.title;
            initializeButton.action.disabled = busy;
            selectButton.action.disabled = busy;
          };

          const attach = () => {
            if (disposed) return;
            const newSessionButton = document.querySelector('button[class*="_newSession"]');
            if (newSessionButton && newSessionButton.nextElementSibling !== launcher) {
              newSessionButton.insertAdjacentElement("afterend", launcher);
            }
          };

          const initialize = async () => {
            window.clearTimeout(resetTimer);
            try {
              setState("initialize", "选择知识库位置…", "请选择空文件夹或已有的 Knowledge Vault。", true);
              const destination = await ctx.workspaces.pickDirectory();
              if (destination === null || disposed) {
                setState("initialize", "初始化知识库");
                return;
              }
              setState("initialize", "正在初始化…", destination, true);
              const result = await postJson("initialize", { destination });
              const workspace = await ctx.workspaces.create({ path: result.vaultRoot });
              if (disposed) return;
              window.dispatchEvent(new CustomEvent("knowledge-vault:changed", {
                detail: { vaultRoot: result.vaultRoot },
              }));
              ctx.workspaces.startSession(workspace.workspaceId);
              setState(
                "initialize",
                result.alreadyInitialized ? "已切换知识库" : "初始化完成",
                result.vaultRoot,
              );
              resetTimer = window.setTimeout(() => {
                if (!disposed) setState("initialize", "初始化知识库");
              }, 5000);
            } catch (cause) {
              if (disposed) return;
              const message = cause instanceof Error ? cause.message : String(cause);
              setState("initialize", "初始化失败", message);
            }
          };

          const select = async () => {
            window.clearTimeout(resetTimer);
            try {
              setState("select", "选择知识库位置…", "请选择已有的 Knowledge Vault 根目录。", true);
              const destination = await ctx.workspaces.pickDirectory();
              if (destination === null || disposed) {
                setState("select", "选择知识库");
                return;
              }
              setState("select", "正在切换…", destination, true);
              const result = await postJson("select", { destination });
              const workspace = await ctx.workspaces.create({ path: result.vaultRoot });
              if (disposed) return;
              window.dispatchEvent(new CustomEvent("knowledge-vault:changed", {
                detail: { vaultRoot: result.vaultRoot },
              }));
              ctx.workspaces.startSession(workspace.workspaceId);
              setState("select", "切换完成", result.vaultRoot);
              resetTimer = window.setTimeout(() => {
                if (!disposed) setState("select", "选择知识库");
              }, 5000);
            } catch (cause) {
              if (disposed) return;
              const message = cause instanceof Error ? cause.message : String(cause);
              setState("select", "选择失败", message);
            }
          };

          initializeButton.action.addEventListener("click", initialize);
          selectButton.action.addEventListener("click", select);
          const observer = new MutationObserver(attach);
          observer.observe(document.body, { childList: true, subtree: true });
          attach();
          return () => {
            disposed = true;
            window.clearTimeout(resetTimer);
            observer.disconnect();
            initializeButton.action.removeEventListener("click", initialize);
            selectButton.action.removeEventListener("click", select);
            launcher.remove();
          };
        }, []);
        return null;
      };
    }

    function BrandMark() {
      return e("span", { className: "kv-brand-mark", "aria-hidden": true }, "知");
    }

    function BrandName() {
      return e("span", { className: "kv-brand-name" }, "Knowledge Vault");
    }

    const inject = ["slots", "workspaces"];
    function apply(ctx) {
      const InitializationLauncher = createInitializationLauncher(ctx);
      ctx.slots.inject("shell.overlay", () => ctx.slots.register({
        name: "shell.overlay",
        id: "knowledge-vault-browser",
        order: 100,
      }, VaultExplorer));
      ctx.slots.inject("shell.overlay", () => ctx.slots.register({
        name: "shell.overlay",
        id: "knowledge-vault-initializer",
        order: 101,
      }, InitializationLauncher));
      ctx.slots.inject("sidebar.brand.mark", () => ctx.slots.register({ name: "sidebar.brand.mark", priority: -100 }, BrandMark));
      ctx.slots.inject("sidebar.brand.name", () => ctx.slots.register({ name: "sidebar.brand.name", priority: -100 }, BrandName));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
