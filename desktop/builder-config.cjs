const path = require("node:path");
const productPackage = require("../package.json");

const productRoot = process.env.KV_DESKTOP_PRODUCT_ROOT;
const nodeRoot = process.env.KV_DESKTOP_NODE_ROOT;
const outputRoot = process.env.KV_DESKTOP_OUTPUT;

if (!productRoot || !nodeRoot || !outputRoot) {
  throw new Error("KV_DESKTOP_PRODUCT_ROOT, KV_DESKTOP_NODE_ROOT and KV_DESKTOP_OUTPUT are required.");
}

module.exports = {
  appId: "com.bkcs.knowledgevault",
  productName: "Knowledge Vault",
  copyright: "Copyright © BKCS",
  asar: true,
  compression: "maximum",
  npmRebuild: false,
  electronDist: process.env.KV_DESKTOP_ELECTRON_DIST || path.resolve(__dirname, "node_modules/electron/dist"),
  buildDependenciesFromSource: false,
  removePackageScripts: true,
  directories: {
    output: outputRoot,
  },
  files: [
    "main.cjs",
    "loading.html",
    "package.json",
  ],
  extraMetadata: {
    version: productPackage.version,
  },
  extraResources: [
    {
      from: productRoot,
      to: "product",
      filter: ["**/*", "!node_modules{,/**/*}"],
    },
    {
      from: path.join(productRoot, "node_modules"),
      to: "product/node_modules",
      filter: ["**/*"],
    },
    {
      from: nodeRoot,
      to: "runtime",
    },
  ],
  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64"],
      },
    ],
    executableName: "Knowledge Vault",
    icon: path.resolve(__dirname, "../.dsh/plugins/knowledge-vault-bootstrap/assets/knowledge-vault-favicon.png"),
    verifyUpdateCodeSignature: false,
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowElevation: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: "always",
    createStartMenuShortcut: true,
    shortcutName: "Knowledge Vault",
    uninstallDisplayName: "Knowledge Vault",
    deleteAppDataOnUninstall: false,
    runAfterFinish: true,
    artifactName: `Knowledge-Vault-Setup-${productPackage.version}-win-x64.exe`,
  },
};
