import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { basename, extname, relative, resolve, sep } from "node:path";

const name = "knowledge-vault-bootstrap";
const inject = ["workspaceRegistry", "webServer"];
const API_PREFIX = "/knowledge-vault/api";
const BRAND_LOGO_ROUTE = "/knowledge-vault/assets/bkcs-logo.png";
const BRAND_LOGO_SOURCE = new URL("./assets/bkcs-logo.png", import.meta.url);
const MAX_PREVIEW_BYTES = 1024 * 1024;
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

function createApiHandler(vaultRoot, operation) {
  return async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      const requestedPath = url.searchParams.get("path") || "";
      const value = await operation(vaultRoot, requestedPath);
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
  const vaultRoot = await resolveVaultRoot();
  const brandLogo = await readFile(BRAND_LOGO_SOURCE);

  await ctx.effect(async () => {
    let workspace = await ctx.workspaceRegistry.resolveByPath(vaultRoot);
    const created = workspace === undefined;

    if (created) {
      workspace = await ctx.workspaceRegistry.create(vaultRoot);
    }

    const requestedTitle = process.env.KNOWLEDGE_VAULT_TITLE?.trim();
    const title = requestedTitle || basename(vaultRoot);
    if (title && workspace.title !== title) {
      await workspace.setTitle(title);
    }

    ctx.logger.info(
      `${created ? "registered" : "reused"} bundled knowledge workspace: ${vaultRoot}`,
    );

    return () => {};
  }, "knowledge-vault-bootstrap: register bundled workspace");

  ctx.effect(() => {
    const disposeList = ctx.webServer.register({
      kind: "exact",
      path: `${API_PREFIX}/list`,
      handler: createApiHandler(vaultRoot, listDirectory),
    });
    const disposeFile = ctx.webServer.register({
      kind: "exact",
      path: `${API_PREFIX}/file`,
      handler: createApiHandler(vaultRoot, previewFile),
    });
    const disposeBrandLogo = ctx.webServer.register({
      kind: "exact",
      path: BRAND_LOGO_ROUTE,
      handler: createBrandLogoHandler(brandLogo),
    });
    return () => {
      disposeBrandLogo();
      disposeFile();
      disposeList();
    };
  }, "knowledge-vault-bootstrap: Vault browser and brand assets");
}

export { apply, inject, name };
