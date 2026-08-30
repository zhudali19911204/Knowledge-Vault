window.__ModuleLoader__.load({
  id: "@knowledge-vault/dsh-bootstrap",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const { MarkdownText } = require("@deepseek-ai/dsh-client-ui-primitives");
    const e = React.createElement;
    const API_PREFIX = "/knowledge-vault/api";
    const BRAND_LOGO_URL = "/knowledge-vault/assets/bkcs-logo.png";
    const FAVICON_URL = "/knowledge-vault/assets/knowledge-vault-favicon.png";
    const GRAPH_WORKER_URL = "/knowledge-vault/assets/graph-worker.js";
    const GRAPH_WORKER_THRESHOLD = 700;
    const GRAPH_DYNAMIC_NODE_LIMIT = 3000;
    const GRAPH_SETTINGS_STORAGE_KEY = "knowledge-vault:graph-settings";
    const DEFAULT_GRAPH_SETTINGS = Object.freeze({
      repulsion: 150,
      linkDistance: 1,
      clusterStrength: 55,
      centerStrength: 12,
      nodeScale: 1,
      edgeWidth: 1,
      labelLimit: 100,
    });
    let pendingGraphSettings = null;
    let graphSettingsSavePromise = null;
    let activeReaderDocument = null;
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
      .kv-init-icon{width:18px;height:18px;display:inline-grid;place-items:center;font-size:16px;line-height:1;flex:none}
      .kv-init-icon-svg{display:block;width:16px;height:16px;overflow:visible}
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
      .kv-preview-header{min-height:42px;box-sizing:border-box;padding:8px 8px 8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;align-items:center;gap:8px}
      .kv-preview-heading{min-width:0;flex:1}
      .kv-preview-name{font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .kv-preview-meta{margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .kv-preview-body{margin:0;padding:12px;overflow:auto;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-secondary);font:12px/1.65 var(--ds-font-family-code);flex:1}
      .kv-preview-scroll{flex:1;min-height:0;overflow:auto}
      .kv-preview-expand{height:28px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-elevated-fill);color:var(--dsw-alias-label-secondary);padding:0 8px;cursor:pointer;font:11px var(--dsw-font-family);white-space:nowrap}
      .kv-preview-expand:hover{background:var(--dsw-alias-button-floating-hover);color:var(--dsw-alias-label-primary)}
      .kv-preview-empty{padding:14px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:20px}
      .kv-markdown-document{box-sizing:border-box;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);font-size:15px;line-height:1.75;container-type:inline-size}
      .kv-markdown-document[data-compact="true"]{padding:12px 13px;font-size:13px;line-height:1.65}
      .kv-markdown-document[data-compact="false"]{width:min(920px,100%);margin:0 auto;padding:28px 34px 64px;font-size:16px;line-height:1.75}
      .kv-markdown-document img{display:block;max-width:100%;height:auto;margin:16px auto;border-radius:8px}
      .kv-markdown-frontmatter{margin:0 0 16px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.55}
      .kv-markdown-frontmatter summary{cursor:pointer;padding:8px 10px;color:var(--dsw-alias-label-secondary);font-weight:600}
      .kv-markdown-frontmatter pre{max-height:240px;margin:0;padding:0 10px 10px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.55 var(--ds-font-family-code)}
      .kv-markdown-frontmatter pre a{color:var(--dsw-alias-label-primary);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px;cursor:pointer}
      .kv-markdown-frontmatter pre a:hover{color:#d85f16}
      .kv-markdown-empty{color:var(--dsw-alias-label-tertiary);font-style:italic}
      .kv-reader{height:100%;min-height:0;box-sizing:border-box;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family)}
      .kv-reader-header{flex:none;min-height:58px;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:10px 18px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1)}
      .kv-reader-heading{min-width:0;flex:1}
      .kv-reader-title{font-size:15px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .kv-reader-meta{margin-top:3px;color:var(--dsw-alias-label-tertiary);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .kv-reader-scroll{flex:1;min-height:0;overflow:auto}
      .kv-reader-empty{display:grid;place-items:center;min-height:100%;padding:28px;color:var(--dsw-alias-label-tertiary);font-size:13px;text-align:center}
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
      .kv-graph-settings{position:absolute;z-index:4;top:12px;right:12px;width:286px;box-sizing:border-box;padding:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-2);box-shadow:0 10px 32px #0003;font-size:12px}
      .kv-graph-settings-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}
      .kv-graph-settings-title{font-size:13px;font-weight:650;flex:1}
      .kv-graph-setting{display:grid;grid-template-columns:76px 1fr 42px;align-items:center;gap:8px;min-height:30px;color:var(--dsw-alias-label-secondary)}
      .kv-graph-setting input[type="range"]{width:100%;accent-color:#ed7b2f}
      .kv-graph-setting output{text-align:right;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
      .kv-graph-settings-note{margin-top:8px;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:16px}
      .kv-graph-settings-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}
      .kv-graph-performance{position:absolute;z-index:3;left:50%;top:14px;transform:translateX(-50%);max-width:min(560px,75%);padding:7px 11px;border:1px solid #efbd86;border-radius:8px;background:#fff6e9;color:#944b08;font-size:11px;line-height:16px;text-align:center}
      .kv-stats{height:100%;min-height:0;box-sizing:border-box;overflow:auto;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family)}
      .kv-stats-header{position:sticky;z-index:3;top:0;min-height:58px;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:11px 18px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1)}
      .kv-stats-heading{min-width:0;flex:1}
      .kv-stats-title{font-size:15px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .kv-stats-subtitle{margin-top:3px;color:var(--dsw-alias-label-tertiary);font-size:10px}
      .kv-stats-body{box-sizing:border-box;width:min(1180px,100%);margin:0 auto;padding:16px 18px 28px}
      .kv-stat-cards{display:grid;grid-template-columns:repeat(6,minmax(116px,1fr));gap:10px}
      .kv-stat-card{min-width:0;min-height:86px;box-sizing:border-box;padding:13px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-2)}
      .kv-stat-label{color:var(--dsw-alias-label-tertiary);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .kv-stat-value{margin-top:7px;font-size:24px;font-weight:680;line-height:28px;font-variant-numeric:tabular-nums}
      .kv-stat-note{margin-top:4px;color:var(--dsw-alias-label-tertiary);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .kv-stats-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}
      .kv-stats-panel{min-width:0;box-sizing:border-box;padding:14px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-2)}
      .kv-stats-panel-title{font-size:13px;font-weight:650}
      .kv-stats-panel-note{margin-top:3px;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:15px}
      .kv-stat-bars{display:flex;flex-direction:column;gap:9px;margin-top:13px}
      .kv-stat-bar-row{display:grid;grid-template-columns:minmax(72px,1fr) 3fr 36px;align-items:center;gap:9px;min-height:18px;font-size:11px}
      .kv-stat-bar-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary)}
      .kv-stat-bar-track{height:7px;border-radius:5px;background:var(--dsw-alias-interactive-bg-hover);overflow:hidden}
      .kv-stat-bar-fill{height:100%;min-width:2px;border-radius:5px;background:#4d8df7}
      .kv-stat-bar-value{text-align:right;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
      .kv-stats-empty{padding:18px 0;color:var(--dsw-alias-label-tertiary);font-size:11px;text-align:center}
      .kv-stats-lower{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(260px,.65fr);gap:12px;margin-top:12px}
      .kv-health-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}
      .kv-health-card{min-width:0;box-sizing:border-box;display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:transparent;color:inherit;text-align:left;font:inherit;cursor:pointer}
      .kv-health-card:hover,.kv-health-card[data-active="true"]{border-color:#ed7b2f;background:#fff5ec}
      .kv-health-card:disabled{cursor:default;opacity:.72}
      .kv-health-count{min-width:30px;font-size:20px;font-weight:680;font-variant-numeric:tabular-nums;color:#c95d18;text-align:center}
      .kv-health-count[data-zero="true"]{color:#28a878}
      .kv-health-copy{min-width:0;flex:1}
      .kv-health-label{font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .kv-health-description{margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:9px;line-height:13px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .kv-issue-list{margin-top:10px;border-top:1px solid var(--dsw-alias-border-l1);padding-top:8px}
      .kv-issue-list-head{display:flex;align-items:center;gap:8px;margin-bottom:5px;color:var(--dsw-alias-label-secondary);font-size:10px}
      .kv-file-row{width:100%;box-sizing:border-box;border:0;border-radius:7px;background:transparent;color:inherit;display:flex;align-items:center;gap:9px;padding:7px 8px;text-align:left;cursor:pointer;font:inherit}
      .kv-file-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .kv-file-copy{min-width:0;flex:1}
      .kv-file-title{display:block;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .kv-file-meta{display:block;margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .kv-file-time{flex:none;color:var(--dsw-alias-label-tertiary);font-size:9px;white-space:nowrap}
      .kv-stats-definitions{margin-top:12px;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:17px}
      .kv-stats-definitions summary{cursor:pointer;color:var(--dsw-alias-label-secondary)}
      .kv-stats-definitions p{margin:6px 0 0}
      @media(prefers-color-scheme:dark){.kv-graph-performance{background:#332619;color:#ffc387;border-color:#7d542b}}
      @media(prefers-color-scheme:dark){.kv-health-card:hover,.kv-health-card[data-active="true"]{background:#332619;border-color:#9b6434}}
      @media(max-width:1050px){.kv-stat-cards{grid-template-columns:repeat(3,minmax(116px,1fr))}.kv-health-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:900px){.kv-graph-toolbar{padding-inline:10px}.kv-graph-input{width:170px}.kv-graph-summary{display:none}.kv-graph-footer{padding-inline:10px}.kv-graph-legend{display:none}.kv-stats-grid,.kv-stats-lower{grid-template-columns:1fr}}
      @media(max-width:620px){.kv-stats-header{padding-inline:10px}.kv-stats-body{padding:12px 10px 22px}.kv-stat-cards{grid-template-columns:repeat(2,minmax(104px,1fr))}.kv-health-grid{grid-template-columns:1fr}}
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

    async function getStats(refresh = false) {
      const response = await fetch(`${API_PREFIX}/stats${refresh ? "?refresh=1" : ""}`, {
        headers: { accept: "application/json" },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
      return body;
    }

    async function getGraphSettings() {
      await waitForGraphSettingsSave();
      const response = await fetch(`${API_PREFIX}/graph-settings`, {
        headers: { accept: "application/json" },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
      return body;
    }

    function startGraphSettingsSave() {
      if (graphSettingsSavePromise || !pendingGraphSettings) return;
      const settings = pendingGraphSettings;
      pendingGraphSettings = null;
      graphSettingsSavePromise = postJson("graph-settings", { settings }).catch(() => {
        // The origin-scoped browser copy remains the fallback if backend persistence is unavailable.
      }).finally(() => {
        graphSettingsSavePromise = null;
        startGraphSettingsSave();
      });
    }

    function queueGraphSettingsSave(settings) {
      pendingGraphSettings = { ...settings };
      startGraphSettingsSave();
    }

    async function waitForGraphSettingsSave() {
      while (pendingGraphSettings || graphSettingsSavePromise) {
        startGraphSettingsSave();
        if (graphSettingsSavePromise) await graphSettingsSavePromise;
      }
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
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
      return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
    }

    function isMarkdownDocument(document) {
      return /\.md$/i.test(String(document?.path || document?.name || ""));
    }

    function splitMarkdownSource(source) {
      const text = String(source || "").replace(/^\uFEFF/, "");
      const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
      return match
        ? { frontmatter: match[1].trim(), body: text.slice(match[0].length) }
        : { frontmatter: "", body: text };
    }

    function isSupportedImagePath(path) {
      return /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|tiff?|webp)$/i.test(String(path || ""));
    }

    function resolveVaultImagePath(documentPath, requestedPath, obsidianEmbed = false) {
      let target = String(requestedPath || "").trim().replaceAll("\\", "/");
      if (!target || target.includes("\0")) return "";
      try {
        target = decodeURIComponent(target);
      } catch {
        // Keep literal percent characters from valid Vault filenames.
      }
      target = target.split(/[?#]/, 1)[0].trim();
      if (!target || !isSupportedImagePath(target)) return "";

      const explicitRelative = target.startsWith("./") || target.startsWith("../");
      const vaultRelative = target.startsWith("/") ||
        target.startsWith("07_Attachments/") ||
        (obsidianEmbed && target.includes("/") && !explicitRelative);
      const parts = vaultRelative
        ? []
        : String(documentPath || "").replaceAll("\\", "/").split("/").slice(0, -1).filter(Boolean);
      for (const part of target.replace(/^\/+/, "").split("/")) {
        if (!part || part === ".") continue;
        if (part === "..") {
          if (parts.length === 0) return "";
          parts.pop();
        } else {
          parts.push(part);
        }
      }
      return parts.join("/");
    }

    function vaultImageUrl(path) {
      const url = new URL(`${API_PREFIX}/image`, window.location.origin);
      url.searchParams.set("path", path);
      return url.href;
    }

    function markdownImageAlt(value) {
      return String(value || "").replaceAll("\\", "\\\\").replaceAll("]", "\\]");
    }

    function rewriteMarkdownImageLine(line, documentPath) {
      const standardImages = line.replace(
        /!\[([^\]\r\n]*)\]\(\s*(?:<([^>\r\n]+)>|([^\s)\r\n]+))(?:(?:\s+)(?:"[^"\r\n]*"|'[^'\r\n]*'|\([^\)\r\n]*\)))?\s*\)/g,
        (source, alt, angleTarget, plainTarget) => {
          const target = angleTarget || plainTarget || "";
          if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target) || target.startsWith(`${API_PREFIX}/image`)) {
            return source;
          }
          const path = resolveVaultImagePath(documentPath, target, false);
          return path ? `![${alt}](${vaultImageUrl(path)})` : source;
        },
      );
      return standardImages.replace(/!\[\[([^\]\r\n]+)\]\]/g, (source, value) => {
        const [target, ...options] = value.split("|");
        const path = resolveVaultImagePath(documentPath, target, true);
        if (!path) return source;
        const option = options.join("|").trim();
        const fallbackAlt = path.split("/").pop()?.replace(/\.[^.]+$/, "") || "图片";
        const alt = option && !/^\d+(?:x\d+)?$/i.test(option) ? option : fallbackAlt;
        return `![${markdownImageAlt(alt)}](${vaultImageUrl(path)})`;
      });
    }

    function renderMarkdownSource(source, documentPath) {
      let fence = "";
      return String(source || "").replace(/[^\r\n]*(?:\r\n|\n|$)/g, (line) => {
        const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
        if (marker) {
          if (!fence) fence = marker[1][0];
          else if (marker[1][0] === fence) fence = "";
          return line;
        }
        if (fence) return line;
        return rewriteObsidianDocumentLinkLine(rewriteMarkdownImageLine(line, documentPath), documentPath);
      });
    }

    function resolveVaultDocumentPath(documentPath, requestedPath) {
      let target = String(requestedPath || "").trim().replaceAll("\\", "/");
      if (!target || target.includes("\0") || target.startsWith("#") || target.startsWith("//")) return "";

      if (/^[a-z][a-z\d+.-]*:/i.test(target)) {
        let url;
        try {
          url = new URL(target, window.location.origin);
        } catch {
          return "";
        }
        if (url.origin !== window.location.origin) return "";
        target = url.pathname;
      }

      target = target.split(/[?#]/, 1)[0].trim();
      try {
        target = decodeURIComponent(target);
      } catch {
        // Keep literal percent characters from valid Vault filenames.
      }
      target = target.replaceAll("\\", "/");
      if (!/\.md$/i.test(target)) return "";

      const vaultRelative = target.startsWith("/");
      const parts = vaultRelative
        ? []
        : String(documentPath || "").replaceAll("\\", "/").split("/").slice(0, -1).filter(Boolean);
      for (const part of target.replace(/^\/+/, "").split("/")) {
        if (!part || part === ".") continue;
        if (part === "..") {
          if (parts.length === 0) return "";
          parts.pop();
        } else {
          parts.push(part);
        }
      }
      return parts.join("/");
    }

    function normalizeObsidianDocumentLink(documentPath, value) {
      const [rawTarget, ...aliasParts] = String(value || "").split("|");
      const target = rawTarget.trim().replaceAll("\\", "/");
      if (!target || target.includes("\0") || target.startsWith("#") || target.startsWith("//")) return null;
      if (/^[a-z][a-z\d+.-]*:/i.test(target)) return null;

      const referenceIndex = target.search(/[#^]/);
      const targetPath = (referenceIndex < 0 ? target : target.slice(0, referenceIndex)).trim();
      const reference = referenceIndex < 0 ? "" : target.slice(referenceIndex);
      if (!targetPath || /\.(?:png|jpe?g|gif|webp|avif|svg|bmp|pdf|docx?|xlsx?|pptx?|csv|tsv|zip|7z|rar|mp3|wav|m4a|mp4|mov|avi)$/i.test(targetPath)) {
        return null;
      }

      const markdownPath = /\.md$/i.test(targetPath) ? targetPath : `${targetPath}.md`;
      const explicitRelative = markdownPath.startsWith("./") || markdownPath.startsWith("../");
      const vaultRelative = markdownPath.startsWith("/") || (!explicitRelative && markdownPath.includes("/"));
      const requestedPath = `${vaultRelative ? `/${markdownPath.replace(/^\/+/, "")}` : markdownPath}${reference}`;
      const path = resolveVaultDocumentPath(documentPath, requestedPath);
      if (!path) return null;

      const fallbackLabel = targetPath.split("/").pop()?.replace(/\.md$/i, "") || targetPath;
      const label = aliasParts.join("|").trim() || fallbackLabel;
      return { label, requestedPath, path };
    }

    function markdownLinkLabel(value) {
      return String(value || "").replaceAll("\\", "\\\\").replaceAll("[", "\\[").replaceAll("]", "\\]");
    }

    function rewriteObsidianDocumentLinkLine(line, documentPath) {
      return String(line || "").replace(/(^|[^!])\[\[([^\]\r\n]+)\]\]/g, (source, prefix, value) => {
        const link = normalizeObsidianDocumentLink(documentPath, value);
        if (!link) return source;
        const destination = link.requestedPath.replaceAll("<", "%3C").replaceAll(">", "%3E");
        return `${prefix}[${markdownLinkLabel(link.label)}](<${destination}>)`;
      });
    }

    function findObsidianVaultDocumentLinks(text, documentPath = "") {
      const source = String(text || "");
      const pattern = /(^|[^!])\[\[([^\]\r\n]+)\]\]/g;
      const matches = [];
      let match;
      while ((match = pattern.exec(source)) !== null) {
        const link = normalizeObsidianDocumentLink(documentPath, match[2]);
        if (!link) continue;
        matches.push({
          index: match.index + match[1].length,
          length: match[0].length - match[1].length,
          ...link,
        });
      }
      return matches;
    }

    function tokenizeFrontmatterRelatedLinks(frontmatter, documentPath = "") {
      const lines = String(frontmatter || "").split(/\r?\n/);
      const tokens = [];
      let activeProperty = "";
      lines.forEach((line, lineIndex) => {
        const property = line.match(/^([A-Za-z_][A-Za-z\d_-]*):(?:\s|$)/);
        if (property) activeProperty = property[1];
        const links = activeProperty === "related"
          ? findObsidianVaultDocumentLinks(line, documentPath)
          : [];
        if (links.length === 0) {
          tokens.push({ kind: "text", text: line });
        } else {
          let cursor = 0;
          links.forEach((link) => {
            if (link.index > cursor) tokens.push({ kind: "text", text: line.slice(cursor, link.index) });
            tokens.push({ kind: "link", ...link });
            cursor = link.index + link.length;
          });
          if (cursor < line.length) tokens.push({ kind: "text", text: line.slice(cursor) });
        }
        if (lineIndex < lines.length - 1) tokens.push({ kind: "text", text: "\n" });
      });
      return tokens;
    }

    function FrontmatterDocumentProperties({ frontmatter, documentPath }) {
      const tokens = tokenizeFrontmatterRelatedLinks(frontmatter, documentPath);
      return e("pre", null, ...tokens.map((token, index) => token.kind === "link"
        ? e("a", {
          key: `related-${index}-${token.path}`,
          href: token.requestedPath,
          "data-knowledge-vault-path": token.path,
          title: `在阅读器中打开：${token.path}`,
        }, token.label)
        : token.text));
    }

    function findMalformedVaultMarkdownLinks(text, documentPath = "") {
      const source = String(text || "");
      const pattern = /\[([^\]\r\n]+)\]\(([^)\r\n]+?\.md(?:[?#][^)\r\n]*)?)\)/gi;
      const matches = [];
      let match;
      while ((match = pattern.exec(source)) !== null) {
        const requestedPath = match[2].trim();
        if (requestedPath.startsWith("<") && requestedPath.endsWith(">")) continue;
        const path = resolveVaultDocumentPath(documentPath, requestedPath);
        if (!path) continue;
        matches.push({
          index: match.index,
          length: match[0].length,
          label: match[1],
          requestedPath,
          path,
        });
      }
      return matches;
    }

    function upgradeMalformedVaultMarkdownLinks(root) {
      if (!root) return 0;
      const ownerDocument = root.ownerDocument || document;
      const textNodes = [];
      if (root.nodeType === 3) {
        textNodes.push(root);
      } else if (typeof ownerDocument.createTreeWalker === "function") {
        const walker = ownerDocument.createTreeWalker(root, globalThis.NodeFilter?.SHOW_TEXT || 4);
        let node;
        while ((node = walker.nextNode())) textNodes.push(node);
      }

      let upgraded = 0;
      for (const node of textNodes) {
        const parent = node.parentElement;
        const text = String(node.nodeValue || "");
        if (!parent || (!text.includes(".md)") && !text.includes("[["))) continue;
        if (parent.closest("a,code,pre,script,style,textarea,[contenteditable=\"true\"]")) continue;
        if (parent.closest('[data-streaming="true"]')) continue;
        const documentPath = parent.closest("[data-vault-document-path]")?.getAttribute("data-vault-document-path") || "";
        const links = [
          ...findMalformedVaultMarkdownLinks(text, documentPath),
          ...findObsidianVaultDocumentLinks(text, documentPath),
        ].sort((left, right) => left.index - right.index);
        if (links.length === 0) continue;

        const fragment = ownerDocument.createDocumentFragment();
        let cursor = 0;
        for (const link of links) {
          if (link.index > cursor) fragment.appendChild(ownerDocument.createTextNode(text.slice(cursor, link.index)));
          const anchor = ownerDocument.createElement("a");
          anchor.textContent = link.label;
          anchor.setAttribute("href", link.requestedPath);
          anchor.setAttribute("data-knowledge-vault-path", link.path);
          anchor.setAttribute("title", `在阅读器中打开：${link.path}`);
          fragment.appendChild(anchor);
          cursor = link.index + link.length;
        }
        if (cursor < text.length) fragment.appendChild(ownerDocument.createTextNode(text.slice(cursor)));
        node.parentNode?.replaceChild(fragment, node);
        upgraded += links.length;
      }
      return upgraded;
    }

    function MarkdownDocument({ document, compact = false }) {
      const { frontmatter, body } = splitMarkdownSource(document?.content || "");
      const renderedBody = renderMarkdownSource(body, document?.path || "");
      return e("article", {
        className: "kv-markdown-document",
        "data-compact": compact ? "true" : "false",
        "data-vault-document-path": document?.path || "",
      },
        frontmatter ? e("details", { className: "kv-markdown-frontmatter" },
          e("summary", null, "文档属性"),
          e(FrontmatterDocumentProperties, {
            frontmatter,
            documentPath: document?.path || "",
          }),
        ) : null,
        renderedBody.trim()
          ? e(MarkdownText, {
            text: renderedBody,
            codeLabels: { copyLabel: "复制", copiedLabel: "已复制" },
          })
          : e("div", { className: "kv-markdown-empty" }, "此 Markdown 文档没有正文。"),
      );
    }

    function activateReaderTab() {
      const tab = Array.from(document.querySelectorAll('[role="tab"]')).find(
        (element) => element.textContent?.trim() === "阅读",
      );
      tab?.click();
    }

    function expandMarkdownDocument(document) {
      if (!document?.previewable || !isMarkdownDocument(document)) return;
      activeReaderDocument = document;
      window.dispatchEvent(new CustomEvent("knowledge-vault:read-document", {
        detail: { document },
      }));
      window.requestAnimationFrame(activateReaderTab);
    }

    function MarkdownReaderView() {
      const [readerDocument, setReaderDocument] = React.useState(() => activeReaderDocument);
      const [loading, setLoading] = React.useState(false);
      const [error, setError] = React.useState("");

      React.useEffect(() => {
        const openDocument = (event) => {
          const document = event?.detail?.document;
          if (!document?.previewable || !isMarkdownDocument(document)) return;
          activeReaderDocument = document;
          setReaderDocument(document);
          setError("");
        };
        const clearDocument = () => {
          activeReaderDocument = null;
          setReaderDocument(null);
          setError("");
        };
        window.addEventListener("knowledge-vault:read-document", openDocument);
        window.addEventListener("knowledge-vault:changed", clearDocument);
        return () => {
          window.removeEventListener("knowledge-vault:read-document", openDocument);
          window.removeEventListener("knowledge-vault:changed", clearDocument);
        };
      }, []);

      const refresh = async () => {
        if (!readerDocument?.path) return;
        setLoading(true);
        setError("");
        try {
          const result = await getJson("file", readerDocument.path);
          activeReaderDocument = result;
          setReaderDocument(result);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
          setLoading(false);
        }
      };

      if (!readerDocument) {
        return e("section", { className: "kv-reader", "aria-label": "Markdown 阅读器" },
          e("div", { className: "kv-reader-empty" }, "请先在右侧知识库中选择 Markdown 文档，然后点击“放大阅读”。"),
        );
      }

      return e("section", { className: "kv-reader", "aria-label": "Markdown 阅读器" },
        e("header", { className: "kv-reader-header" },
          e("div", { className: "kv-reader-heading" },
            e("div", { className: "kv-reader-title", title: readerDocument.name }, readerDocument.name),
            e("div", { className: "kv-reader-meta", title: readerDocument.path },
              `${readerDocument.path} · ${formatBytes(readerDocument.bytes || 0)}`,
            ),
          ),
          e("button", {
            type: "button",
            className: "kv-graph-action",
            onClick: refresh,
            disabled: loading,
          }, loading ? "刷新中…" : "刷新文档"),
        ),
        error ? e("div", { className: "kv-explorer-status" }, error) : null,
        e("div", { className: "kv-reader-scroll" },
          e(MarkdownDocument, { document: readerDocument }),
        ),
      );
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
          activeReaderDocument = null;
          setSelected(null);
          setPreview(null);
          setRevision((value) => value + 1);
        };
        window.addEventListener("knowledge-vault:changed", refreshActiveVault);
        return () => window.removeEventListener("knowledge-vault:changed", refreshActiveVault);
      }, []);

      const selectFile = async (entry, options = {}) => {
        setSelected(entry);
        setPreview({ loading: true, name: entry.name, path: entry.path });
        try {
          const result = await getJson("file", entry.path);
          setPreview(result);
          if (options.openReader && result.previewable && isMarkdownDocument(result)) {
            expandMarkdownDocument(result);
          }
        } catch (cause) {
          setPreview({
            name: entry.name,
            path: entry.path,
            error: cause instanceof Error ? cause.message : String(cause),
          });
        }
      };

      React.useEffect(() => {
        const openVaultFile = (event) => {
          const path = event?.detail?.path;
          if (typeof path !== "string" || !path) return;
          const name = path.split("/").pop() || path;
          void selectFile({ type: "file", path, name }, {
            openReader: event?.detail?.openReader === true,
          });
        };
        window.addEventListener("knowledge-vault:open-file", openVaultFile);
        return () => window.removeEventListener("knowledge-vault:open-file", openVaultFile);
      }, []);

      let previewContent = e("div", { className: "kv-preview-empty" }, "选择 Markdown 或文本文件即可在这里预览。");
      if (preview?.loading) previewContent = e("div", { className: "kv-preview-empty" }, "正在读取…");
      else if (preview?.error) previewContent = e("div", { className: "kv-preview-empty" }, preview.error);
      else if (preview && !preview.previewable) previewContent = e("div", { className: "kv-preview-empty" }, "这是附件或较大的文件，目录中已保留其位置和大小。");
      else if (preview?.previewable && isMarkdownDocument(preview)) {
        previewContent = e("div", { className: "kv-preview-scroll" },
          e(MarkdownDocument, { document: preview, compact: true }),
        );
      } else if (preview?.previewable) {
        previewContent = e("pre", { className: "kv-preview-body" }, preview.content || "");
      }

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
            e("div", { className: "kv-preview-heading" },
              e("div", { className: "kv-preview-name", title: preview.name }, preview.name),
              e("div", { className: "kv-preview-meta", title: preview.path },
                preview.bytes === undefined ? preview.path : `${preview.path} · ${formatBytes(preview.bytes)}`,
              ),
            ),
            preview.previewable && isMarkdownDocument(preview) ? e("button", {
              type: "button",
              className: "kv-preview-expand",
              title: "在主区域打开 Markdown 阅读器",
              onClick: () => expandMarkdownDocument(preview),
            }, "放大阅读") : null,
          ) : null,
          previewContent,
        ),
      );
    }

    const STATS_FOLDER_LABELS = {
      "/": "根目录",
      "01_Inbox": "01 Inbox",
      "02_Domains": "02 Domains",
      "03_Areas": "03 Areas",
      "04_Resources": "04 Resources",
      "05_Skills": "05 Skills",
      "06_Archive": "06 Archive",
      "07_Attachments": "07 Attachments",
    };

    function formatStatsDate(value, short = false) {
      if (!value) return "暂无记录";
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) return String(value);
      return new Intl.DateTimeFormat("zh-CN", short
        ? { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }
        : { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }
      ).format(date);
    }

    function openStatsFile(path) {
      if (!path) return;
      window.dispatchEvent(new CustomEvent("knowledge-vault:open-file", { detail: { path } }));
    }

    function StatsDistribution({ title, note, items, color = "#4d8df7", labels = {} }) {
      const visible = (items || []).slice(0, 10);
      const maximum = Math.max(1, ...visible.map((item) => item.count || 0));
      return e("section", { className: "kv-stats-panel" },
        e("div", { className: "kv-stats-panel-title" }, title),
        note ? e("div", { className: "kv-stats-panel-note" }, note) : null,
        visible.length === 0
          ? e("div", { className: "kv-stats-empty" }, "暂无可统计内容")
          : e("div", { className: "kv-stat-bars" }, visible.map((item) => e("div", {
            key: item.key,
            className: "kv-stat-bar-row",
            title: `${labels[item.key] || item.key}：${item.count}`,
          },
            e("div", { className: "kv-stat-bar-label" }, labels[item.key] || item.key),
            e("div", { className: "kv-stat-bar-track" },
              e("div", {
                className: "kv-stat-bar-fill",
                style: { width: `${Math.max(2, (item.count / maximum) * 100)}%`, background: color },
              }),
            ),
            e("div", { className: "kv-stat-bar-value" }, Number(item.count || 0).toLocaleString("zh-CN")),
          ))),
      );
    }

    function KnowledgeStatsView() {
      const [stats, setStats] = React.useState(null);
      const [loading, setLoading] = React.useState(true);
      const [error, setError] = React.useState("");
      const [expandedHealth, setExpandedHealth] = React.useState("");

      const load = React.useCallback(async (refresh = false) => {
        setLoading(true);
        setError("");
        try {
          const result = await getStats(refresh);
          setStats(result);
          setExpandedHealth("");
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
          setLoading(false);
        }
      }, []);

      React.useEffect(() => {
        void load(false);
      }, [load]);

      React.useEffect(() => {
        const refreshActiveVault = () => void load(true);
        window.addEventListener("knowledge-vault:changed", refreshActiveVault);
        return () => window.removeEventListener("knowledge-vault:changed", refreshActiveVault);
      }, [load]);

      const overview = stats?.overview || {};
      const distributions = stats?.distributions || {};
      const health = stats?.health || [];
      const activeHealth = health.find((item) => item.id === expandedHealth);
      const number = (value) => Number(value || 0).toLocaleString("zh-CN");
      const statCards = stats ? [
        { label: "Markdown 笔记", value: number(overview.markdownNotes), note: `全部文件 ${number(overview.totalFiles)}` },
        { label: "可检索知识", value: number(overview.knowledgeCards), note: "ready / processed / evergreen" },
        { label: "Inbox 待处理", value: number(overview.inboxPending), note: "等待提炼或复核" },
        { label: "附件", value: number(overview.attachmentCount), note: formatBytes(overview.attachmentBytes || 0) },
        { label: "显式关系", value: number(overview.explicitRelations), note: "可核验的知识连接" },
        { label: "知识库体积", value: formatBytes(overview.totalBytes || 0), note: `最近更新 ${formatStatsDate(overview.lastUpdatedAt, true)}` },
      ] : [];

      return e("section", { className: "kv-stats", "aria-label": "知识库统计" },
        e("header", { className: "kv-stats-header" },
          e("div", { className: "kv-stats-heading" },
            e("div", { className: "kv-stats-title", title: stats?.rootName || "知识库" }, `${stats?.rootName || "知识库"} · 知识统计`),
            e("div", { className: "kv-stats-subtitle" }, stats ? `本地只读统计 · 扫描于 ${formatStatsDate(stats.generatedAt)}` : "正在读取当前知识库"),
          ),
          e("button", {
            type: "button",
            className: "kv-graph-action",
            onClick: () => void load(true),
            disabled: loading,
          }, loading ? "刷新中…" : "刷新"),
        ),
        error && !stats ? e("div", { className: "kv-stats-empty" }, error) : null,
        loading && !stats ? e("div", { className: "kv-stats-empty" }, "正在扫描知识库并生成统计…") : null,
        stats ? e("div", { className: "kv-stats-body" },
          error ? e("div", { className: "kv-stats-panel-note", style: { marginBottom: "10px" } }, error) : null,
          e("div", { className: "kv-stat-cards" }, statCards.map((card) => e("section", {
            key: card.label,
            className: "kv-stat-card",
            title: card.note,
          },
            e("div", { className: "kv-stat-label" }, card.label),
            e("div", { className: "kv-stat-value" }, card.value),
            e("div", { className: "kv-stat-note" }, card.note),
          ))),
          e("div", { className: "kv-stats-grid" },
            e(StatsDistribution, {
              title: "目录分布",
              note: "Markdown 笔记在知识库主目录中的分布",
              items: distributions.folders,
              labels: STATS_FOLDER_LABELS,
              color: "#4d8df7",
            }),
            e(StatsDistribution, {
              title: "知识状态",
              note: "按 frontmatter status 统计",
              items: distributions.statuses,
              color: "#28a878",
            }),
            e(StatsDistribution, {
              title: "知识类型",
              note: "按 frontmatter type 统计",
              items: distributions.types,
              color: "#9b6de3",
            }),
            e(StatsDistribution, {
              title: "热门标签",
              note: "当前知识库使用最多的 10 个标签",
              items: distributions.tags,
              color: "#ed7b2f",
            }),
          ),
          e("div", { className: "kv-stats-lower" },
            e("section", { className: "kv-stats-panel" },
              e("div", { className: "kv-stats-panel-title" }, "知识健康提醒"),
              e("div", { className: "kv-stats-panel-note" }, "指标均来自可核验的文件、元数据和显式链接；点击有问题的指标查看文件。"),
              e("div", { className: "kv-health-grid" }, health.map((item) => e("button", {
                key: item.id,
                type: "button",
                className: "kv-health-card",
                "data-active": expandedHealth === item.id ? "true" : "false",
                disabled: item.count === 0 || !item.items?.length,
                onClick: () => setExpandedHealth((current) => current === item.id ? "" : item.id),
                title: item.description,
              },
                e("div", { className: "kv-health-count", "data-zero": item.count === 0 ? "true" : "false" }, number(item.count)),
                e("div", { className: "kv-health-copy" },
                  e("div", { className: "kv-health-label" }, item.label),
                  e("div", { className: "kv-health-description" }, item.count === 0 ? "当前检查正常" : item.description),
                ),
              ))),
              activeHealth ? e("div", { className: "kv-issue-list" },
                e("div", { className: "kv-issue-list-head" },
                  e("strong", null, activeHealth.label),
                  e("span", null, activeHealth.count > activeHealth.items.length ? `显示前 ${activeHealth.items.length} 项，共 ${activeHealth.count} 项` : `${activeHealth.count} 项`),
                ),
                activeHealth.items.map((item, index) => e("button", {
                  key: `${item.path}:${index}`,
                  type: "button",
                  className: "kv-file-row",
                  onClick: () => openStatsFile(item.path),
                  title: item.path,
                },
                  e("span", { className: "kv-file-copy" },
                    e("span", { className: "kv-file-title" }, item.title),
                    e("span", { className: "kv-file-meta" }, item.detail ? `${item.path} · ${item.detail}` : item.path),
                  ),
                  e("span", { className: "kv-file-time", "aria-hidden": true }, "打开 ›"),
                )),
              ) : null,
            ),
            e("section", { className: "kv-stats-panel" },
              e("div", { className: "kv-stats-panel-title" }, "最近更新"),
              e("div", { className: "kv-stats-panel-note" }, "优先使用 updated，缺失时使用文件修改时间"),
              (stats.recent || []).length === 0
                ? e("div", { className: "kv-stats-empty" }, "暂无 Markdown 笔记")
                : e("div", { style: { marginTop: "8px" } }, stats.recent.map((item) => e("button", {
                  key: item.path,
                  type: "button",
                  className: "kv-file-row",
                  onClick: () => openStatsFile(item.path),
                  title: item.path,
                },
                  e("span", { className: "kv-file-copy" },
                    e("span", { className: "kv-file-title" }, item.title),
                    e("span", { className: "kv-file-meta" }, `${STATS_FOLDER_LABELS[item.folder] || item.folder}${item.status ? ` · ${item.status}` : ""}`),
                  ),
                  e("span", { className: "kv-file-time" }, formatStatsDate(item.updatedAt, true)),
                ))),
            ),
          ),
          e("details", { className: "kv-stats-definitions" },
            e("summary", null, "查看统计口径"),
            e("p", null, `可检索知识：${stats.definitions?.knowledgeCards || ""}`),
            e("p", null, `附件：${stats.definitions?.attachments || ""}`),
            e("p", null, `显式关系：${stats.definitions?.relationships || ""}`),
          ),
        ) : null,
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

    function createInitialGraphLayout(nodes) {
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

    function graphLinkPhysics(kind) {
      if (kind === "parent_index") return { distance: 72, strength: .045 };
      if (kind === "related") return { distance: 88, strength: .036 };
      if (kind === "wikilink" || kind === "markdown") return { distance: 104, strength: .028 };
      return { distance: 120, strength: .022 };
    }

    function createGraphSimulation(nodes, edges, previousPositions, settings = DEFAULT_GRAPH_SETTINGS) {
      const initial = createInitialGraphLayout(nodes);
      const positions = new Map();
      const rows = nodes.map((node, index) => {
        const fallback = initial.get(node.id) || { x: 0, y: 0 };
        const previous = previousPositions?.get(node.id);
        const point = {
          id: node.id,
          group: node.topFolder || "/",
          radius: (node.isIndex ? 5 : 3.4) + Math.min(5.5, Math.sqrt(node.degree || 0) * .95),
          x: Number.isFinite(previous?.x) ? previous.x : fallback.x,
          y: Number.isFinite(previous?.y) ? previous.y : fallback.y,
          vx: 0,
          vy: 0,
          fx: null,
          fy: null,
          index,
        };
        positions.set(node.id, point);
        return point;
      });

      const groupTotals = new Map();
      for (const row of rows) {
        const fallback = initial.get(row.id) || row;
        const total = groupTotals.get(row.group) || { x: 0, y: 0, count: 0 };
        total.x += fallback.x;
        total.y += fallback.y;
        total.count += 1;
        groupTotals.set(row.group, total);
      }
      const groupCenters = new Map(Array.from(groupTotals, ([key, value]) => [key, {
        x: value.x / value.count,
        y: value.y / value.count,
      }]));

      const linkPairs = new Map();
      for (const edge of edges) {
        const source = positions.get(edge.source);
        const target = positions.get(edge.target);
        if (!source || !target) continue;
        const pairKey = source.id < target.id
          ? `${source.id}\0${target.id}`
          : `${target.id}\0${source.id}`;
        const physics = graphLinkPhysics(edge.kind);
        const existing = linkPairs.get(pairKey);
        if (existing) {
          existing.distance = Math.min(existing.distance, physics.distance);
          existing.strength = Math.min(.075, existing.strength + physics.strength * .45);
        } else {
          linkPairs.set(pairKey, { source, target, ...physics });
        }
      }

      return {
        positions,
        nodes: rows,
        links: Array.from(linkPairs.values()),
        groupCenters,
        settings,
        alpha: 1,
        ticks: 0,
      };
    }

    function reheatGraphSimulation(simulation, alpha = .55) {
      if (!simulation) return;
      simulation.alpha = Math.max(simulation.alpha, alpha);
      simulation.ticks = 0;
    }

    function tickGraphSimulation(simulation) {
      const alpha = simulation.alpha;
      const rows = simulation.nodes;
      const settings = simulation.settings || DEFAULT_GRAPH_SETTINGS;
      if (rows.length === 0) return false;

      for (const link of simulation.links) {
        let dx = link.target.x - link.source.x;
        let dy = link.target.y - link.source.y;
        let distance = Math.hypot(dx, dy);
        if (distance < .01) {
          dx = ((link.source.index * 17 + link.target.index * 29) % 7) - 3;
          dy = ((link.source.index * 31 + link.target.index * 13) % 7) - 3;
          distance = Math.max(.1, Math.hypot(dx, dy));
        }
        const desiredDistance = link.distance * settings.linkDistance;
        const force = ((distance - desiredDistance) / distance) * link.strength * alpha;
        const forceX = dx * force;
        const forceY = dy * force;
        if (link.source.fx === null) {
          link.source.vx += forceX;
          link.source.vy += forceY;
        }
        if (link.target.fx === null) {
          link.target.vx -= forceX;
          link.target.vy -= forceY;
        }
      }

      const cellSize = 82 * settings.nodeScale;
      const grid = new Map();
      for (const row of rows) {
        const cellX = Math.floor(row.x / cellSize);
        const cellY = Math.floor(row.y / cellSize);
        const key = `${cellX},${cellY}`;
        const cell = grid.get(key) || [];
        cell.push(row);
        grid.set(key, cell);
      }
      for (const row of rows) {
        const cellX = Math.floor(row.x / cellSize);
        const cellY = Math.floor(row.y / cellSize);
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
            const neighbors = grid.get(`${cellX + offsetX},${cellY + offsetY}`) || [];
            for (const other of neighbors) {
              if (other.index <= row.index) continue;
              let dx = other.x - row.x;
              let dy = other.y - row.y;
              let distanceSquared = dx * dx + dy * dy;
              if (distanceSquared < .01) {
                dx = ((row.index * 19 + other.index * 23) % 5) - 2;
                dy = ((row.index * 11 + other.index * 37) % 5) - 2;
                distanceSquared = Math.max(.1, dx * dx + dy * dy);
              }
              const distance = Math.sqrt(distanceSquared);
              const collisionDistance = (row.radius + other.radius) * settings.nodeScale + 9;
              const repulsion = Math.min(1.5, settings.repulsion / distanceSquared) * alpha;
              const collision = distance < collisionDistance
                ? (collisionDistance - distance) * .075
                : 0;
              const force = repulsion + collision;
              const forceX = (dx / distance) * force;
              const forceY = (dy / distance) * force;
              if (row.fx === null) {
                row.vx -= forceX;
                row.vy -= forceY;
              }
              if (other.fx === null) {
                other.vx += forceX;
                other.vy += forceY;
              }
            }
          }
        }
      }

      let kinetic = 0;
      for (const row of rows) {
        const groupCenter = simulation.groupCenters.get(row.group) || { x: 0, y: 0 };
        if (row.fx !== null && row.fy !== null) {
          row.x = row.fx;
          row.y = row.fy;
          row.vx = 0;
          row.vy = 0;
          continue;
        }
        row.vx += (groupCenter.x - row.x) * settings.clusterStrength * .00001 * alpha;
        row.vy += (groupCenter.y - row.y) * settings.clusterStrength * .00001 * alpha;
        row.vx += -row.x * settings.centerStrength * .00001 * alpha;
        row.vy += -row.y * settings.centerStrength * .00001 * alpha;
        row.vx *= .84;
        row.vy *= .84;
        const speed = Math.hypot(row.vx, row.vy);
        if (speed > 11) {
          row.vx = (row.vx / speed) * 11;
          row.vy = (row.vy / speed) * 11;
        }
        row.x += row.vx;
        row.y += row.vy;
        kinetic += row.vx * row.vx + row.vy * row.vy;
      }

      simulation.ticks += 1;
      simulation.alpha = Math.max(0, alpha * .985 - .00065);
      const averageKinetic = kinetic / Math.max(1, rows.length);
      return simulation.ticks < 720 && (simulation.alpha > .012 || averageKinetic > .012);
    }

    function KnowledgeGraphView() {
      const canvasRef = React.useRef(null);
      const stageRef = React.useRef(null);
      const dragRef = React.useRef(null);
      const refreshRef = React.useRef(false);
      const simulationRef = React.useRef(null);
      const animationFrameRef = React.useRef(0);
      const workerRef = React.useRef(null);
      const autoPausedLargeGraphRef = React.useRef(false);
      const settingsTouchedRef = React.useRef(false);
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
      const [simulationPaused, setSimulationPaused] = React.useState(false);
      const [simulationActive, setSimulationActive] = React.useState(false);
      const [simulationPulse, setSimulationPulse] = React.useState(0);
      const [frameRevision, setFrameRevision] = React.useState(0);
      const [themeRevision, setThemeRevision] = React.useState(0);
      const [layoutRevision, setLayoutRevision] = React.useState(0);
      const [settingsOpen, setSettingsOpen] = React.useState(false);
      const [settings, setSettings] = React.useState(() => {
        try {
          const saved = JSON.parse(window.localStorage.getItem(GRAPH_SETTINGS_STORAGE_KEY) || "null");
          return saved ? { ...DEFAULT_GRAPH_SETTINGS, ...saved } : { ...DEFAULT_GRAPH_SETTINGS };
        } catch {
          return { ...DEFAULT_GRAPH_SETTINGS };
        }
      });
      const [settingsHydrated, setSettingsHydrated] = React.useState(false);
      const [workerAvailable, setWorkerAvailable] = React.useState(
        () => typeof Worker === "function",
      );
      const [performanceNotice, setPerformanceNotice] = React.useState("");
      const [workerWarning, setWorkerWarning] = React.useState("");
      const [size, setSize] = React.useState({ width: 0, height: 0 });
      const [transform, setTransform] = React.useState({ x: 0, y: 0, scale: 1 });

      React.useEffect(() => {
        let alive = true;
        getGraphSettings().then((value) => {
          if (!alive || !value?.settings || settingsTouchedRef.current) return;
          setSettings({ ...DEFAULT_GRAPH_SETTINGS, ...value.settings });
        }).catch(() => {
          // The origin-scoped browser copy remains available if backend persistence is unavailable.
        }).finally(() => {
          if (alive) setSettingsHydrated(true);
        });
        return () => { alive = false; };
      }, []);

      React.useEffect(() => {
        try {
          window.localStorage.setItem(GRAPH_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        } catch {
          // Settings remain available for this session if browser storage is unavailable.
        }
        if (!settingsHydrated) return;
        queueGraphSettingsSave(settings);
      }, [settings, settingsHydrated]);

      React.useEffect(() => {
        if (typeof MutationObserver !== "function" || !document.body) return undefined;
        const observer = new MutationObserver(() => {
          setThemeRevision((value) => value + 1);
        });
        observer.observe(document.body, {
          attributes: true,
          attributeFilter: ["data-ds-dark-theme"],
        });
        return () => observer.disconnect();
      }, []);

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

      const simulation = React.useMemo(() => {
        const next = createGraphSimulation(
          visible.nodes,
          visible.edges,
          simulationRef.current?.positions,
          settings,
        );
        simulationRef.current = next;
        return next;
      }, [visible, settings, layoutRevision]);
      const layout = simulation.positions;
      const useWorker = workerAvailable && visible.nodes.length >= GRAPH_WORKER_THRESHOLD;
      const largeGraph = visible.nodes.length > GRAPH_DYNAMIC_NODE_LIMIT;
      const nodeById = React.useMemo(
        () => new Map(visible.nodes.map((node) => [node.id, node])),
        [visible.nodes],
      );
      const labeledNodeIds = React.useMemo(() => {
        const limit = largeGraph
          ? Math.min(30, settings.labelLimit)
          : settings.labelLimit;
        return new Set([...visible.nodes]
          .sort((left, right) => right.degree - left.degree || Number(right.isIndex) - Number(left.isIndex))
          .slice(0, limit)
          .map((node) => node.id));
      }, [visible.nodes, settings.labelLimit, largeGraph]);
      const hoveredNeighbors = React.useMemo(() => {
        const neighbors = new Set();
        if (!hovered?.id) return neighbors;
        for (const edge of visible.edges) {
          if (edge.source === hovered.id) neighbors.add(edge.target);
          if (edge.target === hovered.id) neighbors.add(edge.source);
        }
        return neighbors;
      }, [visible.edges, hovered?.id]);
      const selected = graph?.nodes?.find((node) => node.id === selectedId) || null;

      React.useEffect(() => {
        if (largeGraph) {
          if (!autoPausedLargeGraphRef.current) {
            autoPausedLargeGraphRef.current = true;
            setSimulationPaused(true);
          }
          setPerformanceNotice(
            `当前可见 ${visible.nodes.length} 个节点，已默认暂停动态布局。建议先按目录、类型或局部 2 跳筛选；也可手动继续。`,
          );
        } else if (useWorker) {
          if (autoPausedLargeGraphRef.current) {
            autoPausedLargeGraphRef.current = false;
            setSimulationPaused(false);
          }
          setPerformanceNotice(`已启用后台布局线程（${visible.nodes.length} 个节点），主界面保持可操作。`);
        } else {
          if (autoPausedLargeGraphRef.current) {
            autoPausedLargeGraphRef.current = false;
            setSimulationPaused(false);
          }
          setPerformanceNotice("");
        }
      }, [largeGraph, useWorker, visible.nodes.length]);

      React.useEffect(() => {
        workerRef.current?.terminate();
        workerRef.current = null;
        if (!useWorker || simulationPaused || simulation.nodes.length === 0) return undefined;

        let worker;
        try {
          worker = new Worker(GRAPH_WORKER_URL, { name: "knowledge-vault-graph-layout" });
        } catch (cause) {
          setWorkerWarning("后台布局线程不可用，已自动切换到主线程布局。");
          setWorkerAvailable(false);
          return undefined;
        }
        workerRef.current = worker;
        setSimulationActive(true);
        const nodeIndex = new Map(simulation.nodes.map((node, index) => [node.id, index]));
        worker.onmessage = (event) => {
          if (workerRef.current !== worker || event.data?.type !== "frame") return;
          const positions = new Float32Array(event.data.positions);
          for (let index = 0; index < simulation.nodes.length; index += 1) {
            const node = simulation.nodes[index];
            node.x = positions[index * 2];
            node.y = positions[index * 2 + 1];
          }
          simulation.alpha = event.data.alpha;
          setSimulationActive(event.data.active === true);
          setFrameRevision((value) => value + 1);
        };
        worker.onerror = () => {
          if (workerRef.current !== worker) return;
          worker.terminate();
          workerRef.current = null;
          setWorkerWarning("后台布局线程运行失败，已自动切换到主线程布局。");
          setWorkerAvailable(false);
        };
        worker.postMessage({
          type: "start",
          nodes: simulation.nodes.map((node) => {
            const anchor = simulation.groupCenters.get(node.group) || { x: 0, y: 0 };
            return {
              id: node.id,
              group: node.group,
              radius: node.radius,
              x: node.x,
              y: node.y,
              fx: node.fx,
              fy: node.fy,
              anchorX: anchor.x,
              anchorY: anchor.y,
            };
          }),
          links: simulation.links.map((link) => ({
            source: nodeIndex.get(link.source.id),
            target: nodeIndex.get(link.target.id),
            distance: link.distance,
            strength: link.strength,
          })),
          settings,
          alpha: simulation.alpha,
          paused: false,
          frameInterval: largeGraph ? 50 : 33,
        });
        return () => {
          worker.terminate();
          if (workerRef.current === worker) workerRef.current = null;
        };
      }, [simulation, useWorker, simulationPaused, simulationPulse, settings, largeGraph]);

      React.useEffect(() => {
        window.cancelAnimationFrame(animationFrameRef.current);
        if (useWorker || simulationPaused || simulation.nodes.length === 0) {
          setSimulationActive(false);
          return undefined;
        }
        let lastFrame = 0;
        setSimulationActive(true);
        const animate = (timestamp) => {
          if (timestamp - lastFrame >= 15) {
            lastFrame = timestamp;
            const active = tickGraphSimulation(simulation);
            setFrameRevision((value) => value + 1);
            if (!active) {
              setSimulationActive(false);
              animationFrameRef.current = 0;
              return;
            }
          }
          animationFrameRef.current = window.requestAnimationFrame(animate);
        };
        animationFrameRef.current = window.requestAnimationFrame(animate);
        return () => {
          window.cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = 0;
        };
      }, [simulation, useWorker, simulationPaused, simulationPulse]);

      React.useEffect(() => () => {
        workerRef.current?.terminate();
        window.cancelAnimationFrame(animationFrameRef.current);
      }, []);

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

        const dark = document.body.hasAttribute("data-ds-dark-theme") ||
          document.documentElement.classList.contains("dark") ||
          document.documentElement.dataset.theme === "dark" ||
          window.matchMedia?.("(prefers-color-scheme: dark)").matches;
        context.lineWidth = Math.max(.35, (.9 * settings.edgeWidth) / transform.scale);
        for (const edge of visible.edges) {
          const source = layout.get(edge.source);
          const target = layout.get(edge.target);
          if (!source || !target) continue;
          const connected = !hovered?.id || edge.source === hovered.id || edge.target === hovered.id;
          context.globalAlpha = connected ? 1 : .09;
          context.strokeStyle = hovered?.id && connected
            ? (dark ? "rgba(118,174,255,.72)" : "rgba(49,111,210,.62)")
            : (dark ? "rgba(210,220,235,.20)" : "rgba(55,68,85,.18)");
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
          const neighbor = hoveredNeighbors.has(node.id);
          const emphasized = !hovered?.id || hot || neighbor || active;
          context.globalAlpha = emphasized ? 1 : .16;
          const radius = ((node.isIndex ? 5 : 3.4) + Math.min(5.5, Math.sqrt(node.degree || 0) * .95)) * settings.nodeScale + (active ? 2 : 0);
          context.beginPath();
          context.arc(point.x, point.y, radius, 0, Math.PI * 2);
          context.fillStyle = active ? "#ff7a16" : graphColor(node.topFolder);
          context.fill();
          if (active || hot) {
            context.lineWidth = 2 / transform.scale;
            context.strokeStyle = active ? "rgba(255,122,22,.35)" : "rgba(77,141,247,.35)";
            context.stroke();
          }
          if ((labeledNodeIds.has(node.id) && emphasized) || active || hot) {
            const fontSize = Math.max(9, Math.min(13, 11 / Math.max(.75, transform.scale)));
            context.font = `${active ? 600 : 400} ${fontSize}px sans-serif`;
            context.fillStyle = dark ? "rgba(238,242,248,.88)" : "rgba(45,54,66,.80)";
            context.textBaseline = "middle";
            context.fillText(node.title, point.x + radius + 4, point.y, 220);
          }
        }
        context.globalAlpha = 1;
      }, [visible, layout, size, transform, selectedId, hovered, hoveredNeighbors, labeledNodeIds, settings, frameRevision, themeRevision]);

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

      const wakeSimulation = (alpha = .45) => {
        reheatGraphSimulation(simulation, alpha);
        setSimulationActive(true);
        if (!simulationPaused) setSimulationPulse((value) => value + 1);
      };

      const pointerDown = (event) => {
        canvasRef.current.setPointerCapture?.(event.pointerId);
        const hit = hitNode(event);
        if (hit.node) {
          const position = layout.get(hit.node.id);
          position.fx = position.x;
          position.fy = position.y;
          dragRef.current = {
            mode: "node",
            nodeId: hit.node.id,
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            offsetX: position.x - hit.point.x,
            offsetY: position.y - hit.point.y,
            moved: false,
          };
          setHovered({ id: hit.node.id, x: hit.point.screenX, y: hit.point.screenY });
          workerRef.current?.postMessage({
            type: "drag",
            index: position.index,
            fixed: true,
            x: position.x,
            y: position.y,
            alpha: .35,
          });
          wakeSimulation(.35);
          return;
        }
        dragRef.current = {
          mode: "pan",
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
          if (drag.mode === "node") {
            const point = graphPoint(event);
            const position = layout.get(drag.nodeId);
            if (position) {
              position.fx = point.x + drag.offsetX;
              position.fy = point.y + drag.offsetY;
              position.x = position.fx;
              position.y = position.fy;
              workerRef.current?.postMessage({
                type: "drag",
                index: position.index,
                fixed: true,
                x: position.fx,
                y: position.fy,
                alpha: .35,
              });
              setHovered({ id: drag.nodeId, x: point.screenX, y: point.screenY });
              setFrameRevision((value) => value + 1);
            }
          } else if (drag.moved) {
            setDragging(true);
            setTransform((value) => ({ ...value, x: drag.originX + dx, y: drag.originY + dy }));
          }
          if (drag.moved) setDragging(true);
          return;
        }
        const hit = hitNode(event);
        setHovered(hit.node ? { id: hit.node.id, x: hit.point.screenX, y: hit.point.screenY } : null);
      };

      const pointerUp = (event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        if (drag.mode === "node") {
          const node = nodeById.get(drag.nodeId);
          const position = layout.get(drag.nodeId);
          if (position) {
            position.fx = null;
            position.fy = null;
            workerRef.current?.postMessage({
              type: "drag",
              index: position.index,
              fixed: false,
              alpha: drag.moved ? .5 : .28,
            });
          }
          if (!drag.moved && event.type !== "pointercancel") selectNode(node);
          wakeSimulation(drag.moved ? .5 : .28);
        }
        canvasRef.current.releasePointerCapture?.(event.pointerId);
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
      const updateSetting = (name, value) => {
        settingsTouchedRef.current = true;
        setSettings((current) => ({ ...current, [name]: Number(value) }));
      };
      const resetGraphSettings = () => {
        settingsTouchedRef.current = true;
        setSettings({ ...DEFAULT_GRAPH_SETTINGS });
      };
      const resetGraphLayout = () => {
        simulationRef.current = null;
        setSelectedId("");
        setHovered(null);
        setLayoutRevision((value) => value + 1);
      };
      const toggleSimulation = () => {
        autoPausedLargeGraphRef.current = false;
        if (simulationPaused) {
          reheatGraphSimulation(simulation, .42);
          setSimulationPaused(false);
          setSimulationPulse((value) => value + 1);
          if (largeGraph) {
            setPerformanceNotice(`当前可见 ${visible.nodes.length} 个节点，已手动继续后台布局；建议优先使用筛选或局部图。`);
          }
        } else {
          setSimulationPaused(true);
          if (largeGraph) {
            setPerformanceNotice(`当前可见 ${visible.nodes.length} 个节点，动态布局已暂停。`);
          }
        }
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
      const settingRow = (label, name, min, max, step, format = (value) => value) => e("label", {
        className: "kv-graph-setting",
      },
        e("span", null, label),
        e("input", {
          type: "range",
          min,
          max,
          step,
          value: settings[name],
          onChange: (event) => updateSetting(name, event.target.value),
        }),
        e("output", null, format(settings[name])),
      );

      const hoveredNode = hovered ? nodeById.get(hovered.id) : null;
      const motionState = simulationPaused
        ? "已暂停"
        : simulationActive
          ? (useWorker ? "后台布局中" : "布局中")
          : "已稳定";
      const summary = graph
        ? `${visible.nodes.length}/${graph.nodeCount} 个节点 · ${visible.edges.length}/${graph.edgeCount} 条关系 · ${graph.unresolvedCount} 个未解析 · ${motionState}`
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
            e("button", {
              type: "button",
              className: "kv-graph-action",
              "data-active": settingsOpen ? "true" : "false",
              onClick: () => setSettingsOpen((value) => !value),
              title: "调整动态布局和显示参数",
            }, "图谱设置"),
            e("button", {
              type: "button",
              className: "kv-graph-action",
              "data-active": simulationPaused ? "true" : "false",
              onClick: toggleSimulation,
              title: simulationPaused ? "继续动态布局" : "暂停动态布局",
            }, simulationPaused ? "继续运动" : "暂停运动"),
            e("button", { type: "button", className: "kv-graph-action", onClick: fitGraph }, "适应画布"),
            e("button", { type: "button", className: "kv-graph-action", onClick: refresh, disabled: loading }, loading ? "刷新中…" : "刷新"),
          ),
        ),
        e("div", { ref: stageRef, className: "kv-graph-stage" },
          (workerWarning || performanceNotice) ? e("div", {
            className: "kv-graph-performance",
            role: "status",
          }, workerWarning || performanceNotice) : null,
          settingsOpen ? e("section", {
            className: "kv-graph-settings",
            "aria-label": "图谱设置",
          },
            e("div", { className: "kv-graph-settings-head" },
              e("div", { className: "kv-graph-settings-title" }, "动态布局与显示"),
              e("button", {
                type: "button",
                className: "kv-icon-button",
                onClick: () => setSettingsOpen(false),
                "aria-label": "关闭图谱设置",
              }, "×"),
            ),
            settingRow("节点斥力", "repulsion", 40, 400, 10),
            settingRow("链接距离", "linkDistance", .6, 1.8, .05, (value) => `${Number(value).toFixed(2)}×`),
            settingRow("目录聚类", "clusterStrength", 0, 120, 5),
            settingRow("中心引力", "centerStrength", 0, 50, 2),
            settingRow("节点大小", "nodeScale", .6, 2, .05, (value) => `${Number(value).toFixed(2)}×`),
            settingRow("连线粗细", "edgeWidth", .5, 3, .1, (value) => `${Number(value).toFixed(1)}×`),
            settingRow("标签数量", "labelLimit", 0, 300, 10),
            e("div", { className: "kv-graph-settings-note" },
              useWorker
                ? `当前由 Web Worker 后台计算；${largeGraph ? "大图谱标签自动限制为最多 30 个。" : "界面交互不会被布局计算阻塞。"} 设置自动保存到本机。`
                : `少于 ${GRAPH_WORKER_THRESHOLD} 个可见节点时使用主线程动画。设置自动保存到本机，重启后继续使用。`,
            ),
            e("div", { className: "kv-graph-settings-actions" },
              e("button", { type: "button", className: "kv-graph-action", onClick: resetGraphSettings }, "恢复默认"),
              e("button", { type: "button", className: "kv-graph-action", onClick: resetGraphLayout }, "重置位置"),
            ),
          ) : null,
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
              : e("span", null, "拖动节点可调整关系布局；拖动空白处平移，滚轮缩放。"),
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

          const createBookPlusIcon = () => {
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.classList.add("kv-init-icon-svg");
            svg.setAttribute("viewBox", "0 0 24 24");
            svg.setAttribute("fill", "none");
            svg.setAttribute("stroke", "currentColor");
            svg.setAttribute("stroke-width", "2");
            svg.setAttribute("stroke-linecap", "round");
            svg.setAttribute("stroke-linejoin", "round");
            svg.setAttribute("focusable", "false");
            const paths = [
              "M12 7v14",
              "M16 12h2",
              "M17 11v2",
              "M3 18a1 1 0 0 1-1-1V5a2 2 0 0 1 2-2h5a3 3 0 0 1 3 3v15a3 3 0 0 0-3-3Z",
              "M21 18a1 1 0 0 0 1-1V5a2 2 0 0 0-2-2h-5a3 3 0 0 0-3 3v15a3 3 0 0 1 3-3Z",
            ];
            for (const value of paths) {
              const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
              path.setAttribute("d", value);
              svg.append(path);
            }
            return svg;
          };

          const createButton = (text, title, iconContent) => {
            const action = document.createElement("button");
            action.type = "button";
            action.className = "kv-init-button";
            action.title = title;
            action.setAttribute("aria-label", text);
            const icon = document.createElement("span");
            icon.className = "kv-init-icon";
            icon.setAttribute("aria-hidden", "true");
            if (typeof iconContent === "function") icon.append(iconContent());
            else icon.textContent = iconContent;
            const label = document.createElement("span");
            label.className = "kv-init-label";
            label.textContent = text;
            action.append(icon, label);
            return { action, label, title };
          };
          const initializeButton = createButton(
            "初始化知识库",
            "在指定位置初始化并切换到自己的知识库",
            createBookPlusIcon,
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
        const openVaultMarkdownLink = (event) => {
          const anchor = event.target?.closest?.("a");
          if (!anchor || anchor.hasAttribute("download")) return;
          const documentPath = anchor.closest("[data-vault-document-path]")?.getAttribute("data-vault-document-path") || "";
          const declaredPath = anchor.getAttribute("data-knowledge-vault-path");
          const path = declaredPath
            ? resolveVaultDocumentPath("", declaredPath)
            : resolveVaultDocumentPath(documentPath, anchor.getAttribute("href"));
          if (!path) return;
          event.preventDefault();
          event.stopPropagation();
          window.dispatchEvent(new CustomEvent("knowledge-vault:open-file", {
            detail: { path, openReader: true, source: "markdown-link" },
          }));
        };
        const observedRoot = document.body || document.documentElement;
        if (observedRoot) upgradeMalformedVaultMarkdownLinks(observedRoot);
        const observer = observedRoot && typeof MutationObserver !== "undefined"
          ? new MutationObserver((mutations) => {
            for (const mutation of mutations) {
              if (mutation.type === "characterData" || mutation.type === "attributes") {
                upgradeMalformedVaultMarkdownLinks(mutation.target);
              }
              for (const node of mutation.addedNodes || []) upgradeMalformedVaultMarkdownLinks(node);
            }
          })
          : null;
        observer?.observe(observedRoot, {
          attributes: true,
          attributeFilter: ["data-streaming"],
          characterData: true,
          childList: true,
          subtree: true,
        });
        document.addEventListener("click", openVaultMarkdownLink, true);
        return () => {
          observer?.disconnect();
          document.removeEventListener("click", openVaultMarkdownLink, true);
        };
      }, "knowledge-vault-bootstrap: open Vault Markdown links in reader");
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
      ctx.slots.inject("conversation.view", () => ctx.slots.register({
        name: "conversation.view",
        id: "knowledge-stats",
        order: 30,
        label: () => "统计",
      }, KnowledgeStatsView));
      ctx.slots.inject("conversation.view", () => ctx.slots.register({
        name: "conversation.view",
        id: "knowledge-reader",
        order: 40,
        label: () => "阅读",
      }, MarkdownReaderView));
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
