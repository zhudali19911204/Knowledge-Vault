import {
  cp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

const name = "knowledge-vault-bootstrap";
const inject = ["workspaceRegistry", "webServer"];
const API_PREFIX = "/knowledge-vault/api";
const BRAND_LOGO_ROUTE = "/knowledge-vault/assets/bkcs-logo.png";
const BRAND_LOGO_SOURCE = new URL("./assets/bkcs-logo.png", import.meta.url);
const FAVICON_ROUTE = "/knowledge-vault/assets/knowledge-vault-favicon.png";
const FAVICON_SOURCE = new URL("./assets/knowledge-vault-favicon.png", import.meta.url);
const MAX_PREVIEW_BYTES = 1024 * 1024;
const MAX_INITIALIZE_BODY_BYTES = 16 * 1024;
const MAX_GRAPH_FILE_BYTES = 2 * 1024 * 1024;
const MAX_GRAPH_FILES = 5000;
const GRAPH_CACHE_TTL_MS = 5000;
const GRAPH_IGNORED_DIRECTORIES = new Set([
  ".git",
  ".dsh",
  ".agents",
  ".obsidian",
  ".pnpm-store",
  "node_modules",
]);
const GRAPH_METADATA_FIELDS = new Set([
  "title",
  "type",
  "status",
  "tags",
  "related",
  "source_notes",
  "parent_index",
]);
const TEXT_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".csv",
  ".tsv",
  ".html",
  ".css",
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".py",
  ".ps1",
  ".cmd",
  ".xml",
  ".toml",
]);

async function resolveVaultRoot() {
  const requested = process.env.KNOWLEDGE_VAULT_ROOT || process.cwd();
  const canonical = await realpath(requested);
  const details = await stat(canonical);
  if (!details.isDirectory()) {
    throw new Error(`Knowledge Vault root is not a directory: ${canonical}`);
  }
  return canonical;
}

async function resolveInitializationPaths() {
  const templateRequested = process.env.KNOWLEDGE_VAULT_TEMPLATE_ROOT;
  const productRequested = process.env.KNOWLEDGE_VAULT_PRODUCT_ROOT;
  const configRequested = process.env.KNOWLEDGE_VAULT_PRODUCT_CONFIG;
  if (!templateRequested || !productRequested || !configRequested) {
    throw Object.assign(new Error("当前启动方式未启用知识库初始化功能。"), { statusCode: 503 });
  }

  const templateRoot = await realpath(templateRequested);
  const productRoot = await realpath(productRequested);
  const productConfig = resolve(configRequested);
  if (!(await stat(templateRoot)).isDirectory()) {
    throw new Error(`Knowledge Vault template root is not a directory: ${templateRoot}`);
  }
  return { templateRoot, productRoot, productConfig };
}

function sendJson(res, statusCode, value) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-content-type-options", "nosniff");
  res.end(JSON.stringify(value));
}

function normalizedRelative(root, target) {
  return relative(root, target).split(sep).join("/");
}

function containsPath(parent, target) {
  const child = relative(parent, target);
  return child === "" || (child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child));
}

function pathsOverlap(left, right) {
  return containsPath(left, right) || containsPath(right, left);
}

async function isInitializedVault(vaultRoot) {
  const agents = await stat(join(vaultRoot, "AGENTS.md")).catch(() => undefined);
  const inbox = await stat(join(vaultRoot, "01_Inbox")).catch(() => undefined);
  return agents?.isFile() === true && inbox?.isDirectory() === true;
}

