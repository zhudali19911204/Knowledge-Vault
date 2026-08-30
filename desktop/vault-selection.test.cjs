const assert = require("node:assert/strict");
const { mkdtemp, mkdir, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { resolveSelectedVault } = require("./vault-selection.cjs");

async function initializeMinimalVault(vaultRoot) {
  await mkdir(path.join(vaultRoot, "01_Inbox"), { recursive: true });
  await writeFile(path.join(vaultRoot, "AGENTS.md"), "# Test Vault\n", "utf8");
}

test("desktop vault selection safely recovers when a saved Vault is deleted", async (t) => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "knowledge-vault-selection-"));
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }));

  const productRoot = path.join(temporaryRoot, "product");
  const templateRoot = path.join(productRoot, "vault-template");
  const dataRoot = path.join(temporaryRoot, "data");
  const selectedRoot = path.join(temporaryRoot, "selected-vault");
  const invalidRoot = path.join(temporaryRoot, "not-a-vault");
  await initializeMinimalVault(templateRoot);
  await mkdir(dataRoot, { recursive: true });

  const firstLaunch = await resolveSelectedVault(productRoot, dataRoot);
  assert.equal(firstLaunch.selected, templateRoot);
  assert.equal(firstLaunch.recovery, undefined);

  await initializeMinimalVault(selectedRoot);
  await writeFile(
    path.join(dataRoot, "product.json"),
    `${JSON.stringify({ vaultRoot: selectedRoot })}\n`,
    "utf8",
  );
  const selected = await resolveSelectedVault(productRoot, dataRoot);
  assert.equal(selected.selected, selectedRoot);
  assert.equal(selected.recovery, undefined);

  await rm(selectedRoot, { recursive: true, force: true });
  const deleted = await resolveSelectedVault(productRoot, dataRoot);
  assert.equal(deleted.selected, templateRoot);
  assert.deepEqual(deleted.recovery, { reason: "missing-vault", requested: selectedRoot });

  await mkdir(invalidRoot);
  await writeFile(
    path.join(dataRoot, "product.json"),
    `${JSON.stringify({ vaultRoot: invalidRoot })}\n`,
    "utf8",
  );
  const invalid = await resolveSelectedVault(productRoot, dataRoot);
  assert.equal(invalid.selected, templateRoot);
  assert.deepEqual(invalid.recovery, { reason: "invalid-vault", requested: invalidRoot });

  await writeFile(path.join(dataRoot, "product.json"), "not json\n", "utf8");
  const corruptConfig = await resolveSelectedVault(productRoot, dataRoot);
  assert.equal(corruptConfig.selected, templateRoot);
  assert.deepEqual(corruptConfig.recovery, {
    reason: "invalid-config",
    requested: path.join(dataRoot, "product.json"),
  });
});
