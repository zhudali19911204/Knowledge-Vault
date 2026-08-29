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
    const FAVICON_URL = "/knowledge-vault/assets/knowledge-vault-favicon.png";
    const DOCUMENT_TITLE = "Knowledge Vault";
    const STYLE_ID = "@knowledge-vault/dsh-bootstrap/client.css";
    const css = `
      :root{--kv-browser-width:360px}
      @media(max-width:1200px){:root{--kv-browser-width:320px}}
      .kv-brand-mark{width:24px;height:24px;display:block;object-fit:contain}
      .kv-brand-name{font-size:15px;font-weight:650;letter-spacing:.02em;color:var(--dsw-alias-label-primary);white-space:nowrap}
      .kv-hero-logo{display:block;width:min(258px,70vw);height:auto;object-fit:contain;border-radius:5px}
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
      .kv-graph{height:100%;min-height:0;box-sizing:border-box;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family)}
      .kv-graph-toolbar{flex:none;padding:12px 16px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1)}
      .kv-graph-heading{display:flex;align-items:center;gap:10px;min-height:28px}
      .kv-graph-title{min-width:0;font-size:15px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .kv-graph-summary{margin-left:auto;color:var(--dsw-alias-label-tertiary);font-size:11px;white-space:nowrap}
      .kv-graph-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:9px}
      .kv-graph-input,.kv-graph-select{box-sizing:border-box;height:30px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:12px var(--dsw-font-family);outline:none}
      .kv-graph-input{width:min(230px,28vw);padding:0 10px}
      .kv-graph-select{max-width:150px;padding:0 7px}
      .kv-graph-input:focus,.kv-graph-select:focus{border-color:var(--dsw-alias-border-focus)}
      .kv-graph-action{height:30px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-elevated-fill);color:var(--dsw-alias-label-secondary);padding:0 10px;cursor:pointer;font:12px var(--dsw-font-family);white-space:nowrap}
      .kv-graph-action:hover{background:var(--dsw-alias-button-floating-hover);color:var(--dsw-alias-label-primary)}
      .kv-graph-action[data-active="true"]{border-color:#ed7b2f;background:#fff2e8;color:#a9470a}
      .kv-graph-action:disabled{cursor:wait;opacity:.6}
      .kv-graph-stage{position:relative;flex:1;min-height:220px;overflow:hidden;background:radial-gradient(circle at center,#ffffff05 0,transparent 65%)}
      .kv-graph-canvas{display:block;width:100%;height:100%;touch-action:none;cursor:grab;outline:none}
      .kv-graph-canvas[data-dragging="true"]{cursor:grabbing}
      .kv-graph-message{position:absolute;inset:0;display:grid;place-items:center;padding:24px;color:var(--dsw-alias-label-tertiary);font-size:13px;text-align:center;pointer-events:none}
      .kv-graph-tooltip{position:absolute;z-index:2;max-width:280px;padding:7px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);box-shadow:0 7px 22px #0002;pointer-events:none;font-size:11px;line-height:17px;transform:translate(12px,12px)}
      .kv-graph-tooltip strong{display:block;font-size:12px;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .kv-graph-tooltip span{color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere}
      .kv-graph-footer{flex:none;min-height:38px;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:7px 16px;border-top:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);font-size:11px}
      .kv-graph-selection{min-width:0;flex:1;display:flex;align-items:center;gap:8px;overflow:hidden}
      .kv-graph-selection strong{color:var(--dsw-alias-label-primary);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .kv-graph-selection span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .kv-graph-legend{display:flex;align-items:center;gap:10px;white-space:nowrap}
      .kv-graph-dot{display:inline-block;width:8px;height:8px;margin-right:4px;border-radius:50%;vertical-align:-1px}
      @media(max-width:900px){.kv-graph-toolbar{padding-inline:10px}.kv-graph-input{width:170px}.kv-graph-summary{display:none}.kv-graph-footer{padding-inline:10px}.kv-graph-legend{display:none}}
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

    async function getGraph(refresh = false) {
      const response = await fetch(`${API_PREFIX}/graph${refresh ? "?refresh=1" : ""}`, {
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

      React.useEffect(() => {
        const openGraphFile = (event) => {
          const path = event?.detail?.path;
          if (typeof path !== "string" || !path) return;
          const name = path.split("/").pop() || path;
          void selectFile({ type: "file", path, name });
        };
        window.addEventListener("knowledge-vault:open-file", openGraphFile);
        return () => window.removeEventListener("knowledge-vault:open-file", openGraphFile);
      }, []);

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

    const GRAPH_COLORS = [
      "#4d8df7", "#28a878", "#9b6de3", "#ed7b2f", "#d84c75",
      "#2f9da8", "#7785d9", "#b48232", "#5a9e42", "#b45db5",
    ];

    function graphColor(value) {
      let hash = 0;
      for (const character of String(value || "/")) {
        hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
      }
      return GRAPH_COLORS[Math.abs(hash) % GRAPH_COLORS.length];
    }

    function uniqueGraphValues(nodes, field, arrayValue = false) {
      const values = new Set();
      for (const node of nodes || []) {
        const entries = arrayValue ? node[field] || [] : [node[field]];
        for (const value of entries) if (value) values.add(value);
      }
      return Array.from(values).sort((left, right) => left.localeCompare(right, "zh-CN"));
    }

    function createGraphLayout(nodes) {
      const groups = new Map();
      for (const node of nodes) {
        const key = node.topFolder || "/";
        const group = groups.get(key) || [];
        group.push(node);
        groups.set(key, group);
      }
      const positions = new Map();
      const groupRows = Array.from(groups.entries());
      const groupRadius = Math.max(300, 125 * Math.sqrt(groupRows.length));
      groupRows.forEach(([key, group], groupIndex) => {
        const groupAngle = (Math.PI * 2 * groupIndex) / Math.max(1, groupRows.length) - Math.PI / 2;
        const centerX = groupRows.length === 1 ? 0 : Math.cos(groupAngle) * groupRadius;
        const centerY = groupRows.length === 1 ? 0 : Math.sin(groupAngle) * groupRadius;
        const ordered = [...group].sort((left, right) => {
          if (left.isIndex !== right.isIndex) return left.isIndex ? -1 : 1;
          return right.degree - left.degree || left.title.localeCompare(right.title, "zh-CN");
        });
        ordered.forEach((node, index) => {
          if (index === 0) {
            positions.set(node.id, { x: centerX, y: centerY });
            return;
          }
          const angle = index * 2.399963229728653 + groupAngle;
          const radius = 33 * Math.sqrt(index);
          positions.set(node.id, {
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
          });
        });
      });
      return positions;
    }

    function KnowledgeGraphView() {
      const canvasRef = React.useRef(null);
      const stageRef = React.useRef(null);
      const dragRef = React.useRef(null);
      const refreshRef = React.useRef(false);
      const [graph, setGraph] = React.useState(null);
      const [loading, setLoading] = React.useState(true);
      const [error, setError] = React.useState("");
      const [revision, setRevision] = React.useState(0);
      const [query, setQuery] = React.useState("");
      const [folder, setFolder] = React.useState("");
      const [type, setType] = React.useState("");
      const [status, setStatus] = React.useState("");
      const [tag, setTag] = React.useState("");
      const [relation, setRelation] = React.useState("");
      const [showOrphans, setShowOrphans] = React.useState(true);
      const [localOnly, setLocalOnly] = React.useState(false);
      const [selectedId, setSelectedId] = React.useState("");
      const [hovered, setHovered] = React.useState(null);
      const [dragging, setDragging] = React.useState(false);
      const [size, setSize] = React.useState({ width: 0, height: 0 });
      const [transform, setTransform] = React.useState({ x: 0, y: 0, scale: 1 });

      React.useEffect(() => {
        let alive = true;
        setLoading(true);
        setError("");
        const force = refreshRef.current;
        refreshRef.current = false;
        getGraph(force).then((value) => {
          if (!alive) return;
          setGraph(value);
          setLoading(false);
        }).catch((cause) => {
          if (!alive) return;
          setError(cause instanceof Error ? cause.message : String(cause));
          setLoading(false);
        });
        return () => { alive = false; };
      }, [revision]);

      React.useEffect(() => {
        const activeVaultChanged = () => {
          setSelectedId("");
          setHovered(null);
          setRevision((value) => value + 1);
        };
        window.addEventListener("knowledge-vault:changed", activeVaultChanged);
        return () => window.removeEventListener("knowledge-vault:changed", activeVaultChanged);
      }, []);

      React.useLayoutEffect(() => {
        const stage = stageRef.current;
        if (!stage) return undefined;
        const update = () => setSize({ width: stage.clientWidth, height: stage.clientHeight });
        update();
        const observer = new ResizeObserver(update);
        observer.observe(stage);
        return () => observer.disconnect();
      }, []);

      const relationKinds = React.useMemo(
        () => uniqueGraphValues(graph?.edges || [], "kind"),
        [graph],
      );
      const folders = React.useMemo(
        () => uniqueGraphValues(graph?.nodes || [], "topFolder"),
        [graph],
      );
      const types = React.useMemo(() => uniqueGraphValues(graph?.nodes || [], "type"), [graph]);
      const statuses = React.useMemo(() => uniqueGraphValues(graph?.nodes || [], "status"), [graph]);
      const tags = React.useMemo(() => uniqueGraphValues(graph?.nodes || [], "tags", true), [graph]);

      const visible = React.useMemo(() => {
        if (!graph) return { nodes: [], edges: [] };
        const needle = query.trim().toLocaleLowerCase("zh-CN");
        let allowed = new Set(graph.nodes.filter((node) => {
          if (folder && node.topFolder !== folder) return false;
          if (type && node.type !== type) return false;
          if (status && node.status !== status) return false;
          if (tag && !(node.tags || []).includes(tag)) return false;
          if (needle && !`${node.title} ${node.path}`.toLocaleLowerCase("zh-CN").includes(needle)) return false;
          return true;
        }).map((node) => node.id));
        let edges = graph.edges.filter((edge) => !relation || edge.kind === relation);

        if (localOnly && selectedId) {
          const local = new Set([selectedId]);
          for (let depth = 0; depth < 2; depth += 1) {
            const frontier = new Set(local);
            for (const edge of edges) {
              if (frontier.has(edge.source)) local.add(edge.target);
              if (frontier.has(edge.target)) local.add(edge.source);
            }
          }
          allowed = new Set(Array.from(allowed).filter((id) => local.has(id)));
          allowed.add(selectedId);
        }

        edges = edges.filter((edge) => allowed.has(edge.source) && allowed.has(edge.target));
        if (!showOrphans) {
          const connected = new Set();
          for (const edge of edges) {
            connected.add(edge.source);
            connected.add(edge.target);
          }
          allowed = connected;
        }
        return {
          nodes: graph.nodes.filter((node) => allowed.has(node.id)),
          edges: edges.filter((edge) => allowed.has(edge.source) && allowed.has(edge.target)),
        };
      }, [graph, query, folder, type, status, tag, relation, showOrphans, localOnly, selectedId]);

      const layout = React.useMemo(() => createGraphLayout(visible.nodes), [visible.nodes]);
      const nodeById = React.useMemo(
        () => new Map(visible.nodes.map((node) => [node.id, node])),
        [visible.nodes],
      );
      const selected = graph?.nodes?.find((node) => node.id === selectedId) || null;

      const fitGraph = React.useCallback(() => {
        if (!size.width || !size.height || layout.size === 0) return;
        const points = Array.from(layout.values());
        const minX = Math.min(...points.map((point) => point.x));
        const maxX = Math.max(...points.map((point) => point.x));
        const minY = Math.min(...points.map((point) => point.y));
        const maxY = Math.max(...points.map((point) => point.y));
        const graphWidth = Math.max(120, maxX - minX + 100);
        const graphHeight = Math.max(120, maxY - minY + 100);
        const scale = Math.max(.08, Math.min(1.8, Math.min(size.width / graphWidth, size.height / graphHeight) * .92));
        setTransform({
          scale,
          x: size.width / 2 - ((minX + maxX) / 2) * scale,
          y: size.height / 2 - ((minY + maxY) / 2) * scale,
        });
      }, [layout, size]);

      React.useEffect(() => {
        fitGraph();
      }, [fitGraph]);

      React.useLayoutEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !size.width || !size.height) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.floor(size.width * dpr));
        canvas.height = Math.max(1, Math.floor(size.height * dpr));
        const context = canvas.getContext("2d");
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, size.width, size.height);
        context.translate(transform.x, transform.y);
        context.scale(transform.scale, transform.scale);
        context.lineCap = "round";

        const dark = document.documentElement.classList.contains("dark") ||
          document.documentElement.dataset.theme === "dark" ||
          window.matchMedia?.("(prefers-color-scheme: dark)").matches;
        context.strokeStyle = dark ? "rgba(210,220,235,.20)" : "rgba(55,68,85,.18)";
        context.lineWidth = Math.max(.45, .9 / transform.scale);
        for (const edge of visible.edges) {
          const source = layout.get(edge.source);
          const target = layout.get(edge.target);
          if (!source || !target) continue;
          context.beginPath();
          context.moveTo(source.x, source.y);
          context.lineTo(target.x, target.y);
          context.stroke();
        }

        for (const node of visible.nodes) {
          const point = layout.get(node.id);
          if (!point) continue;
          const active = node.id === selectedId;
          const hot = node.id === hovered?.id;
          const radius = (node.isIndex ? 5 : 3.4) + Math.min(5.5, Math.sqrt(node.degree || 0) * .95) + (active ? 2 : 0);
          context.beginPath();
          context.arc(point.x, point.y, radius, 0, Math.PI * 2);
          context.fillStyle = active ? "#ff7a16" : graphColor(node.topFolder);
          context.fill();
          if (active || hot) {
            context.lineWidth = 2 / transform.scale;
            context.strokeStyle = active ? "rgba(255,122,22,.35)" : "rgba(77,141,247,.35)";
            context.stroke();
          }
          if (visible.nodes.length <= 100 || active || hot) {
            const fontSize = Math.max(9, Math.min(13, 11 / Math.max(.75, transform.scale)));
            context.font = `${active ? 600 : 400} ${fontSize}px sans-serif`;
            context.fillStyle = dark ? "rgba(238,242,248,.88)" : "rgba(45,54,66,.80)";
            context.textBaseline = "middle";
            context.fillText(node.title, point.x + radius + 4, point.y, 220);
          }
        }
      }, [visible, layout, size, transform, selectedId, hovered]);

      const graphPoint = (event) => {
        const rect = canvasRef.current.getBoundingClientRect();
        return {
          screenX: event.clientX - rect.left,
          screenY: event.clientY - rect.top,
          x: (event.clientX - rect.left - transform.x) / transform.scale,
          y: (event.clientY - rect.top - transform.y) / transform.scale,
        };
      };

      const hitNode = (event) => {
        const point = graphPoint(event);
        let best = null;
        let bestDistance = 16 / transform.scale;
        for (const node of visible.nodes) {
          const position = layout.get(node.id);
          if (!position) continue;
          const distance = Math.hypot(position.x - point.x, position.y - point.y);
          if (distance < bestDistance) {
            best = node;
            bestDistance = distance;
          }
        }
        return { node: best, point };
      };

      const selectNode = (node) => {
        if (!node) return;
        setSelectedId(node.id);
        window.dispatchEvent(new CustomEvent("knowledge-vault:open-file", {
          detail: { path: node.path },
        }));
      };

      const pointerDown = (event) => {
        canvasRef.current.setPointerCapture?.(event.pointerId);
        dragRef.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          originX: transform.x,
          originY: transform.y,
          moved: false,
        };
      };

      const pointerMove = (event) => {
        const drag = dragRef.current;
        if (drag?.pointerId === event.pointerId) {
          const dx = event.clientX - drag.x;
          const dy = event.clientY - drag.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
          if (drag.moved) {
            setDragging(true);
            setTransform((value) => ({ ...value, x: drag.originX + dx, y: drag.originY + dy }));
          }
          return;
        }
        const hit = hitNode(event);
        setHovered(hit.node ? { id: hit.node.id, x: hit.point.screenX, y: hit.point.screenY } : null);
      };

      const pointerUp = (event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        if (!drag.moved) selectNode(hitNode(event).node);
        dragRef.current = null;
        setDragging(false);
      };

      const wheel = (event) => {
        event.preventDefault();
        const rect = canvasRef.current.getBoundingClientRect();
        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;
        const factor = Math.exp(-event.deltaY * .0012);
        setTransform((value) => {
          const scale = Math.max(.06, Math.min(5, value.scale * factor));
          const graphX = (screenX - value.x) / value.scale;
          const graphY = (screenY - value.y) / value.scale;
          return { scale, x: screenX - graphX * scale, y: screenY - graphY * scale };
        });
      };

      const refresh = () => {
        refreshRef.current = true;
        setRevision((value) => value + 1);
      };
      const renderOptions = (values, emptyLabel) => [
        e("option", { key: "", value: "" }, emptyLabel),
        ...values.map((value) => e("option", { key: value, value }, value)),
      ];
      const selectProps = (value, setValue, label) => ({
        className: "kv-graph-select",
        value,
        onChange: (event) => setValue(event.target.value),
        "aria-label": label,
        title: label,
      });

      const hoveredNode = hovered ? nodeById.get(hovered.id) : null;
      const summary = graph
        ? `${visible.nodes.length}/${graph.nodeCount} 个节点 · ${visible.edges.length}/${graph.edgeCount} 条关系 · ${graph.unresolvedCount} 个未解析`
        : "";

      return e("section", { className: "kv-graph", "aria-label": "知识关联图谱" },
        e("header", { className: "kv-graph-toolbar" },
          e("div", { className: "kv-graph-heading" },
            e("div", { className: "kv-graph-title", title: graph?.rootName || "知识库" }, `${graph?.rootName || "知识库"} · 知识图谱`),
            e("div", { className: "kv-graph-summary" }, summary),
          ),
          e("div", { className: "kv-graph-controls" },
            e("input", {
              className: "kv-graph-input",
              value: query,
              onChange: (event) => setQuery(event.target.value),
              placeholder: "搜索标题或路径",
              "aria-label": "搜索图谱节点",
            }),
            e("select", selectProps(folder, setFolder, "按一级目录筛选"), renderOptions(folders, "全部目录")),
            e("select", selectProps(type, setType, "按知识类型筛选"), renderOptions(types, "全部类型")),
            e("select", selectProps(status, setStatus, "按状态筛选"), renderOptions(statuses, "全部状态")),
            e("select", selectProps(tag, setTag, "按标签筛选"), renderOptions(tags, "全部标签")),
            e("select", selectProps(relation, setRelation, "按关系类型筛选"), renderOptions(relationKinds, "全部关系")),
            e("button", {
              type: "button",
              className: "kv-graph-action",
              "data-active": showOrphans ? "true" : "false",
              onClick: () => setShowOrphans((value) => !value),
              title: "显示或隐藏没有显式关系的笔记",
            }, "孤立节点"),
            e("button", {
              type: "button",
              className: "kv-graph-action",
              "data-active": localOnly ? "true" : "false",
              disabled: !selectedId,
              onClick: () => setLocalOnly((value) => !value),
              title: selectedId ? "只显示所选笔记两跳以内的关系" : "请先选择一个节点",
            }, "局部 2 跳"),
            e("button", { type: "button", className: "kv-graph-action", onClick: fitGraph }, "适应画布"),
            e("button", { type: "button", className: "kv-graph-action", onClick: refresh, disabled: loading }, loading ? "刷新中…" : "刷新"),
          ),
        ),
        e("div", { ref: stageRef, className: "kv-graph-stage" },
          e("canvas", {
            ref: canvasRef,
            className: "kv-graph-canvas",
            "data-dragging": dragging ? "true" : "false",
            tabIndex: 0,
            onPointerDown: pointerDown,
            onPointerMove: pointerMove,
            onPointerUp: pointerUp,
            onPointerCancel: pointerUp,
            onPointerLeave: () => { if (!dragRef.current) setHovered(null); },
            onWheel: wheel,
            "aria-label": "可拖拽和缩放的知识关联图谱；点击节点可在右侧预览笔记",
          }),
          loading ? e("div", { className: "kv-graph-message" }, "正在生成知识图谱…") : null,
          error ? e("div", { className: "kv-graph-message" }, error) : null,
          !loading && !error && visible.nodes.length === 0
            ? e("div", { className: "kv-graph-message" }, "当前筛选条件下没有节点。")
            : null,
          hoveredNode ? e("div", {
            className: "kv-graph-tooltip",
            style: { left: `${hovered.x}px`, top: `${hovered.y}px` },
          },
            e("strong", null, hoveredNode.title),
            e("span", null, `${hoveredNode.path} · ${hoveredNode.degree} 条关系`),
          ) : null,
        ),
        e("footer", { className: "kv-graph-footer" },
          e("div", { className: "kv-graph-selection" },
            selected
              ? e(React.Fragment, null,
                e("strong", { title: selected.title }, selected.title),
                e("span", { title: selected.path }, `${selected.path} · 入 ${selected.inDegree} / 出 ${selected.outDegree}`),
                e("button", { type: "button", className: "kv-graph-action", onClick: () => selectNode(selected) }, "右侧预览"),
              )
              : e("span", null, "单击节点可选择并在右侧预览；拖拽平移，滚轮缩放。"),
          ),
          e("div", { className: "kv-graph-legend", "aria-label": "图例" },
            e("span", null, e("i", { className: "kv-graph-dot", style: { background: "#4d8df7" } }), "目录节点"),
            e("span", null, e("i", { className: "kv-graph-dot", style: { background: "#ff7a16" } }), "当前选择"),
          ),
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
      return e("img", {
        className: "kv-brand-mark",
        src: FAVICON_URL,
        alt: "",
        width: 24,
        height: 24,
        "aria-hidden": true,
      });
    }

    function BrandName() {
      return e("span", { className: "kv-brand-name" }, "Knowledge Vault");
    }

    function HeroBrandMark() {
      const logoRef = React.useRef(null);
      React.useLayoutEffect(() => {
        const logo = logoRef.current;
        const headline = logo?.closest('[class*="_headline"]');
        const hitbox = logo?.closest('[class*="_fishHitbox"]') || headline?.firstElementChild;
        if (!headline || !hitbox) return undefined;

        const headlineStyle = headline.getAttribute("style");
        const hitboxStyle = hitbox.getAttribute("style");
        const hiddenSiblings = Array.from(headline.children).filter((child) => child !== hitbox);
        const siblingStyles = hiddenSiblings.map((child) => child.getAttribute("style"));

        headline.style.gridTemplateColumns = "auto";
        hitbox.style.gridArea = "1 / 1";
        hitbox.style.justifySelf = "center";
        hitbox.style.width = "min(258px, 70vw)";
        hitbox.style.height = "auto";
        hiddenSiblings.forEach((child) => {
          child.style.display = "none";
        });

        return () => {
          if (headlineStyle === null) headline.removeAttribute("style");
          else headline.setAttribute("style", headlineStyle);
          if (hitboxStyle === null) hitbox.removeAttribute("style");
          else hitbox.setAttribute("style", hitboxStyle);
          hiddenSiblings.forEach((child, index) => {
            const style = siblingStyles[index];
            if (style === null) child.removeAttribute("style");
            else child.setAttribute("style", style);
          });
        };
      }, []);

      return e("img", {
        ref: logoRef,
        className: "kv-hero-logo",
        src: BRAND_LOGO_URL,
        alt: "贝内克长顺 · BENECKE CHANGSHUN",
        width: 258,
        height: 82,
      });
    }

    const inject = ["slots", "workspaces"];
    function apply(ctx) {
      const InitializationLauncher = createInitializationLauncher(ctx);
      ctx.effect(() => {
        if (typeof document === "undefined") return () => {};
        const originalTitle = document.title;
        const originalIcons = new Map();
        const ensureDocumentBrand = () => {
          if (document.title !== DOCUMENT_TITLE) document.title = DOCUMENT_TITLE;
          let icons = Array.from(document.head.querySelectorAll('link[rel~="icon"]'));
          if (icons.length === 0) {
            const icon = document.createElement("link");
            icon.rel = "icon";
            icon.dataset.knowledgeVaultFavicon = "true";
            document.head.appendChild(icon);
            icons = [icon];
          }
          icons.forEach((icon) => {
            if (!originalIcons.has(icon) && icon.dataset.knowledgeVaultFavicon !== "true") {
              originalIcons.set(icon, {
                href: icon.getAttribute("href"),
                type: icon.getAttribute("type"),
              });
            }
            if (icon.getAttribute("href") !== FAVICON_URL) icon.setAttribute("href", FAVICON_URL);
            if (icon.getAttribute("type") !== "image/png") icon.setAttribute("type", "image/png");
          });
        };
        ensureDocumentBrand();
        const observer = new MutationObserver(ensureDocumentBrand);
        observer.observe(document.head, {
          attributes: true,
          childList: true,
          characterData: true,
          subtree: true,
        });
        return () => {
          observer.disconnect();
          document.title = originalTitle;
          document.querySelectorAll('[data-knowledge-vault-favicon="true"]').forEach((icon) => icon.remove());
          originalIcons.forEach((value, icon) => {
            if (value.href === null) icon.removeAttribute("href");
            else icon.setAttribute("href", value.href);
            if (value.type === null) icon.removeAttribute("type");
            else icon.setAttribute("type", value.type);
          });
        };
      }, "knowledge-vault-bootstrap: document title and favicon");
      ctx.slots.inject("conversation.view", () => ctx.slots.register({
        name: "conversation.view",
        id: "knowledge-graph",
        order: 20,
        label: () => "图谱",
      }, KnowledgeGraphView));
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
      ctx.slots.inject("conversation.hero.brand.mark", () => ctx.slots.register({ name: "conversation.hero.brand.mark", priority: -100 }, HeroBrandMark));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