async function assertTemplateTreeSafe(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const source = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Knowledge Vault template contains a symbolic link: ${source}`);
    }
    if (entry.isDirectory()) {
      await assertTemplateTreeSafe(source);
    } else if (!entry.isFile()) {
      throw new Error(`Knowledge Vault template contains an unsupported entry: ${source}`);
    }
  }
  return entries;
}

async function copyTemplateIntoEmptyVault(templateRoot, vaultRoot) {
  const templateEntries = await assertTemplateTreeSafe(templateRoot);
  const stageRoot = join(dirname(vaultRoot), `.knowledge-vault-initialize-${randomUUID()}`);
  const movedNames = [];
  await mkdir(stageRoot);
  try {
    for (const entry of templateEntries) {
      await cp(join(templateRoot, entry.name), join(stageRoot, entry.name), {
        recursive: entry.isDirectory(),
        errorOnExist: true,
        force: false,
        preserveTimestamps: true,
      });
    }
    for (const entry of templateEntries) {
      await rename(join(stageRoot, entry.name), join(vaultRoot, entry.name));
      movedNames.push(entry.name);
    }
  } catch (error) {
    for (const movedName of movedNames.reverse()) {
      await rm(join(vaultRoot, movedName), { recursive: true, force: true }).catch(() => {});
    }
    throw error;
  } finally {
    await rm(stageRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function persistSelectedVault(productConfig, vaultRoot) {
  await mkdir(dirname(productConfig), { recursive: true });
  const value = {
    vaultRoot,
    initializedAt: new Date().toISOString(),
  };
  await writeFile(productConfig, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function initializeVault(destination) {
  if (typeof destination !== "string" || destination.trim() === "" || destination.includes("\0")) {
    throw Object.assign(new Error("请选择一个有效的知识库目录。"), { statusCode: 400 });
  }
  if (!isAbsolute(destination)) {
    throw Object.assign(new Error("知识库目录必须使用绝对路径。"), { statusCode: 400 });
  }

  const { templateRoot, productRoot, productConfig } = await resolveInitializationPaths();
  await mkdir(destination, { recursive: true });
  const vaultRoot = await realpath(destination);
  const dataRoot = dirname(productConfig);
  if (pathsOverlap(vaultRoot, productRoot)) {
    throw Object.assign(new Error("请选择应用程序目录以外的位置。"), { statusCode: 400 });
  }
  if (pathsOverlap(vaultRoot, dataRoot)) {
    throw Object.assign(new Error("知识库目录不能与 Harness 用户数据目录重叠。"), { statusCode: 400 });
  }

  const alreadyInitialized = await isInitializedVault(vaultRoot);
  const existingEntries = await readdir(vaultRoot);
  if (!alreadyInitialized && existingEntries.length > 0) {
    throw Object.assign(
      new Error("所选文件夹不是空文件夹。请选择空文件夹或已有的 Knowledge Vault。"),
      { statusCode: 409 },
    );
  }

  if (!alreadyInitialized) {
    await copyTemplateIntoEmptyVault(templateRoot, vaultRoot);
  }
  await persistSelectedVault(productConfig, vaultRoot);
  return { vaultRoot, alreadyInitialized };
}

async function selectVault(destination) {
  if (typeof destination !== "string" || destination.trim() === "" || destination.includes("\0")) {
    throw Object.assign(new Error("请选择一个有效的知识库目录。"), { statusCode: 400 });
  }
  if (!isAbsolute(destination)) {
    throw Object.assign(new Error("知识库目录必须使用绝对路径。"), { statusCode: 400 });
  }

  const { productRoot, productConfig } = await resolveInitializationPaths();
  const vaultRoot = await realpath(destination).catch((error) => {
    if (error?.code === "ENOENT") {
      throw Object.assign(new Error("所选知识库目录不存在。"), { statusCode: 404 });
    }
    throw error;
  });
  if (!(await stat(vaultRoot)).isDirectory()) {
    throw Object.assign(new Error("请选择 Knowledge Vault 根目录。"), { statusCode: 400 });
  }

  const dataRoot = dirname(productConfig);
  if (pathsOverlap(vaultRoot, productRoot)) {
    throw Object.assign(new Error("请选择应用程序目录以外的知识库。"), { statusCode: 400 });
  }
  if (pathsOverlap(vaultRoot, dataRoot)) {
    throw Object.assign(new Error("知识库目录不能与 Harness 用户数据目录重叠。"), { statusCode: 400 });
  }
  if (!(await isInitializedVault(vaultRoot))) {
    throw Object.assign(
      new Error("所选目录不是已初始化的 Knowledge Vault。请先使用“初始化知识库”。"),
      { statusCode: 409 },
    );
  }

  await persistSelectedVault(productConfig, vaultRoot);
  return { vaultRoot };
}

async function readJsonBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk.toString("utf8");
    if (Buffer.byteLength(body, "utf8") > MAX_INITIALIZE_BODY_BYTES) {
      throw Object.assign(new Error("请求内容过大。"), { statusCode: 413 });
    }
  }
  try {
    return JSON.parse(body || "{}");
  } catch {
    throw Object.assign(new Error("请求内容不是有效的 JSON。"), { statusCode: 400 });
  }
}

function assertSameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host) return;
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw Object.assign(new Error("无效的请求来源。"), { statusCode: 403 });
  }
  if (originHost.toLowerCase() !== host.toLowerCase()) {
    throw Object.assign(new Error("不允许从其他页面更改本机知识库。"), { statusCode: 403 });
  }
}

async function resolveVaultPath(vaultRoot, requestedPath) {
  if (typeof requestedPath !== "string" || requestedPath.includes("\0")) {
    throw Object.assign(new Error("Invalid Vault path."), { statusCode: 400 });
  }

  const target = resolve(vaultRoot, requestedPath || ".");
  const canonical = await realpath(target).catch((error) => {
    if (error?.code === "ENOENT") {
      throw Object.assign(new Error("Vault entry not found."), { statusCode: 404 });
    }
    throw error;
  });
  const prefix = vaultRoot.endsWith(sep) ? vaultRoot : vaultRoot + sep;
  if (canonical !== vaultRoot && !canonical.startsWith(prefix)) {
    throw Object.assign(new Error("Vault path escapes the configured root."), { statusCode: 403 });
  }
  return canonical;
}

async function listDirectory(vaultRoot, requestedPath) {
  const target = await resolveVaultPath(vaultRoot, requestedPath);
  const details = await stat(target);
  if (!details.isDirectory()) {
    throw Object.assign(new Error("Requested Vault entry is not a directory."), { statusCode: 400 });
  }

  const rows = await readdir(target, { withFileTypes: true });
  const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
  const entries = rows.map((row) => {
    const fullPath = resolve(target, row.name);
    const type = row.isDirectory() ? "directory" : row.isFile() ? "file" : "other";
    return {
      name: row.name,
      path: normalizedRelative(vaultRoot, fullPath),
      type,
    };
  });
  entries.sort((left, right) => {
    if (left.type === "directory" && right.type !== "directory") return -1;
    if (left.type !== "directory" && right.type === "directory") return 1;
    return collator.compare(left.name, right.name);
  });

  return {
    rootName: basename(vaultRoot),
    path: normalizedRelative(vaultRoot, target),
    entries,
  };
}

async function previewFile(vaultRoot, requestedPath) {
  const target = await resolveVaultPath(vaultRoot, requestedPath);
  const details = await stat(target);
  if (!details.isFile()) {
    throw Object.assign(new Error("Requested Vault entry is not a file."), { statusCode: 400 });
  }

  const extension = extname(target).toLowerCase();
  const previewable = TEXT_EXTENSIONS.has(extension) && details.size <= MAX_PREVIEW_BYTES;
  return {
    name: basename(target),
    path: normalizedRelative(vaultRoot, target),
    bytes: details.size,
    modifiedAt: details.mtime.toISOString(),
    previewable,
    content: previewable ? await readFile(target, "utf8") : undefined,
  };
}

function createApiHandler(resolveActiveVault, operation) {
  return async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      const requestedPath = url.searchParams.get("path") || "";
      const value = await operation(resolveActiveVault(), requestedPath);
      if (req.method === "HEAD") {
        res.statusCode = 200;
        res.end();
        return;
      }
      sendJson(res, 200, value);
    } catch (error) {
      const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
      sendJson(res, statusCode, {
        error: statusCode === 500 ? "Unable to read the configured Vault." : error.message,
      });
    }
  };
}

function graphPath(value) {
  const parts = String(value || "").replaceAll("\\", "/").split("/");
  const normalized = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (normalized.length === 0) return "";
      normalized.pop();
    } else {
      normalized.push(part);
    }
  }
  return normalized.join("/");
}

function unquoteYaml(value) {
  const trimmed = String(value || "").trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function yamlValues(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map(unquoteYaml)
      .filter(Boolean);
  }
  return [unquoteYaml(trimmed)].filter(Boolean);
}

function parseMarkdownDocument(source) {
  const text = String(source || "").replace(/^\uFEFF/, "");
  const metadata = {};
  let body = text;
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (match) {
    body = text.slice(match[0].length);
    const lines = match[1].split(/\r?\n/);
    let activeField = "";
    for (const line of lines) {
      const fieldMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (fieldMatch) {
        activeField = fieldMatch[1].toLowerCase();
        if (!GRAPH_METADATA_FIELDS.has(activeField)) {
          activeField = "";
          continue;
        }
        const values = yamlValues(fieldMatch[2]);
        metadata[activeField] = activeField === "title" || activeField === "type" || activeField === "status"
          ? values[0] || ""
          : values;
        continue;
      }
      const listMatch = activeField && line.match(/^\s+-\s+(.+)$/);
      if (listMatch && Array.isArray(metadata[activeField])) {
        metadata[activeField].push(...yamlValues(listMatch[1]));
      }
    }
  }

  if (!metadata.title) {
    const heading = body.match(/^#\s+(.+)$/m);
    if (heading) metadata.title = heading[1].trim();
  }
  return { metadata, body };
}

function cleanGraphReference(value) {
  let reference = unquoteYaml(value).replace(/^!/, "").trim();
  const wiki = reference.match(/^\[\[([\s\S]*?)\]\]$/);
  if (wiki) reference = wiki[1];
  reference = reference.split("|")[0].split("#")[0].trim();
  try {
    reference = decodeURIComponent(reference);
  } catch {
    // Keep malformed URI text so it is reported as unresolved instead of failing the graph.
  }
  return reference;
}

function extractGraphReferences(document) {
  const references = [];
  const searchable = document.body
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\r\n]*`/g, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const wikiPattern = /(!)?\[\[([^\]\r\n]+)\]\]/g;
  let match;
  while ((match = wikiPattern.exec(searchable)) !== null) {
    references.push({ value: match[2], kind: match[1] ? "embed" : "wikilink" });
  }
  const markdownPattern = /\[[^\]\r\n]*\]\(([^)\r\n]+)\)/g;
  while ((match = markdownPattern.exec(searchable)) !== null) {
    const value = match[1].trim().replace(/\s+["'][^"']*["']$/, "");
    if (/\.md(?:#.*)?$/i.test(value)) references.push({ value, kind: "markdown" });
  }
  for (const field of ["related", "source_notes", "parent_index"]) {
    const values = document.metadata[field];
    for (const value of Array.isArray(values) ? values : values ? [values] : []) {
      references.push({ value, kind: field });
    }
  }
  return references;
}

async function collectMarkdownFiles(vaultRoot) {
  const files = [];
  async function visit(directory, relativeDirectory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const fullPath = join(directory, entry.name);
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!GRAPH_IGNORED_DIRECTORIES.has(entry.name)) await visit(fullPath, relativePath);
        continue;
      }
      if (!entry.isFile() || extname(entry.name).toLowerCase() !== ".md") continue;
      files.push({ fullPath, path: relativePath });
      if (files.length > MAX_GRAPH_FILES) {
        throw Object.assign(new Error(`Vault 中的 Markdown 文件超过 ${MAX_GRAPH_FILES} 个，第一阶段图谱暂不加载。`), {
          statusCode: 413,
        });
      }
    }
  }
  await visit(vaultRoot, "");
  return files;
}

