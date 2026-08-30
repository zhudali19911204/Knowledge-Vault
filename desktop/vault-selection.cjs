const fsp = require("node:fs/promises");
const path = require("node:path");

async function pathType(target) {
  const details = await fsp.stat(target).catch((error) => {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  });
  if (details?.isDirectory()) return "directory";
  if (details) return "other";
  return "missing";
}

async function isInitializedVault(vaultRoot) {
  if (await pathType(vaultRoot) !== "directory") return false;
  const agents = await fsp.stat(path.join(vaultRoot, "AGENTS.md")).catch(() => undefined);
  const inbox = await fsp.stat(path.join(vaultRoot, "01_Inbox")).catch(() => undefined);
  return agents?.isFile() === true && inbox?.isDirectory() === true;
}

async function assertBundledTemplate(templateRoot) {
  if (await pathType(templateRoot) !== "directory") {
    throw new Error(`缺少内置知识库模板目录：${templateRoot}`);
  }
  const agents = path.join(templateRoot, "AGENTS.md");
  const inbox = path.join(templateRoot, "01_Inbox");
  if (!(await fsp.stat(agents).catch(() => undefined))?.isFile()) {
    throw new Error(`缺少内置知识库模板 AGENTS.md：${agents}`);
  }
  if (!(await fsp.stat(inbox).catch(() => undefined))?.isDirectory()) {
    throw new Error(`缺少内置知识库模板 01_Inbox 目录：${inbox}`);
  }
}

async function resolveSelectedVault(productRoot, dataRoot) {
  const root = path.resolve(productRoot);
  const templateRoot = path.join(root, "vault-template");
  const configPath = path.join(path.resolve(dataRoot), "product.json");
  await assertBundledTemplate(templateRoot);

  let config;
  try {
    config = JSON.parse(await fsp.readFile(configPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { selected: templateRoot, templateRoot, configPath };
    }
    return {
      selected: templateRoot,
      templateRoot,
      configPath,
      recovery: { reason: "invalid-config", requested: configPath },
    };
  }

  if (typeof config?.vaultRoot !== "string" || !config.vaultRoot.trim()) {
    return { selected: templateRoot, templateRoot, configPath };
  }

  const requested = path.resolve(config.vaultRoot);
  if (requested === root) {
    return {
      selected: templateRoot,
      templateRoot,
      configPath,
      recovery: { reason: "legacy-product-root", requested },
    };
  }
  if (requested === templateRoot || await isInitializedVault(requested)) {
    return { selected: requested, templateRoot, configPath };
  }

  const requestedType = await pathType(requested);
  return {
    selected: templateRoot,
    templateRoot,
    configPath,
    recovery: {
      reason: requestedType === "missing" ? "missing-vault" : "invalid-vault",
      requested,
    },
  };
}

module.exports = { isInitializedVault, resolveSelectedVault };
