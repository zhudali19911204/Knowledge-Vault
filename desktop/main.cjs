const { app, BrowserWindow, dialog, shell, session } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const isSmokeTest = process.argv.includes("--smoke-test");
const localAppData = process.env.LOCALAPPDATA || app.getPath("appData");
const dataRoot = path.resolve(process.env.KV_DESKTOP_DATA_ROOT || path.join(localAppData, "KnowledgeVaultHarness"));
const desktopDataRoot = path.join(dataRoot, "desktop");
app.setPath("userData", desktopDataRoot);
app.setAppUserModelId("com.bkcs.knowledgevault");

let mainWindow;
let backend;
let backendStopping = false;
let quitting = false;
let logStream;
let activeOrigin;
const recentOutput = [];

function productRoot() {
  return app.isPackaged ? path.join(process.resourcesPath, "product") : path.resolve(__dirname, "..");
}

function runtimeNode() {
  if (!app.isPackaged) return process.env.KV_NODE_EXECUTABLE || "node";
  return path.join(process.resourcesPath, "runtime", "node.exe");
}

function rememberOutput(chunk) {
  const text = String(chunk || "");
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    recentOutput.push(line);
    if (recentOutput.length > 80) recentOutput.shift();
  }
  logStream?.write(text);
}

async function ensureFile(filePath, description) {
  const details = await fsp.stat(filePath).catch(() => undefined);
  if (!details?.isFile()) throw new Error(`缺少${description}：${filePath}`);
}

async function ensureDirectory(directory, description) {
  const details = await fsp.stat(directory).catch(() => undefined);
  if (!details?.isDirectory()) throw new Error(`缺少${description}：${directory}`);
}

async function readSelectedVault(root) {
  const templateRoot = path.join(root, "vault-template");
  const configPath = path.join(dataRoot, "product.json");
  let selected = templateRoot;
  try {
    const config = JSON.parse(await fsp.readFile(configPath, "utf8"));
    if (typeof config.vaultRoot === "string" && config.vaultRoot.trim()) selected = path.resolve(config.vaultRoot);
  } catch (error) {
    if (error?.code !== "ENOENT") throw new Error(`已保存的知识库配置无效：${configPath}`);
  }
  await ensureDirectory(selected, "知识库目录");
  await ensureFile(path.join(selected, "AGENTS.md"), "知识库 AGENTS.md");
  await ensureDirectory(path.join(selected, "01_Inbox"), "知识库 01_Inbox 目录");
  return { selected, templateRoot, configPath };
}

async function prepareRuntimePlugin(root) {
  const pluginSource = path.join(root, ".dsh", "plugins", "knowledge-vault-bootstrap");
  const pluginTarget = path.join(dataRoot, "dsh", "profiles", "web", "node_modules", "@knowledge-vault", "dsh-bootstrap");
  await ensureDirectory(pluginSource, "Knowledge Vault 产品插件");
  await fsp.rm(pluginTarget, { recursive: true, force: true });
  await fsp.mkdir(pluginTarget, { recursive: true });
  for (const fileName of ["package.json", "index.js", "client.js", "graph-worker.js"]) {
    await fsp.copyFile(path.join(pluginSource, fileName), path.join(pluginTarget, fileName));
  }
  await fsp.mkdir(path.join(pluginTarget, "assets"), { recursive: true });
  for (const assetName of ["bkcs-logo.png", "knowledge-vault-favicon.png"]) {
    await fsp.copyFile(path.join(pluginSource, "assets", assetName), path.join(pluginTarget, "assets", assetName));
  }
}

async function writeRuntimePatch(root) {
  const templatePath = path.join(root, ".dsh", "cordis.patch.template.yml");
  const generatedRoot = path.join(dataRoot, "generated");
  const patchPath = path.join(generatedRoot, "knowledge-vault.patch.yml");
  await ensureFile(templatePath, "Harness patch 模板");
  await fsp.mkdir(generatedRoot, { recursive: true });
  await fsp.writeFile(patchPath, await fsp.readFile(templatePath, "utf8"), "utf8");
  return patchPath;
}