function graphReferenceResolver(nodes) {
  const exact = new Map();
  const stems = new Map();
  for (const node of nodes) {
    const lowerPath = node.path.toLowerCase();
    exact.set(lowerPath, node.id);
    exact.set(lowerPath.replace(/\.md$/i, ""), node.id);
    const stem = basename(node.path, extname(node.path)).toLowerCase();
    const matches = stems.get(stem) || [];
    matches.push(node.id);
    stems.set(stem, matches);
  }
  return (sourcePath, rawReference) => {
    let reference = cleanGraphReference(rawReference);
    if (!reference) return undefined;
    const rootRelative = reference.startsWith("/");
    reference = reference.replace(/^\/+/, "");
    const sourceDirectory = sourcePath.includes("/")
      ? sourcePath.slice(0, sourcePath.lastIndexOf("/"))
      : "";
    const candidates = rootRelative
      ? [graphPath(reference)]
      : [graphPath(`${sourceDirectory}/${reference}`), graphPath(reference)];
    for (const candidate of candidates) {
      const lower = candidate.toLowerCase();
      const found = exact.get(lower) || exact.get(`${lower}.md`);
      if (found) return found;
    }
    const stem = basename(reference, extname(reference)).toLowerCase();
    const matches = stems.get(stem);
    return matches?.length === 1 ? matches[0] : undefined;
  };
}

async function buildKnowledgeGraph(vaultRoot) {
  const files = await collectMarkdownFiles(vaultRoot);
  const documents = [];
  for (const file of files) {
    const details = await stat(file.fullPath);
    if (details.size > MAX_GRAPH_FILE_BYTES) continue;
    const document = parseMarkdownDocument(await readFile(file.fullPath, "utf8"));
    const segments = file.path.split("/");
    const fallbackTitle = basename(file.path, extname(file.path));
    documents.push({
      ...file,
      document,
      node: {
        id: file.path,
        path: file.path,
        title: document.metadata.title || fallbackTitle,
        folder: segments.length > 1 ? segments.slice(0, -1).join("/") : "/",
        topFolder: segments.length > 1 ? segments[0] : "/",
        type: document.metadata.type || "",
        status: document.metadata.status || "",
        tags: Array.isArray(document.metadata.tags) ? document.metadata.tags : [],
        degree: 0,
        inDegree: 0,
        outDegree: 0,
        isIndex: /^_?index$/i.test(fallbackTitle) || file.path === "AGENTS.md",
      },
    });
  }

  const nodes = documents.map((item) => item.node);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const resolveReference = graphReferenceResolver(nodes);
  const edges = [];
  const edgeKeys = new Set();
  const unresolved = [];
  const unresolvedKeys = new Set();
  for (const item of documents) {
    for (const reference of extractGraphReferences(item.document)) {
      const rawTarget = cleanGraphReference(reference.value);
      const target = resolveReference(item.path, rawTarget);
      if (!target) {
        if (rawTarget) {
          const key = `${item.path}\0${reference.kind}\0${rawTarget}`;
          if (!unresolvedKeys.has(key)) {
            unresolvedKeys.add(key);
            unresolved.push({ source: item.path, target: rawTarget, kind: reference.kind });
          }
        }
        continue;
      }
      if (target === item.path) continue;
      const key = `${item.path}\0${target}\0${reference.kind}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push({ id: `e${edges.length + 1}`, source: item.path, target, kind: reference.kind });
      const sourceNode = nodeById.get(item.path);
      const targetNode = nodeById.get(target);
      sourceNode.outDegree += 1;
      sourceNode.degree += 1;
      targetNode.inDegree += 1;
      targetNode.degree += 1;
    }
  }

  return {
    rootName: basename(vaultRoot),
    generatedAt: new Date().toISOString(),
    nodeCount: nodes.length,
    edgeCount: edges.length,
    unresolvedCount: unresolved.length,
    nodes,
    edges,
    unresolved,
  };
}

function createGraphHandler(resolveActiveVault, cache) {
  return async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      const vaultRoot = resolveActiveVault();
      const cached = cache.get(vaultRoot);
      const refresh = url.searchParams.get("refresh") === "1";
      let value = cached?.value;
      if (refresh || !cached || Date.now() - cached.createdAt > GRAPH_CACHE_TTL_MS) {
        value = await buildKnowledgeGraph(vaultRoot);
        cache.set(vaultRoot, { createdAt: Date.now(), value });
      }
      if (req.method === "HEAD") {
        res.statusCode = 200;
        res.end();
        return;
      }
      sendJson(res, 200, value);
    } catch (error) {
      const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
      sendJson(res, statusCode, {
        error: statusCode === 500 ? "无法读取当前知识库图谱。" : error.message,
      });
    }
  };
}

function createInitializationHandler(ctx, state) {
  return async (req, res) => {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    try {
      assertSameOrigin(req);
      const body = await readJsonBody(req);
      const result = await initializeVault(body.destination);
      let workspace = await ctx.workspaceRegistry.resolveByPath(result.vaultRoot);
      if (workspace === undefined) {
        workspace = await ctx.workspaceRegistry.create(result.vaultRoot);
      }
      const title = basename(result.vaultRoot);
      if (title && workspace.title !== title) {
        await workspace.setTitle(title);
      }
      state.vaultRoot = result.vaultRoot;
      state.graphCache.clear();
      ctx.logger.info(`initialized and selected knowledge workspace: ${result.vaultRoot}`);
      sendJson(res, 200, {
        ...result,
        workspaceId: workspace.id,
      });
    } catch (error) {
      const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
      ctx.logger.warn(`knowledge Vault initialization failed: ${error?.stack || error}`);
      sendJson(res, statusCode, {
        error: statusCode === 500 ? "初始化知识库失败，请查看启动窗口中的错误信息。" : error.message,
      });
    }
  };
}

function createSelectionHandler(ctx, state) {
  return async (req, res) => {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    try {
      assertSameOrigin(req);
      const body = await readJsonBody(req);
      const result = await selectVault(body.destination);
      let workspace = await ctx.workspaceRegistry.resolveByPath(result.vaultRoot);
      if (workspace === undefined) {
        workspace = await ctx.workspaceRegistry.create(result.vaultRoot);
      }
      const title = basename(result.vaultRoot);
      if (title && workspace.title !== title) {
        await workspace.setTitle(title);
      }
      state.vaultRoot = result.vaultRoot;
      state.graphCache.clear();
      ctx.logger.info(`selected knowledge workspace: ${result.vaultRoot}`);
      sendJson(res, 200, {
        ...result,
        workspaceId: workspace.id,
      });
    } catch (error) {
      const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
      ctx.logger.warn(`knowledge Vault selection failed: ${error?.stack || error}`);
      sendJson(res, statusCode, {
        error: statusCode === 500 ? "选择知识库失败，请查看启动窗口中的错误信息。" : error.message,
      });
    }
  };
}

function createBrandLogoHandler(logoBytes) {
  return (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }
    res.statusCode = 200;
    res.setHeader("content-type", "image/png");
    res.setHeader("content-length", String(logoBytes.length));
    res.setHeader("cache-control", "no-store");
    res.setHeader("x-content-type-options", "nosniff");
    res.end(req.method === "HEAD" ? undefined : logoBytes);
  };
}

async function apply(ctx) {
  const state = { vaultRoot: await resolveVaultRoot(), graphCache: new Map() };
  const brandLogo = await readFile(BRAND_LOGO_SOURCE);
  const favicon = await readFile(FAVICON_SOURCE);

  await ctx.effect(async () => {
    let workspace = await ctx.workspaceRegistry.resolveByPath(state.vaultRoot);
    const created = workspace === undefined;

    if (created) {
      workspace = await ctx.workspaceRegistry.create(state.vaultRoot);
    }

    const requestedTitle = process.env.KNOWLEDGE_VAULT_TITLE?.trim();
    const title = requestedTitle || basename(state.vaultRoot);
    if (title && workspace.title !== title) {
      await workspace.setTitle(title);
    }

    ctx.logger.info(
      `${created ? "registered" : "reused"} bundled knowledge workspace: ${state.vaultRoot}`,
    );

    return () => {};
  }, "knowledge-vault-bootstrap: register bundled workspace");

  ctx.effect(() => {
    const disposeList = ctx.webServer.register({
      kind: "exact",
      path: `${API_PREFIX}/list`,
      handler: createApiHandler(() => state.vaultRoot, listDirectory),
    });
    const disposeFile = ctx.webServer.register({
      kind: "exact",
      path: `${API_PREFIX}/file`,
      handler: createApiHandler(() => state.vaultRoot, previewFile),
    });
    const disposeGraph = ctx.webServer.register({
      kind: "exact",
      path: `${API_PREFIX}/graph`,
      handler: createGraphHandler(() => state.vaultRoot, state.graphCache),
    });
    const disposeInitialize = ctx.webServer.register({
      kind: "exact",
      path: `${API_PREFIX}/initialize`,
      handler: createInitializationHandler(ctx, state),
    });
    const disposeSelect = ctx.webServer.register({
      kind: "exact",
      path: `${API_PREFIX}/select`,
      handler: createSelectionHandler(ctx, state),
    });
    const disposeBrandLogo = ctx.webServer.register({
      kind: "exact",
      path: BRAND_LOGO_ROUTE,
      handler: createBrandLogoHandler(brandLogo),
    });
    const disposeFavicon = ctx.webServer.register({
      kind: "exact",
      path: FAVICON_ROUTE,
      handler: createBrandLogoHandler(favicon),
    });
    return () => {
      disposeFavicon();
      disposeBrandLogo();
      disposeSelect();
      disposeInitialize();
      disposeGraph();
      disposeFile();
      disposeList();
    };
  }, "knowledge-vault-bootstrap: Vault browser, initializer, selector, and brand assets");
}

export { apply, inject, name };