function reservePort(requested) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(requested || 0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : requested;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function requestReady(url) {
  return new Promise((resolve) => {
    const request = http.get(`${url}/knowledge-vault/api/list?path=`, { timeout: 1500 }, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.on("timeout", () => { request.destroy(); resolve(false); });
    request.on("error", () => resolve(false));
  });
}

async function waitForBackend(url, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (backend?.exitCode !== null) throw new Error(`本地知识库服务提前退出，代码 ${backend.exitCode}。`);
    if (await requestReady(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error("本地知识库服务启动超时。");
}

async function startBackend() {
  const root = productRoot();
  const node = runtimeNode();
  const dshBin = path.join(root, "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
  const { selected: vaultRoot, templateRoot, configPath } = await readSelectedVault(root);
  if (app.isPackaged) await ensureFile(node, "桌面版 Node 运行时");
  await ensureFile(dshBin, "固定版 DeepSeek Harness");
  await prepareRuntimePlugin(root);
  const patchPath = await writeRuntimePatch(root);
  await fsp.mkdir(path.join(dataRoot, "dsh"), { recursive: true });
  await fsp.mkdir(path.join(dataRoot, "logs"), { recursive: true });
  const logPath = path.join(dataRoot, "logs", "desktop.log");
  logStream = fs.createWriteStream(logPath, { flags: "a" });
  logStream.write(`\n[${new Date().toISOString()}] Starting Knowledge Vault Desktop\n`);

  const requestedPort = Number.parseInt(process.env.KV_DESKTOP_PORT || "", 10);
  const port = await reservePort(Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort <= 65535 ? requestedPort : 0);
  const url = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    DSH_HOME: path.join(dataRoot, "dsh"),
    KNOWLEDGE_VAULT_ROOT: vaultRoot,
    KNOWLEDGE_VAULT_TITLE: path.basename(vaultRoot === templateRoot ? root : vaultRoot),
    KNOWLEDGE_VAULT_TEMPLATE_ROOT: templateRoot,
    KNOWLEDGE_VAULT_PRODUCT_ROOT: root,
    KNOWLEDGE_VAULT_PRODUCT_CONFIG: configPath,
    NODE_USE_SYSTEM_CA: "1",
  };
  backend = spawn(node, [dshBin, "--patch", patchPath, "--profile", "web", "--host", "127.0.0.1", "--port", String(port), "--no-open"], {
    cwd: vaultRoot,
    env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  backend.stdout.on("data", rememberOutput);
  backend.stderr.on("data", rememberOutput);
  backend.once("exit", (code) => {
    logStream?.write(`[${new Date().toISOString()}] Harness exited with code ${code}\n`);
    if (!backendStopping && !quitting && !isSmokeTest) {
      dialog.showErrorBox("Knowledge Vault 已停止", `本地知识库服务意外退出，代码 ${code}。\n\n日志：${logPath}`);
      app.quit();
    }
  });
  await waitForBackend(url);
  activeOrigin = url;
  return { url, vaultRoot, logPath };
}

function closeLog() {
  if (!logStream) return Promise.resolve();
  const stream = logStream;
  logStream = undefined;
  return new Promise((resolve) => stream.end(resolve));
}

async function stopBackend() {
  if (backendStopping) return;
  if (!backend?.pid || backend.exitCode !== null) {
    await closeLog();
    return;
  }
  backendStopping = true;
  await new Promise((resolve) => {
    const killer = spawn("taskkill.exe", ["/pid", String(backend.pid), "/t", "/f"], {
      windowsHide: true,
      stdio: "ignore",
    });
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      resolve();
    };
    killer.once("exit", finish);
    killer.once("error", () => {
      backend.kill();
      finish();
    });
    setTimeout(finish, 5000).unref();
  });
  await closeLog();
}

function createWindow() {
  const icon = path.join(productRoot(), ".dsh", "plugins", "knowledge-vault-bootstrap", "assets", "knowledge-vault-favicon.png");
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: !isSmokeTest,
    autoHideMenuBar: true,
    backgroundColor: "#f7f8fa",
    icon,
    title: "Knowledge Vault",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "loading.html"));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (activeOrigin && url.startsWith(`${activeOrigin}/`)) {
      void mainWindow.loadURL(url);
      return { action: "deny" };
    }
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("file:")) return;
    if (activeOrigin && url.startsWith(`${activeOrigin}/`)) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
  });
}

async function writeSmokeResult(value) {
  const readyFile = process.env.KV_DESKTOP_READY_FILE;
  if (!readyFile) return;
  await fsp.mkdir(path.dirname(readyFile), { recursive: true });
  await fsp.writeFile(readyFile, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      callback(permission === "clipboard-sanitized-write");
    });
    createWindow();
    try {
      const result = await startBackend();
      await mainWindow.loadURL(result.url);
      await writeSmokeResult({ ready: true, url: result.url, vaultRoot: result.vaultRoot });
      if (isSmokeTest) {
        quitting = true;
        await stopBackend();
        app.exit(0);
      }
    } catch (error) {
      const message = `${error?.message || error}\n\n${recentOutput.slice(-20).join("\n")}`.trim();
      await writeSmokeResult({ ready: false, error: message }).catch(() => {});
      if (!isSmokeTest) dialog.showErrorBox("Knowledge Vault 启动失败", message);
      quitting = true;
      await stopBackend();
      app.exit(1);
    }
  });

  app.on("window-all-closed", async () => {
    if (quitting) return;
    quitting = true;
    await stopBackend();
    app.quit();
  });

  app.on("before-quit", () => {
    quitting = true;
    void stopBackend();
  });
}
