[CmdletBinding()]
param(
    [ValidateRange(15, 300)]
    [int]$TimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$productRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$vaultTemplateRoot = Join-Path $productRoot "vault-template"
$captureSkillPath = Join-Path $vaultTemplateRoot ".dsh\skills\knowledge-capture\SKILL.md"
$captureLauncherPath = Join-Path $vaultTemplateRoot ".dsh\skills\knowledge-capture\scripts\capture.py"
$captureScriptPath = Join-Path $vaultTemplateRoot ".dsh\skills\knowledge-capture\scripts\document_to_markdown.py"
$captureRequirementsPath = Join-Path $vaultTemplateRoot ".dsh\skills\knowledge-capture\scripts\requirements.txt"
$captureRulesPath = Join-Path $vaultTemplateRoot ".dsh\skills\knowledge-capture\references\conversion-rules.md"
$organizeSkillPath = Join-Path $vaultTemplateRoot ".dsh\skills\knowledge-organize\SKILL.md"
$organizeScriptPath = Join-Path $vaultTemplateRoot ".dsh\skills\knowledge-organize\scripts\organize_batch.py"
$inboxTemplateName = "Inbox $([char]0x6536)$([char]0x96C6)$([char]0x6A21)$([char]0x677F).md"
$inboxTemplateRelativePath = Join-Path "05_Skills\0501_Knowledge Management\050101_Templates" $inboxTemplateName
$inboxTemplatePath = Join-Path $vaultTemplateRoot $inboxTemplateRelativePath
$localDshCommand = Join-Path $productRoot "node_modules\.bin\dsh.cmd"
$launcher = Join-Path $productRoot "Start-DeepSeekHarness.ps1"
$initializer = Join-Path $productRoot "Initialize-KnowledgeBase.ps1"
$pluginPath = Join-Path $productRoot ".dsh\plugins\knowledge-vault-bootstrap\index.js"
$clientPluginPath = Join-Path $productRoot ".dsh\plugins\knowledge-vault-bootstrap\client.js"
$graphWorkerPath = Join-Path $productRoot ".dsh\plugins\knowledge-vault-bootstrap\graph-worker.js"
$brandLogoPath = Join-Path $productRoot ".dsh\plugins\knowledge-vault-bootstrap\assets\bkcs-logo.png"
$faviconPath = Join-Path $productRoot ".dsh\plugins\knowledge-vault-bootstrap\assets\knowledge-vault-favicon.png"
$manifestPath = Join-Path $productRoot "package.json"
$desktopMainPath = Join-Path $productRoot "desktop\main.cjs"
$desktopVaultSelectionPath = Join-Path $productRoot "desktop\vault-selection.cjs"
$desktopVaultSelectionTestPath = Join-Path $productRoot "desktop\vault-selection.test.cjs"
$desktopBuilderConfigPath = Join-Path $productRoot "desktop\builder-config.cjs"
$desktopManifestPath = Join-Path $productRoot "desktop\package.json"
$desktopLoadingPath = Join-Path $productRoot "desktop\loading.html"
$desktopBuildScript = Join-Path $productRoot "Build-DesktopDistribution.ps1"

foreach ($path in @(
    $localDshCommand,
    $launcher,
    $initializer,
    $pluginPath,
    $clientPluginPath,
    $graphWorkerPath,
    $brandLogoPath,
    $faviconPath,
    $manifestPath,
    $desktopMainPath,
    $desktopVaultSelectionPath,
    $desktopVaultSelectionTestPath,
    $desktopBuilderConfigPath,
    $desktopManifestPath,
    $desktopLoadingPath,
    $desktopBuildScript,
    $captureSkillPath,
    $captureLauncherPath,
    $captureScriptPath,
    $captureRequirementsPath,
    $captureRulesPath,
    $organizeSkillPath,
    $organizeScriptPath,
    $inboxTemplatePath,
    (Join-Path $vaultTemplateRoot "AGENTS.md"),
    (Join-Path $vaultTemplateRoot ".agents\scripts\knowledge_router.py")
)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Release test prerequisite is missing: $path. Run Install-KnowledgeBase.cmd first."
    }
}

Write-Host "Checking scripts and the pinned runtime..."
$parseFiles = @(
    "Initialize-KnowledgeBase.ps1",
    "Install-KnowledgeBase.ps1",
    "Start-DeepSeekHarness.ps1",
    "Test-KnowledgeBase.ps1",
    "Build-Distribution.ps1",
    "Build-DesktopDistribution.ps1"
)
foreach ($file in $parseFiles) {
    $tokens = $null
    $errors = $null
    $path = Join-Path $productRoot $file
    [System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors) | Out-Null
    if ($errors.Count -gt 0) {
        $details = ($errors | ForEach-Object { $_.Message }) -join [Environment]::NewLine
        throw "PowerShell parse failed for $file`n$details"
    }
}

& node --check $pluginPath
if ($LASTEXITCODE -ne 0) {
    throw "Bootstrap plugin syntax validation failed with exit code $LASTEXITCODE."
}
& node --check $clientPluginPath
if ($LASTEXITCODE -ne 0) {
    throw "Knowledge Vault client plugin syntax validation failed with exit code $LASTEXITCODE."
}
& node --check $graphWorkerPath
if ($LASTEXITCODE -ne 0) {
    throw "Knowledge Vault graph worker syntax validation failed with exit code $LASTEXITCODE."
}
& node --check $desktopMainPath
if ($LASTEXITCODE -ne 0) {
    throw "Knowledge Vault desktop shell syntax validation failed with exit code $LASTEXITCODE."
}
& node --check $desktopVaultSelectionPath
if ($LASTEXITCODE -ne 0) {
    throw "Knowledge Vault desktop Vault selection validation failed with exit code $LASTEXITCODE."
}
& node $desktopVaultSelectionTestPath
if ($LASTEXITCODE -ne 0) {
    throw "Knowledge Vault desktop Vault recovery test failed with exit code $LASTEXITCODE."
}
& node --check $desktopBuilderConfigPath
if ($LASTEXITCODE -ne 0) {
    throw "Knowledge Vault desktop builder config validation failed with exit code $LASTEXITCODE."
}
& python $captureScriptPath --help | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Knowledge capture converter validation failed with exit code $LASTEXITCODE."
}
$captureRuntimeProbe = Join-Path ([System.IO.Path]::GetTempPath()) ("KnowledgeVaultHarness-capture-probe-" + [guid]::NewGuid().ToString("N"))
$captureRuntimeInfo = (& python $captureLauncherPath --runtime-info --runtime-root $captureRuntimeProbe | Out-String) | ConvertFrom-Json
if (
    $LASTEXITCODE -ne 0 -or
    $captureRuntimeInfo.ready -ne $false -or
    -not [string]::Equals([string]$captureRuntimeInfo.runtime_root, $captureRuntimeProbe, [System.StringComparison]::OrdinalIgnoreCase) -or
    (Test-Path -LiteralPath $captureRuntimeProbe)
) {
    throw "Knowledge capture launcher did not inspect an isolated runtime without mutating it."
}
$captureSkill = Get-Content -Raw -Encoding UTF8 -LiteralPath $captureSkillPath
$captureLauncher = Get-Content -Raw -Encoding UTF8 -LiteralPath $captureLauncherPath
$captureScript = Get-Content -Raw -Encoding UTF8 -LiteralPath $captureScriptPath
$captureRequirements = Get-Content -Raw -Encoding UTF8 -LiteralPath $captureRequirementsPath
$inboxTemplate = Get-Content -Raw -Encoding UTF8 -LiteralPath $inboxTemplatePath
$captureContractChecks = [ordered]@{
    "inspect command" = $captureSkill -match '--inspect'
    "attachments mode" = $captureSkill -match '\battachments\b'
    "multimodal mode" = $captureSkill -match '\bmultimodal\b'
    "read image workflow" = $captureSkill -match '\bread_image\b'
    "Tesseract implementation removed" = ($captureScript + $captureRequirements) -notmatch '(?i)pytesseract|tesseract|\bocr\b'
    "isolated launcher command" = $captureSkill -match 'scripts/capture\.py'
    "isolated dependency installer" = $captureSkill -match '--install-dependencies'
    "sandbox escalation guidance" = $captureSkill -match 'sandbox_permissions: danger-full-access'
    "launcher virtual environment" = $captureLauncher -match 'venv\.EnvBuilder'
    "launcher runtime outside Vault" = $captureLauncher -match 'DSH_HOME'
    "cached Excel value implementation" = $captureScript -match 'value = cached_sheet\[cell\.coordinate\]\.value'
    "legacy formula-plus-cache output removed" = $captureScript -notmatch '⟦缓存值:'
    "source hash metadata" = $inboxTemplate -match 'source_sha256:'
    "conversion mode metadata" = $inboxTemplate -match 'conversion_mode:'
}
& python $organizeScriptPath --help | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Knowledge organize batch script validation failed with exit code $LASTEXITCODE."
}
$captureContractFailures = @($captureContractChecks.GetEnumerator() | Where-Object { -not $_.Value } | ForEach-Object { $_.Key })
if ($captureContractFailures.Count -gt 0) {
    throw "Knowledge capture conversion contract failed: $($captureContractFailures -join ', ')"
}
$organizeSkill = Get-Content -Raw -Encoding UTF8 -LiteralPath $organizeSkillPath
$vaultAgent = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $vaultTemplateRoot "AGENTS.md")
if (
    $organizeSkill -notmatch '\bcustom\b' -or
    $organizeSkill -notmatch '\brecommend\b' -or
    $organizeSkill -notmatch '\bSOP\b' -or
    $organizeSkill -notmatch '!\[\[07_Attachments/' -or
    $organizeSkill -notmatch 'route_confidence' -or
    $organizeSkill -notmatch 'organize_batch\.py' -or
    $organizeSkill -notmatch '--cards' -or
    $organizeSkill -notmatch '--cleanup' -or
    $organizeSkill -notmatch '\bbuilder\b'
) {
    throw "Knowledge organize Skill is not configured for custom or AI-recommended atomic-card plans."
}
if (
    $vaultAgent -notmatch 'knowledge-skill' -or
    $vaultAgent -notmatch '07_Attachments/' -or
    $vaultAgent -notmatch 'route_confidence'
) {
    throw "Vault AGENTS.md is missing shared knowledge-card safety rules."
}
$desktopManifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $desktopManifestPath | ConvertFrom-Json
$rootManifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $manifestPath | ConvertFrom-Json
if ([string]$desktopManifest.version -ne [string]$rootManifest.version) {
    throw "Desktop package version does not match the product version."
}

$graphSimulationSmoke = @'
const fs = require("node:fs");
const vm = require("node:vm");
const clientPath = process.argv[2];
let source = fs.readFileSync(clientPath, "utf8");
const marker = "    exports.apply = apply;";
if (!source.includes(marker)) throw new Error("Unable to expose graph simulation helpers.");
source = source.replace(marker, `
    exports.__graphTest = {
      createGraphSimulation,
      reheatGraphSimulation,
      tickGraphSimulation,
      renderMarkdownSource,
      resolveVaultDocumentPath,
      normalizeObsidianDocumentLink,
      findObsidianVaultDocumentLinks,
      tokenizeFrontmatterRelatedLinks,
      tokenizeVaultDocumentLinks,
      splitMarkdownRelationshipSection,
      findMalformedVaultMarkdownLinks,
      upgradeMalformedVaultMarkdownLinks,
    };
${marker}`);
let plugin;
const React = { createElement() {} };
let capturedDocumentClick;
const dispatchedWindowEvents = [];
const documentStub = {
  addEventListener(type, handler, capture) {
    if (type === "click" && capture === true) capturedDocumentClick = handler;
  },
  removeEventListener(type, handler, capture) {
    if (type === "click" && capture === true && capturedDocumentClick === handler) capturedDocumentClick = undefined;
  },
};
class TestCustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
}
const sandbox = {
  CustomEvent: TestCustomEvent,
  window: {
    location: { origin: "http://127.0.0.1:3080" },
    dispatchEvent(event) {
      dispatchedWindowEvents.push(event);
    },
    __ModuleLoader__: {
      load(definition) {
        plugin = definition.factory((name) => name === "react" ? React : {});
      },
    },
  },
  URL,
};
vm.runInNewContext(source, sandbox, { filename: clientPath });
sandbox.document = documentStub;
const helpers = plugin?.__graphTest;
if (!helpers) throw new Error("Graph simulation helpers were not loaded.");
const nodes = [
  { id: "A.md", path: "A.md", title: "A", topFolder: "02_Domains", degree: 1, isIndex: false },
  { id: "B.md", path: "B.md", title: "B", topFolder: "02_Domains", degree: 2, isIndex: false },
  { id: "C.md", path: "C.md", title: "C", topFolder: "03_Areas", degree: 1, isIndex: false },
];
const edges = [
  { source: "A.md", target: "B.md", kind: "wikilink" },
  { source: "B.md", target: "C.md", kind: "related" },
];
const simulation = helpers.createGraphSimulation(nodes, edges);
const before = Array.from(simulation.positions.values(), ({ x, y }) => ({ x, y }));
for (let index = 0; index < 90; index += 1) helpers.tickGraphSimulation(simulation);
const after = Array.from(simulation.positions.values());
if (!after.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))) {
  throw new Error("Dynamic graph produced a non-finite position.");
}
if (!after.some((point, index) => Math.hypot(point.x - before[index].x, point.y - before[index].y) > .1)) {
  throw new Error("Dynamic graph nodes did not move.");
}
if (!(simulation.alpha < 1)) throw new Error("Dynamic graph did not cool down.");
const dragged = simulation.positions.get("A.md");
dragged.fx = 40;
dragged.fy = -25;
helpers.reheatGraphSimulation(simulation, .5);
helpers.tickGraphSimulation(simulation);
if (dragged.x !== 40 || dragged.y !== -25) throw new Error("Dragged node was not fixed.");
dragged.fx = null;
dragged.fy = null;
helpers.reheatGraphSimulation(simulation, .6);
for (let index = 0; index < 12; index += 1) helpers.tickGraphSimulation(simulation);
if (dragged.x === 40 && dragged.y === -25) throw new Error("Released node did not rejoin the layout.");
const obsidianImage = helpers.renderMarkdownSource(
  "![[07_Attachments/0701_Project/demo image.png]]",
  "03_Areas/0301_Project/Reader.md",
);
if (!obsidianImage.includes("http://127.0.0.1:3080/knowledge-vault/api/image?path=07_Attachments%2F0701_Project%2Fdemo+image.png")) {
  throw new Error("Obsidian image embed was not rewritten to the read-only Vault image API.");
}
const relativeImage = helpers.renderMarkdownSource(
  "![diagram](../images/diagram.png)",
  "03_Areas/0301_Project/Reader.md",
);
if (!relativeImage.includes("path=03_Areas%2Fimages%2Fdiagram.png")) {
  throw new Error("Relative Markdown image path was not resolved from its document directory.");
}
const vaultAttachment = helpers.renderMarkdownSource(
  "![contour](07_Attachments/0701_Course/slide11_contour.png)",
  "01_Inbox/Reader.md",
);
if (!vaultAttachment.includes("path=07_Attachments%2F0701_Course%2Fslide11_contour.png")) {
  throw new Error("Obsidian-style Vault attachment path was incorrectly resolved relative to the document.");
}
const fencedImage = helpers.renderMarkdownSource(
  "```md\n![[07_Attachments/demo.png]]\n```",
  "03_Areas/0301_Project/Reader.md",
);
if (fencedImage.includes("/knowledge-vault/api/image")) {
  throw new Error("Image syntax inside a fenced code block must remain literal.");
}
const obsidianRelations = helpers.renderMarkdownSource(
  "Source: [[06_Archive/Sources/AI Dialogues/0601_2026/2026-08-21 1529 - M100.2 Rule|M100.2 source]]\nIndex: [[02_FICO/0203_Transfer Price/_Index|FICO Transfer Price]]",
  "02_FICO/0203_Transfer Price/Current.md",
);
if (!obsidianRelations.includes("[[06_Archive/Sources/AI Dialogues/0601_2026/2026-08-21 1529 - M100.2 Rule|M100.2 source]]")) {
  throw new Error(`An Obsidian source link was not preserved for direct Vault link upgrading: ${obsidianRelations}`);
}
if (!obsidianRelations.includes("[[02_FICO/0203_Transfer Price/_Index|FICO Transfer Price]]")) {
  throw new Error(`An Obsidian index link was not preserved for direct Vault link upgrading: ${obsidianRelations}`);
}
const relativeRelation = helpers.normalizeObsidianDocumentLink(
  "02_FICO/0203_Transfer Price/Current.md",
  "./Related Rule|Related",
);
if (relativeRelation?.path !== "02_FICO/0203_Transfer Price/Related Rule.md") {
  throw new Error(`A relative Obsidian relationship did not resolve from the current document: ${JSON.stringify(relativeRelation)}`);
}
if (helpers.renderMarkdownSource("Attachment: ![[07_Attachments/manual.pdf]]", "02_FICO/Current.md").includes("[manual]")) {
  throw new Error("A non-Markdown Obsidian attachment must not be rewritten as a document link.");
}
const fencedRelation = helpers.renderMarkdownSource(
  "```md\n[[02_FICO/0203_Transfer Price/_Index|Index]]\n```",
  "02_FICO/Current.md",
);
if (!fencedRelation.includes("[[02_FICO/0203_Transfer Price/_Index|Index]]")) {
  throw new Error("Obsidian document link syntax inside a fenced code block must remain literal.");
}
const frontmatterTokens = helpers.tokenizeFrontmatterRelatedLinks(
  [
    "source_notes:",
    '  - "[[06_Archive/Sources/Dialogue|Source]]"',
    'parent_index: "[[03_Areas/0302_RAG/_Index|RAG Index]]"',
    "related:",
    '  - "[[03_Areas/0302_RAG/_Index|RAG]]"',
    '  - "[[05_Skills/0502_Markdown/_Index|Markdown]]"',
    "routed_at: 2026-08-21T12:45:19+08:00",
  ].join("\n"),
  "05_Skills/0501_Knowledge Management/Current.md",
);
const frontmatterLinks = frontmatterTokens.filter((token) => token.kind === "link");
if (frontmatterLinks.length !== 4) {
  throw new Error(`All frontmatter relationship entries should become links: ${JSON.stringify(frontmatterTokens)}`);
}
if (frontmatterLinks[0].path !== "06_Archive/Sources/Dialogue.md" || frontmatterLinks[0].label !== "Source") {
  throw new Error(`The frontmatter source entry was not normalized: ${JSON.stringify(frontmatterLinks[0])}`);
}
if (frontmatterLinks[1].path !== "03_Areas/0302_RAG/_Index.md" || frontmatterLinks[1].label !== "RAG Index") {
  throw new Error(`The frontmatter parent index was not normalized: ${JSON.stringify(frontmatterLinks[1])}`);
}
if (frontmatterLinks[2].path !== "03_Areas/0302_RAG/_Index.md" || frontmatterLinks[3].path !== "05_Skills/0502_Markdown/_Index.md") {
  throw new Error(`The frontmatter related entries were not normalized: ${JSON.stringify(frontmatterLinks)}`);
}
const bodyRelationship = helpers.splitMarkdownRelationshipSection([
  "# Card",
  "",
  "## Source",
  "Body",
  "",
  "## \u6765\u6e90\u4e0e\u5173\u8054",
  "",
  "- Index: [[03_Areas/0301_LLM/_Index|LLM]]",
  "- Related: [[03_Areas/0301_LLM/RNN|RNN]], [[03_Areas/0302_RAG/Flow|RAG flow]]",
].join("\n"));
if (!bodyRelationship || !bodyRelationship.before.includes("## Source") || bodyRelationship.lines.length < 2) {
  throw new Error(`The body relationship section was not isolated for direct link rendering: ${JSON.stringify(bodyRelationship)}`);
}
const bodyRelationshipTokens = helpers.tokenizeVaultDocumentLinks(bodyRelationship.lines.join("\n"));
const bodyRelationshipLinks = bodyRelationshipTokens.filter((token) => token.kind === "link");
if (bodyRelationshipLinks.length !== 3 || bodyRelationshipLinks[0].path !== "03_Areas/0301_LLM/_Index.md") {
  throw new Error(`The body relationship links did not use the frontmatter-compatible direct-link model: ${JSON.stringify(bodyRelationshipLinks)}`);
}
const chatDocument = helpers.resolveVaultDocumentPath(
  "",
  "02_FICO/0203_Transfer%20Price/%E4%BE%9D%E6%8D%AE%E6%96%87%E6%A1%A3.md#section",
);
if (chatDocument !== "02_FICO/0203_Transfer Price/\u4f9d\u636e\u6587\u6863.md") {
  throw new Error(`Chat Vault Markdown path was not decoded from the Vault root: ${chatDocument}`);
}
const readerDocument = helpers.resolveVaultDocumentPath(
  "02_FICO/0209_Other/020901_Index/Current.md",
  "../0203_Transfer Price/Rule.md",
);
if (readerDocument !== "02_FICO/0209_Other/0203_Transfer Price/Rule.md") {
  throw new Error(`Reader-relative Markdown path was not normalized safely: ${readerDocument}`);
}
if (helpers.resolveVaultDocumentPath("", "https://example.com/External.md") !== "") {
  throw new Error("External Markdown URLs must not be intercepted by the Vault reader.");
}
if (helpers.resolveVaultDocumentPath("01_Inbox/Current.md", "../../outside.md") !== "") {
  throw new Error("A Markdown path that escapes the Vault root must be rejected.");
}
if (helpers.resolveVaultDocumentPath("", "07_Attachments/image.png") !== "") {
  throw new Error("Non-Markdown links must not be intercepted by the Vault reader.");
}
const malformedLinks = helpers.findMalformedVaultMarkdownLinks(
  "[M100.2 rule](02_FICO/0203_Transfer Price/2026 Rule.md)",
);
if (malformedLinks.length !== 1 || malformedLinks[0].path !== "02_FICO/0203_Transfer Price/2026 Rule.md") {
  throw new Error(`A historical Markdown link containing spaces was not recovered: ${JSON.stringify(malformedLinks)}`);
}
if (helpers.findMalformedVaultMarkdownLinks("[External](https://example.com/External Rule.md)").length !== 0) {
  throw new Error("A malformed external Markdown URL must not be upgraded to a Vault link.");
}
let replacedFragment;
const upgradedAnchors = [];
const malformedTextNode = {
  nodeType: 3,
  nodeValue: "Source: [M100.2 rule](02_FICO/0203_Transfer Price/2026 Rule.md); related: [[02_FICO/0203_Transfer Price/_Index|Index]]",
};
const malformedParent = {
  closest() { return null; },
  replaceChild(fragment, node) {
    if (node !== malformedTextNode) throw new Error("The wrong historical text node was replaced.");
    replacedFragment = fragment;
  },
};
malformedTextNode.parentElement = malformedParent;
malformedTextNode.parentNode = malformedParent;
const malformedDocument = {
  createTreeWalker() {
    let yielded = false;
    return { nextNode() { return yielded ? null : (yielded = true, malformedTextNode); } };
  },
  createDocumentFragment() {
    return { children: [], appendChild(child) { this.children.push(child); } };
  },
  createTextNode(value) { return { nodeType: 3, nodeValue: value }; },
  createElement(tagName) {
    const attributes = new Map();
    const element = {
      tagName,
      textContent: "",
      setAttribute(name, value) { attributes.set(name, value); },
      getAttribute(name) { return attributes.get(name) ?? null; },
    };
    upgradedAnchors.push(element);
    return element;
  },
};
const malformedRoot = { nodeType: 1, ownerDocument: malformedDocument };
const upgradedCount = helpers.upgradeMalformedVaultMarkdownLinks(malformedRoot);
if (upgradedCount !== 2 || !replacedFragment || upgradedAnchors.length !== 2) {
  throw new Error("Historical Markdown and Obsidian links were not upgraded into clickable anchors.");
}
if (upgradedAnchors[0].getAttribute("data-knowledge-vault-path") !== "02_FICO/0203_Transfer Price/2026 Rule.md") {
  throw new Error("The upgraded historical link did not keep its resolved Vault path.");
}
if (upgradedAnchors[1].getAttribute("data-knowledge-vault-path") !== "02_FICO/0203_Transfer Price/_Index.md") {
  throw new Error("The upgraded Obsidian relationship did not keep its resolved Vault path.");
}
const renderedAnchorAttributes = new Map([["href", "/03_Areas/0302_RAG/_Index.md"]]);
const renderedMarkdownAnchor = {
  nodeType: 1,
  ownerDocument: { createTreeWalker() { return { nextNode() { return null; } }; } },
  matches(selector) { return selector === "a[href]"; },
  querySelectorAll() { return []; },
  closest() { return null; },
  hasAttribute(name) { return renderedAnchorAttributes.has(name); },
  getAttribute(name) { return renderedAnchorAttributes.get(name) ?? null; },
  setAttribute(name, value) { renderedAnchorAttributes.set(name, value); },
};
if (helpers.upgradeMalformedVaultMarkdownLinks(renderedMarkdownAnchor) !== 1) {
  throw new Error("A rendered Vault Markdown anchor was not upgraded to the direct-link design.");
}
if (renderedMarkdownAnchor.getAttribute("data-knowledge-vault-path") !== "03_Areas/0302_RAG/_Index.md") {
  throw new Error("A rendered Vault Markdown anchor did not receive its direct reader path.");
}
const effectCleanups = [];
plugin.apply({
  effect(callback, description) {
    if (description === "knowledge-vault-bootstrap: open Vault Markdown links in reader") {
      effectCleanups.push(callback());
    }
  },
  slots: { inject() {} },
  workspaces: {},
});
if (typeof capturedDocumentClick !== "function") {
  throw new Error("Vault Markdown click interception was not registered in capture phase.");
}
const chatAnchor = {
  getAttribute(name) {
    return name === "href" ? "02_FICO/0203_Transfer%20Price/Rule.md" : null;
  },
  hasAttribute() { return false; },
  closest(selector) {
    return selector === "a" ? this : null;
  },
};
let prevented = false;
let stopped = false;
capturedDocumentClick({
  target: chatAnchor,
  preventDefault() { prevented = true; },
  stopPropagation() { stopped = true; },
});
const openEvent = dispatchedWindowEvents.at(-1);
if (!prevented || !stopped || openEvent?.type !== "knowledge-vault:open-file") {
  throw new Error("Vault Markdown click did not suppress navigation and dispatch an open-file event.");
}
if (openEvent.detail?.path !== "02_FICO/0203_Transfer Price/Rule.md" || openEvent.detail?.openReader !== true) {
  throw new Error(`Vault Markdown click dispatched the wrong reader request: ${JSON.stringify(openEvent?.detail)}`);
}
effectCleanups.forEach((cleanup) => cleanup?.());
console.log("Dynamic graph simulation smoke passed.");
'@
$graphSimulationSmoke | & node - $clientPluginPath
if ($LASTEXITCODE -ne 0) {
    throw "Dynamic graph simulation validation failed with exit code $LASTEXITCODE."
}

$graphWorkerBenchmark = @'
const fs = require("node:fs");
const vm = require("node:vm");
const workerPath = process.argv[2];
const source = fs.readFileSync(workerPath, "utf8");
const workerSelf = { postMessage() {} };
vm.runInNewContext(source, {
  self: workerSelf,
  setTimeout,
  clearTimeout,
  Float32Array,
  Map,
  Math,
  Number,
}, { filename: workerPath });
const helpers = workerSelf.__graphWorkerTest;
if (!helpers) throw new Error("Graph worker test helpers were not loaded.");
const settings = {
  repulsion: 150,
  linkDistance: 1,
  clusterStrength: 55,
  centerStrength: 12,
  nodeScale: 1,
  edgeWidth: 1,
  labelLimit: 100,
};
function fixture(size) {
  const nodes = Array.from({ length: size }, (_, index) => {
    const angle = index * 2.399963229728653;
    const radius = 30 * Math.sqrt(index);
    const groupIndex = index % 12;
    return {
      id: `N${index}`,
      group: `G${groupIndex}`,
      radius: 5,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      anchorX: Math.cos(groupIndex / 12 * Math.PI * 2) * 350,
      anchorY: Math.sin(groupIndex / 12 * Math.PI * 2) * 350,
      fx: null,
      fy: null,
    };
  });
  const links = [];
  for (let index = 0; index < size; index += 1) {
    links.push({ source: index, target: (index + 1) % size, distance: 104, strength: .028 });
    if (size > 25) links.push({ source: index, target: (index + 17) % size, distance: 88, strength: .036 });
  }
  return { nodes, links, settings, alpha: 1, paused: false, frameInterval: 33 };
}
for (const [size, ticks] of [[25, 120], [500, 60], [2000, 30]]) {
  const startedAt = Date.now();
  const state = helpers.createWorkerState(fixture(size));
  for (let tick = 0; tick < ticks; tick += 1) helpers.tickWorkerSimulation(state);
  const elapsed = Date.now() - startedAt;
  if (!state.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))) {
    throw new Error(`Worker benchmark ${size} produced a non-finite position.`);
  }
  if (elapsed > 15000) throw new Error(`Worker benchmark ${size} exceeded 15 seconds: ${elapsed} ms.`);
  console.log(`Graph benchmark ${size}: ${ticks} ticks / ${elapsed} ms`);
}
'@
$graphWorkerBenchmark | & node - $graphWorkerPath
if ($LASTEXITCODE -ne 0) {
    throw "Graph worker benchmark validation failed with exit code $LASTEXITCODE."
}

$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $manifestPath | ConvertFrom-Json
$expectedDshVersion = [string]$manifest.dependencies.'@deepseek-ai/dsh'
$actualDshVersion = (& $localDshCommand --version 2>&1 | Out-String).Trim()
if ($actualDshVersion -ne $expectedDshVersion) {
    throw "DeepSeek Harness version mismatch. Expected $expectedDshVersion, found $actualDshVersion."
}

Push-Location -LiteralPath $vaultTemplateRoot
try {
    & python ".agents/scripts/knowledge_router.py" --audit
    if ($LASTEXITCODE -ne 0) {
        throw "Knowledge Vault audit failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

$portProbe = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 0)
$portProbe.Start()
try {
    $port = ([System.Net.IPEndPoint]$portProbe.LocalEndpoint).Port
}
finally {
    $portProbe.Stop()
}

$smokeRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("KnowledgeVaultHarness-release-test-" + [guid]::NewGuid().ToString("N"))
$initializedVault = Join-Path $smokeRoot "vault"
$uiInitializedVault = Join-Path $smokeRoot "ui-vault"
$nonEmptyVault = Join-Path $smokeRoot "non-empty-vault"
$runtimeRoot = Join-Path $smokeRoot "runtime"
$stdoutPath = Join-Path $smokeRoot "stdout.log"
$stderrPath = Join-Path $smokeRoot "stderr.log"
$process = $null
New-Item -ItemType Directory -Force -Path $smokeRoot | Out-Null

function Invoke-DshRpc {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][hashtable]$Payload,
        [Parameter(Mandatory = $true)][string]$RpcId
    )

    $requestBody = @{
        type = "client-request"
        rpcId = $RpcId
        method = $Method
        payload = $Payload
    } | ConvertTo-Json -Depth 8

    return Invoke-RestMethod `
        -Uri ("http://127.0.0.1:{0}/api/{1}" -f $port, $Method) `
        -Method Post `
        -ContentType "application/json" `
        -Body $requestBody `
        -TimeoutSec 5
}

function Assert-VaultDirectoryInheritance {
    param(
        [Parameter(Mandatory = $true)]
        [string]$VaultRoot,
        [Parameter(Mandatory = $true)]
        [string]$InitializerName
    )

    $protectedDirectories = @()
    foreach ($directoryName in @(
        ".agents",
        ".dsh",
        ".obsidian",
        "01_Inbox",
        "02_Domains",
        "03_Areas",
        "04_Resources",
        "05_Skills",
        "06_Archive",
        "07_Attachments"
    )) {
        $directoryPath = Join-Path $VaultRoot $directoryName
        if (-not (Test-Path -LiteralPath $directoryPath -PathType Container)) {
            throw "$InitializerName did not create required directory: $directoryPath"
        }
        if ((Get-Acl -LiteralPath $directoryPath).AreAccessRulesProtected) {
            $protectedDirectories += $directoryName
        }
    }

    if ($protectedDirectories.Count -gt 0) {
        throw "$InitializerName created directories with protected ACL inheritance: $($protectedDirectories -join ', ')"
    }
}

try {
    Write-Host "Initializing a clean Knowledge Vault..."
    & $initializer -Destination $initializedVault -DataRoot $runtimeRoot
    foreach ($requiredVaultEntry in @(
        "AGENTS.md",
        "01_Inbox",
        "07_Attachments",
        ".dsh\skills",
        ".dsh\skills\knowledge-capture\scripts\capture.py",
        ".dsh\skills\knowledge-capture\scripts\document_to_markdown.py",
        ".dsh\skills\knowledge-capture\scripts\requirements.txt",
        ".dsh\skills\knowledge-capture\references\conversion-rules.md",
        ".dsh\skills\knowledge-organize\SKILL.md",
        ".dsh\skills\knowledge-organize\scripts\organize_batch.py",
        $inboxTemplateRelativePath
    )) {
        if (-not (Test-Path -LiteralPath (Join-Path $initializedVault $requiredVaultEntry))) {
            throw "Initialized Vault is missing: $requiredVaultEntry"
        }
    }
    Assert-VaultDirectoryInheritance -VaultRoot $initializedVault -InitializerName "PowerShell initializer"
    $productConfig = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $runtimeRoot "product.json") | ConvertFrom-Json
    if (-not [string]::Equals([string]$productConfig.vaultRoot, $initializedVault, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "The one-click initializer did not persist the selected Vault path."
    }

    $captureFixturePath = Join-Path $smokeRoot "capture-fixture.csv"
    [System.IO.File]::WriteAllText(
        $captureFixturePath,
        "account,amount,description`n1000,12.50,first row`n2000,,empty amount`n",
        [System.Text.UTF8Encoding]::new($false)
    )
    $captureHashBefore = (Get-FileHash -Algorithm SHA256 -LiteralPath $captureFixturePath).Hash
    $initializedCaptureScript = Join-Path $initializedVault ".dsh\skills\knowledge-capture\scripts\capture.py"
    $captureManifestJson = & python `
        $initializedCaptureScript `
        $captureFixturePath `
        --runtime-root (Join-Path $runtimeRoot "capture-runtime") `
        --vault-root $initializedVault `
        --mode text `
        --title "Capture CSV Fixture"
    if ($LASTEXITCODE -ne 0) {
        throw "The bundled knowledge-capture converter failed with exit code $LASTEXITCODE."
    }
    $captureManifest = $captureManifestJson | ConvertFrom-Json
    $captureNote = Get-Content -Raw -Encoding UTF8 -LiteralPath ([string]$captureManifest.markdown)
    $captureHashAfter = (Get-FileHash -Algorithm SHA256 -LiteralPath $captureFixturePath).Hash
    if (
        $captureManifest.status -ne "ok" -or
        -not $captureNote.StartsWith("---`n") -or
        $captureNote -notmatch 'source_sha256:' -or
        $captureNote -notmatch 'conversion_mode: text' -or
        $captureNote -notmatch '\| 1 \| account \| amount \| description \|' -or
        $captureNote -notmatch '\| 3 \| 2000 \|  \| empty amount \|' -or
        $captureHashBefore -ne $captureHashAfter
    ) {
        throw "The bundled knowledge-capture converter did not preserve the CSV source in a streamlined Inbox note."
    }

    Write-Host "Testing multimodal knowledge capture staging and apply..."
    Add-Type -AssemblyName System.IO.Compression
    $multimodalFixturePath = Join-Path $smokeRoot "capture-multimodal.docx"
    $multimodalStream = [System.IO.File]::Open($multimodalFixturePath, [System.IO.FileMode]::CreateNew)
    $multimodalArchive = [System.IO.Compression.ZipArchive]::new(
        $multimodalStream,
        [System.IO.Compression.ZipArchiveMode]::Create,
        $false
    )
    try {
        $documentXml = @'
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><w:body><w:p><w:r><w:t>Paragraph before image.</w:t></w:r><w:r><w:drawing><a:blip r:embed="rId1"/></w:drawing></w:r></w:p></w:body></w:document>
'@
        $relationshipsXml = @'
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>
'@
        $multimodalEntries = [ordered]@{
            "word/document.xml" = [System.Text.UTF8Encoding]::new($false).GetBytes($documentXml)
            "word/_rels/document.xml.rels" = [System.Text.UTF8Encoding]::new($false).GetBytes($relationshipsXml)
            "word/media/image1.png" = [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
        }
        foreach ($entryValue in $multimodalEntries.GetEnumerator()) {
            $entry = $multimodalArchive.CreateEntry([string]$entryValue.Key)
            $entryStream = $entry.Open()
            try {
                $bytes = [byte[]]$entryValue.Value
                $entryStream.Write($bytes, 0, $bytes.Length)
            }
            finally {
                $entryStream.Dispose()
            }
        }
    }
    finally {
        $multimodalArchive.Dispose()
        $multimodalStream.Dispose()
    }
    $multimodalHashBefore = (Get-FileHash -Algorithm SHA256 -LiteralPath $multimodalFixturePath).Hash
    $inboxCountBeforeMultimodal = @(Get-ChildItem -LiteralPath (Join-Path $initializedVault "01_Inbox") -File).Count
    $multimodalPrepareJson = & python `
        $initializedCaptureScript `
        $multimodalFixturePath `
        --runtime-root (Join-Path $runtimeRoot "capture-runtime") `
        --vault-root $initializedVault `
        --mode multimodal `
        --title "Capture Multimodal Fixture"
    if ($LASTEXITCODE -ne 0) {
        throw "Knowledge capture multimodal prepare failed with exit code $LASTEXITCODE."
    }
    $multimodalPrepare = $multimodalPrepareJson | ConvertFrom-Json
    $multimodalJobRoot = Split-Path -Parent ([string]$multimodalPrepare.manifest)
    if (
        $multimodalPrepare.status -ne "needs_multimodal" -or
        $multimodalPrepare.images_to_read -ne 1 -or
        -not (Test-Path -LiteralPath ([string]$multimodalPrepare.images[0].path) -PathType Leaf) -or
        (Test-Path -LiteralPath ([string]$multimodalPrepare.results_file) -PathType Leaf) -or
        @(Get-ChildItem -LiteralPath (Join-Path $initializedVault "01_Inbox") -File).Count -ne $inboxCountBeforeMultimodal
    ) {
        throw "Knowledge capture multimodal prepare did not create an isolated pending job."
    }
    $inboxCountBeforeRejectedApply = @(Get-ChildItem -LiteralPath (Join-Path $initializedVault "01_Inbox") -File -Filter "*.md").Count
    [System.IO.File]::WriteAllText(
        [string]$multimodalPrepare.results_file,
        '{"images":[]}' + "`n",
        [System.Text.UTF8Encoding]::new($false)
    )
    $savedErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        & python `
            $initializedCaptureScript `
            --vault-root $initializedVault `
            --apply-multimodal ([string]$multimodalPrepare.manifest) `
            --results ([string]$multimodalPrepare.results_file) 2>&1 | Out-Null
        $rejectedApplyExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $savedErrorActionPreference
    }
    if (
        $rejectedApplyExitCode -eq 0 -or
        $inboxCountBeforeRejectedApply -ne @(Get-ChildItem -LiteralPath (Join-Path $initializedVault "01_Inbox") -File -Filter "*.md").Count
    ) {
        throw "Knowledge capture multimodal apply accepted incomplete image results."
    }
    $multimodalResults = [ordered]@{ images = @([ordered]@{
        id = [string]$multimodalPrepare.images[0].id
        markdown = "Visible label 42"
        confidence = "high"
        uncertainties = @()
    }) }
    [System.IO.File]::WriteAllText(
        [string]$multimodalPrepare.results_file,
        ($multimodalResults | ConvertTo-Json -Depth 6) + "`n",
        [System.Text.UTF8Encoding]::new($false)
    )
    $multimodalApplyJson = & python `
        $initializedCaptureScript `
        --runtime-root (Join-Path $runtimeRoot "capture-runtime") `
        --apply-multimodal ([string]$multimodalPrepare.manifest) `
        --results ([string]$multimodalPrepare.results_file) `
        --vault-root $initializedVault `
        --cleanup
    if ($LASTEXITCODE -ne 0) {
        throw "Knowledge capture multimodal apply failed with exit code $LASTEXITCODE."
    }
    $multimodalApply = $multimodalApplyJson | ConvertFrom-Json
    $multimodalNote = Get-Content -Raw -Encoding UTF8 -LiteralPath ([string]$multimodalApply.markdown)
    if (
        $multimodalApply.status -ne "ok" -or
        $multimodalApply.images_recognized -ne 1 -or
        $multimodalApply.temporary_files_removed -ne $true -or
        $multimodalNote -notmatch 'conversion_mode: multimodal' -or
        $multimodalNote -notmatch 'Visible label 42' -or
        $multimodalNote -match 'knowledge-capture-multimodal:' -or
        (Test-Path -LiteralPath $multimodalJobRoot) -or
        $multimodalHashBefore -ne (Get-FileHash -Algorithm SHA256 -LiteralPath $multimodalFixturePath).Hash
    ) {
        throw "Knowledge capture multimodal apply did not validate and finalize the model result."
    }
    Remove-Item -LiteralPath ([string]$multimodalApply.markdown) -Force

    Write-Host "Testing manifest-based knowledge organization..."
    $initializedOrganizeScript = Join-Path $initializedVault ".dsh\skills\knowledge-organize\scripts\organize_batch.py"
    $unrelatedReadyPath = Join-Path $initializedVault "01_Inbox\Unrelated Ready.md"
    [System.IO.File]::WriteAllText(
        $unrelatedReadyPath,
        "---`ntitle: Unrelated Ready`ntype: source`nstatus: ready`nroute_to: 03_Areas/Unrelated`nroute_confidence: 0.90`n---`n# Unrelated Ready`n",
        [System.Text.UTF8Encoding]::new($false)
    )
    $unicodeOutputFixture = (
        [string][char]0x2714 + " " +
        [string][char]0x4E2D + [string][char]0x6587 + " " +
        [char]::ConvertFromUtf32(0x1F680)
    )
    [System.IO.File]::AppendAllText(
        [string]$captureManifest.markdown,
        "`n## Unicode output`n`n$unicodeOutputFixture`n",
        [System.Text.UTF8Encoding]::new($false)
    )
    $organizePrepareOutput = @(& python `
        $initializedOrganizeScript `
        prepare `
        ([string]$captureManifest.markdown) `
        --vault-root $initializedVault `
        --mode recommend)
    if ($LASTEXITCODE -ne 0) {
        throw "Knowledge organize prepare failed with exit code $LASTEXITCODE."
    }
    $organizePrepared = $organizePrepareOutput[0] | ConvertFrom-Json
    if (
        ($organizePrepareOutput -join "`n") -notmatch 'SOURCE WITH EVIDENCE IDS' -or
        ($organizePrepareOutput -join "`n") -notmatch '<<<S\d{3}' -or
        ($organizePrepareOutput -join "`n") -notmatch 'do not create a builder'
    ) {
        throw "Knowledge organize prepare did not return its compact contract and evidence-marked source."
    }
    $organizeManifestPath = [string]$organizePrepared.manifest
    $organizeCardsPath = [string]$organizePrepared.cards_file
    if (Test-Path -LiteralPath $organizeCardsPath) {
        throw "Knowledge organize prepare created cards_file before the single model write."
    }
    $organizeManifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $organizeManifestPath | ConvertFrom-Json
    $evidenceId = [string]$organizeManifest.sections[1].id
    $organizeCards = [ordered]@{ cards = @(
        [pscustomobject]@{
            title = "Interpret Complete Rows"
            kind = "concept"
            triggers = @("complete row")
            use = @("interpret a populated cost row")
            avoid = @("the amount is missing and requires remediation")
            questions = @("How should a complete cost row be interpreted?")
            includes = @("complete-row interpretation")
            excludes = @("missing-amount remediation")
            evidence = @($evidenceId)
            route = "02_Domains/Organize Batch"
            reason = "Reusable interpretation rule"
            confidence = 0.93
            conclusion = "Interpret account, amount, and description together."
            body = "Read all populated columns from the same row. Account 1000 has amount 12.50 and description first row."
            limits = "This card does not reconstruct formulas."
            related = @("C002")
        },
        [pscustomobject]@{
            title = "Handle Missing Amounts"
            kind = "procedure"
            triggers = @("missing amount")
            use = @("review a row whose amount is empty")
            avoid = @("an amount is already present")
            questions = @("What should happen when an amount is missing?")
            includes = @("missing-amount review")
            excludes = @("populated-row interpretation")
            evidence = @($evidenceId)
            route = "02_Domains/Organize Batch"
            reason = "Reusable data-quality procedure"
            confidence = 0.91
            conclusion = "Keep the amount empty and flag it for review."
            body = "Preserve the empty value and record the limitation. Account 2000 has an empty amount."
            limits = "The source does not provide a replacement amount."
        }
    ) }
    [System.IO.File]::WriteAllText(
        $organizeCardsPath,
        ($organizeCards | ConvertTo-Json -Depth 20),
        [System.Text.UTF8Encoding]::new($false)
    )
    $validSecondKind = $organizeCards.cards[1].kind
    $validSecondConclusion = $organizeCards.cards[1].conclusion
    $validSecondAvoid = @($organizeCards.cards[1].avoid)
    $validFirstRelated = @($organizeCards.cards[0].related)
    $validFirstIncludes = @($organizeCards.cards[0].includes)
    $organizeCards.cards[1].kind = "summary"
    $organizeCards.cards[1].conclusion = $organizeCards.cards[0].conclusion
    $organizeCards.cards[1].avoid = @("Do not continue the workflow")
    $organizeCards.cards[0].related = @("C999")
    $organizeCards.cards[0].includes = @()
    [System.IO.File]::WriteAllText(
        $organizeCardsPath,
        ($organizeCards | ConvertTo-Json -Depth 20),
        [System.Text.UTF8Encoding]::new($false)
    )
    $qualityGateOutput = @(& python $initializedOrganizeScript apply $organizeManifestPath --cards $organizeCardsPath --vault-root $initializedVault 2>&1)
    if (
        $LASTEXITCODE -eq 0 -or
        ($qualityGateOutput -join "`n") -notmatch 'knowledge_kind' -or
        ($qualityGateOutput -join "`n") -notmatch 'conclusion' -or
        ($qualityGateOutput -join "`n") -notmatch 'related' -or
        ($qualityGateOutput -join "`n") -notmatch 'do_not_use_when' -or
        ($qualityGateOutput -join "`n") -notmatch 'includes'
    ) {
        throw "Knowledge organize quality gate accepted an invalid kind or duplicate conclusion."
    }
    $organizeCards.cards[1].kind = $validSecondKind
    $organizeCards.cards[1].conclusion = $validSecondConclusion
    $organizeCards.cards[1].avoid = $validSecondAvoid
    $organizeCards.cards[0].related = $validFirstRelated
    $organizeCards.cards[0].includes = $validFirstIncludes
    [System.IO.File]::WriteAllText(
        $organizeCardsPath,
        ($organizeCards | ConvertTo-Json -Depth 20),
        [System.Text.UTF8Encoding]::new($false)
    )
    $routeIndexName = (-join @([char]0x77E5, [char]0x8BC6, [char]0x8DEF, [char]0x7531, [char]0x7D22, [char]0x5F15)) + ".md"
    $domainIndexName = "_" + (-join @([char]0x4E13, [char]0x4E1A, [char]0x9886, [char]0x57DF, [char]0x7D22, [char]0x5F15)) + ".md"
    $autoRegistrationHeading = "## " + (-join @([char]0x81EA, [char]0x52A8, [char]0x767B, [char]0x8BB0, [char]0x7684, [char]0x77E5, [char]0x8BC6, [char]0x5305))
    $needsReviewPrefix = -join @([char]0x5F85, [char]0x5B8C, [char]0x5584, [char]0xFF1A)
    [System.IO.File]::AppendAllText(
        (Join-Path $initializedVault $routeIndexName),
        "`n$autoRegistrationHeading`n`n- [[02_Domains/0201_Organize Batch/_Index|Organize Batch]]$([char]0xFF1A)interpret a populated cost row`n",
        [System.Text.UTF8Encoding]::new($false)
    )
    [System.IO.File]::AppendAllText(
        (Join-Path $initializedVault (Join-Path "02_Domains" $domainIndexName)),
        "`n$autoRegistrationHeading`n`n- [[02_Domains/0201_Organize Batch/_Index|Organize Batch]]`n",
        [System.Text.UTF8Encoding]::new($false)
    )
    $organizeApplyJson = & python $initializedOrganizeScript apply $organizeManifestPath --cards $organizeCardsPath --vault-root $initializedVault
    if ($LASTEXITCODE -ne 0) {
        throw "Knowledge organize apply failed with exit code $LASTEXITCODE."
    }
    $organizeApply = $organizeApplyJson | ConvertFrom-Json
    $organizedCardPaths = @($organizeApply.cards | ForEach-Object { Join-Path $initializedVault ([string]$_).Replace("/", "\") })
    $organizedSource = Get-ChildItem -LiteralPath (Join-Path $initializedVault "06_Archive") -Recurse -File -Filter (Split-Path -Leaf ([string]$captureManifest.markdown)) | Select-Object -First 1
    $organizedIndex = Get-ChildItem -LiteralPath (Join-Path $initializedVault "02_Domains") -Recurse -File -Filter "_Index.md" |
        Where-Object { (Get-Content -Raw -Encoding UTF8 -LiteralPath $_.FullName) -match 'Interpret Complete Rows' } |
        Select-Object -First 1
    if (
        $organizeApply.status -ne "ok" -or
        $organizeApply.apply_status -ne "applied" -or
        $organizedCardPaths.Count -ne 2 -or
        @($organizedCardPaths | Where-Object { -not (Test-Path -LiteralPath $_) }).Count -gt 0 -or
        $null -eq $organizedSource -or
        $null -eq $organizedIndex -or
        -not (Test-Path -LiteralPath $unrelatedReadyPath)
    ) {
        throw "Knowledge organize batch apply did not route exactly the selected cards and archive their completed source."
    }
    $organizedSourceText = Get-Content -Raw -Encoding UTF8 -LiteralPath $organizedSource.FullName
    if ($organizedSourceText -notmatch 'Interpret Complete Rows' -or $organizedSourceText -notmatch 'Handle Missing Amounts') {
        throw "Knowledge organize did not create source backlinks for every generated card."
    }
    $organizedRootIndexText = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $initializedVault $routeIndexName)
    $organizedCategoryIndexText = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $initializedVault (Join-Path "02_Domains" $domainIndexName))
    $organizedPackageRow = "| [[02_Domains/0201_Organize Batch/_Index|Organize Batch]] | ${needsReviewPrefix}interpret a populated cost row |"
    if (
        (-not $organizedRootIndexText.Contains($organizedPackageRow)) -or
        (-not $organizedCategoryIndexText.Contains($organizedPackageRow)) -or
        $organizedRootIndexText.Contains($autoRegistrationHeading) -or
        $organizedCategoryIndexText.Contains($autoRegistrationHeading) -or
        $organizedRootIndexText.Contains("| " + (-join @([char]0x6682, [char]0x65E0)) + " | " + (-join @([char]0x9996, [char]0x6B21, [char]0x5F62, [char]0x6210, [char]0x7A33, [char]0x5B9A, [char]0x4E13, [char]0x4E1A, [char]0x4E3B, [char]0x9898))) -or
        $organizedCategoryIndexText.Contains((-join @([char]0x5F53, [char]0x524D, [char]0x4E3A, [char]0x7A7A))) -or
        $organizedRootIndexText.Contains((-join @([char]0x6B64, [char]0x6A21, [char]0x677F, [char]0x5C1A, [char]0x65E0, [char]0x7528, [char]0x6237, [char]0x77E5, [char]0x8BC6)))
    ) {
        throw "Knowledge organize did not register a review-required package in the corresponding category tables."
    }
    $firstOrganizedCard = Get-Content -Raw -Encoding UTF8 -LiteralPath $organizedCardPaths[0]
    $secondOrganizedCard = Get-Content -Raw -Encoding UTF8 -LiteralPath $organizedCardPaths[1]
    $firstCardTarget = ([string]$organizeApply.cards[0]) -replace '\.md$', ''
    $secondCardTarget = ([string]$organizeApply.cards[1]) -replace '\.md$', ''
    $sourceRelativePath = $organizedSource.FullName.Substring($initializedVault.Length).TrimStart('\').Replace('\', '/')
    $sourceTarget = $sourceRelativePath -replace '\.md$', ''
    $expectedFirstRelated = "[[$secondCardTarget|Handle Missing Amounts]]"
    $expectedSecondRelated = "[[$firstCardTarget|Interpret Complete Rows]]"
    $expectedSourceLink = "[[$sourceTarget|Capture CSV Fixture]]"
    if (
        -not $firstOrganizedCard.Contains($expectedFirstRelated) -or
        -not $secondOrganizedCard.Contains($expectedSecondRelated) -or
        -not $firstOrganizedCard.Contains($expectedSourceLink) -or
        ([regex]::Matches($firstOrganizedCard, [regex]::Escape($expectedFirstRelated))).Count -lt 2 -or
        ([regex]::Matches($firstOrganizedCard, [regex]::Escape($expectedSourceLink))).Count -lt 2 -or
        $firstOrganizedCard -notmatch 'description: >\r?\n  [^\r\n]*missing-amount remediation' -or
        $firstOrganizedCard -match 'description: >\r?\n  [^\r\n]*the amount is missing'
    ) {
        throw "Knowledge organize did not render reciprocal links or a scope-based description."
    }
    $organizeNoOpJson = & python $initializedOrganizeScript apply $organizeManifestPath --cards $organizeCardsPath --vault-root $initializedVault
    $organizeNoOp = $organizeNoOpJson | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or $organizeNoOp.status -ne "ok" -or $organizeNoOp.apply_status -ne "no-op") {
        throw "Knowledge organize is not idempotent for an already applied manifest."
    }
    $brokenFirstCard = $firstOrganizedCard.Replace($expectedFirstRelated, "[[Handle Missing Amounts]]")
    [System.IO.File]::WriteAllText($organizedCardPaths[0], $brokenFirstCard, [System.Text.UTF8Encoding]::new($false))
    $repairPreview = (& python $initializedOrganizeScript repair-links --vault-root $initializedVault) | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or [int]$repairPreview.planned -lt 1) {
        throw "Knowledge organize repair-links did not preview a resolvable legacy relationship."
    }
    $repairApply = (& python $initializedOrganizeScript repair-links --vault-root $initializedVault --apply) | ConvertFrom-Json
    $repairedFirstCard = Get-Content -Raw -Encoding UTF8 -LiteralPath $organizedCardPaths[0]
    if ($LASTEXITCODE -ne 0 -or [int]$repairApply.updated -lt 1 -or -not $repairedFirstCard.Contains($expectedFirstRelated)) {
        throw "Knowledge organize repair-links did not restore full Vault relationship paths."
    }

    $lowConfidenceSourcePath = Join-Path $initializedVault "01_Inbox\Low Confidence Source.md"
    [System.IO.File]::WriteAllText(
        $lowConfidenceSourcePath,
        "---`ntitle: Low Confidence Source`ntype: source`nstatus: inbox`n---`n`n# Uncertain rule`n`nThe source may describe a provisional rule.`n",
        [System.Text.UTF8Encoding]::new($false)
    )
    $lowPrepareOutput = @(& python $initializedOrganizeScript prepare $lowConfidenceSourcePath --vault-root $initializedVault --mode recommend)
    $lowPrepared = $lowPrepareOutput[0] | ConvertFrom-Json
    $lowManifestPath = [string]$lowPrepared.manifest
    $lowCardsPath = [string]$lowPrepared.cards_file
    if (Test-Path -LiteralPath $lowCardsPath) {
        throw "Knowledge organize prepare created a low-confidence cards_file before the single model write."
    }
    $lowManifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $lowManifestPath | ConvertFrom-Json
    $lowCards = [ordered]@{ cards = @(
        [pscustomobject]@{
            title = "Review Provisional Rule"
            kind = "concept"
            triggers = @("provisional rule")
            use = @("review a provisional rule")
            avoid = @("treat a rule as confirmed")
            questions = @("Is the provisional rule reliable?")
            includes = @("provisional-rule review")
            excludes = @("confirmed-rule application")
            evidence = @([string]$lowManifest.sections[0].id)
            route = "02_Domains/Provisional Rules"
            reason = "Potential domain rule requiring review"
            confidence = 0.70
            conclusion = "The rule requires review before use."
            body = "The source describes the rule as provisional."
            limits = "The source does not confirm the rule."
        }
    ) }
    [System.IO.File]::WriteAllText(
        $lowCardsPath,
        ($lowCards | ConvertTo-Json -Depth 20),
        [System.Text.UTF8Encoding]::new($false)
    )
    $lowApplyJson = & python $initializedOrganizeScript apply $lowManifestPath --cards $lowCardsPath --vault-root $initializedVault
    $lowApply = $lowApplyJson | ConvertFrom-Json
    $lowCardPath = Join-Path $initializedVault ([string]$lowApply.cards[0]).Replace("/", "\")
    if (
        $LASTEXITCODE -ne 0 -or
        $lowApply.status -ne "ok" -or
        -not (Test-Path -LiteralPath $lowConfidenceSourcePath) -or
        -not (Test-Path -LiteralPath $lowCardPath) -or
        -not ([string]$lowApply.cards[0]).StartsWith("01_Inbox/")
    ) {
        throw "Knowledge organize did not retain a low-confidence card and its source in Inbox."
    }
    $lowCards.expected = 2
    [System.IO.File]::WriteAllText(
        $lowCardsPath,
        ($lowCards | ConvertTo-Json -Depth 20),
        [System.Text.UTF8Encoding]::new($false)
    )
    $lowManifest.mode = "custom"
    [System.IO.File]::WriteAllText(
        $lowManifestPath,
        ($lowManifest | ConvertTo-Json -Depth 20),
        [System.Text.UTF8Encoding]::new($false)
    )
    & python $initializedOrganizeScript apply $lowManifestPath --cards $lowCardsPath --vault-root $initializedVault | Out-Null
    if ($LASTEXITCODE -eq 0) {
        throw "Knowledge organize accepted a custom plan whose expected card count did not match."
    }
    $lowCards.expected = 1
    [System.IO.File]::WriteAllText(
        $lowCardsPath,
        ($lowCards | ConvertTo-Json -Depth 20),
        [System.Text.UTF8Encoding]::new($false)
    )
    & python $initializedOrganizeScript apply $lowManifestPath --cards $lowCardsPath --vault-root $initializedVault --cleanup | Out-Null
    if ($LASTEXITCODE -ne 0 -or (Test-Path -LiteralPath $lowManifestPath) -or (Test-Path -LiteralPath $lowCardsPath)) {
        throw "Knowledge organize apply --cleanup did not remove verified temporary inputs."
    }

    $graphFixtureRoot = Join-Path $initializedVault "02_Domains\0201_GraphTest"
    New-Item -ItemType Directory -Force -Path $graphFixtureRoot | Out-Null
    [System.IO.File]::WriteAllText(
        (Join-Path $graphFixtureRoot "Graph A.md"),
        "---`ntitle: Graph A`ntype: knowledge-card`nstatus: evergreen`ntags: [graph-test]`nrelated:`n  - `"[[Graph B]]`"`n---`n# Graph A`n[[Graph B]]`n",
        [System.Text.UTF8Encoding]::new($false)
    )
    [System.IO.File]::WriteAllText(
        (Join-Path $graphFixtureRoot "Graph B.md"),
        "---`ntitle: Graph B`ntype: knowledge-card`nstatus: active`ntags:`n  - graph-test`nparent_index: `"[[Graph A]]`"`n---`n# Graph B`n",
        [System.Text.UTF8Encoding]::new($false)
    )
    [System.IO.File]::WriteAllText(
        (Join-Path $graphFixtureRoot "Stats Knowledge.md"),
        "---`ntitle: Stats Knowledge`ntype: knowledge-skill`nstatus: processed`ndescription: Statistics fixture`nuse_when: [statistics]`ndo_not_use_when: [unrelated]`nsource_notes: [`"[[Graph A]]`"]`ntags: [stats-test]`n---`n# Stats Knowledge`n",
        [System.Text.UTF8Encoding]::new($false)
    )
    [System.IO.File]::WriteAllText(
        (Join-Path $initializedVault "01_Inbox\Stats Pending.md"),
        "---`ntitle: Stats Pending`ntype: source`nstatus: needs-review`nrelated: [`"[[Missing Stats Target]]`"]`ntags: [stats-test]`n---`n# Stats Pending`n[[Missing Stats Target]]`n![[07_Attachments/reader-image.png]]`n",
        [System.Text.UTF8Encoding]::new($false)
    )
    [System.IO.File]::WriteAllBytes(
        (Join-Path $initializedVault "07_Attachments\stats-attachment.bin"),
        [byte[]](1, 2, 3, 4)
    )
    [System.IO.File]::WriteAllBytes(
        (Join-Path $initializedVault "07_Attachments\reader-image.png"),
        [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
    )

    Write-Host "Starting an isolated DeepSeek Harness release test on port $port..."
    $launcherArguments = @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", ('"' + $launcher + '"'),
        "-NoOpen",
        "-Port", [string]$port,
        "-DataRoot", ('"' + $runtimeRoot + '"'),
        "-VaultRoot", ('"' + $initializedVault + '"')
    )
    $process = Start-Process `
        -FilePath "powershell.exe" `
        -ArgumentList $launcherArguments `
        -PassThru `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath

    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    $webResponse = $null
    $workspaceResponse = $null
    $workspace = $null
    while ([DateTime]::UtcNow -lt $deadline) {
        $process.Refresh()
        if ($process.HasExited) {
            break
        }
        try {
            $webResponse = Invoke-WebRequest `
                -Uri ("http://127.0.0.1:{0}/" -f $port) `
                -UseBasicParsing `
                -TimeoutSec 2
            $workspaceResponse = Invoke-DshRpc -Method "workspace.list" -Payload @{} -RpcId "release-workspace"
            $workspace = @($workspaceResponse.result.value.items) | Where-Object {
                [string]::Equals([string]$_.path, $initializedVault, [System.StringComparison]::OrdinalIgnoreCase)
            } | Select-Object -First 1
            if ($webResponse.StatusCode -eq 200 -and $null -ne $workspace) {
                break
            }
        }
        catch {
            # The server can accept TCP before its RPC graph is ready.
        }
        Start-Sleep -Milliseconds 500
    }

    $process.Refresh()
    $stdout = if (Test-Path -LiteralPath $stdoutPath) { Get-Content -Raw -LiteralPath $stdoutPath } else { "" }
    $stderr = if (Test-Path -LiteralPath $stderrPath) { Get-Content -Raw -LiteralPath $stderrPath } else { "" }
    if ($process.HasExited -or $null -eq $webResponse -or $webResponse.StatusCode -ne 200 -or $null -eq $workspace) {
        throw "Harness release test did not become ready within $TimeoutSeconds seconds.`nSTDOUT:`n$stdout`nSTDERR:`n$stderr"
    }
    if ($webResponse.Content -notmatch '"id":"@knowledge-vault/dsh-bootstrap"') {
        throw "The Web UI boot graph does not contain the Knowledge Vault client plugin."
    }
    $clientBundleResponse = Invoke-WebRequest `
        -Uri ("http://127.0.0.1:{0}/plugins/@knowledge-vault/dsh-bootstrap/client.js" -f $port) `
        -UseBasicParsing `
        -TimeoutSec 5
    $clientBundleRequirements = @(
        'kv-explorer',
        'kv-init-launcher',
        'createBookPlusIcon',
        'kv-init-icon-svg',
        'ctx.workspaces.pickDirectory',
        'postJson\("initialize"',
        'postJson\("select"',
        'kv-hero-logo',
        'width: 258',
        'hiddenSiblings.forEach',
        '/knowledge-vault/assets/bkcs-logo.png',
        'DOCUMENT_TITLE = "Knowledge Vault"',
        '/knowledge-vault/assets/knowledge-vault-favicon.png',
        'function BrandMark\(\)',
        'width: 24',
        'document title and favicon',
        'id: "knowledge-graph"',
        'id: "knowledge-stats"',
        'id: "knowledge-reader"',
        'function MarkdownReaderView\(\)',
        'MarkdownText',
        'knowledge-vault:read-document',
        'expandMarkdownDocument',
        'function renderMarkdownSource\(',
        'function resolveVaultDocumentPath\(',
        'function normalizeObsidianDocumentLink\(',
        'function rewriteObsidianDocumentLinkLine\(',
        'function findObsidianVaultDocumentLinks\(',
        'function tokenizeFrontmatterRelatedLinks\(',
        'function FrontmatterDocumentProperties\(',
        'function VaultRelationshipSection\(',
        'function findMalformedVaultMarkdownLinks\(',
        'function upgradeMalformedVaultMarkdownLinks\(',
        'data-vault-document-path',
        'data-knowledge-vault-path',
        'source: "markdown-link"',
        '/image',
        'function KnowledgeStatsView\(\)',
        'kv-stat-cards',
        '/stats',
        'function KnowledgeGraphView\(\)',
        'function createGraphSimulation\(',
        'function tickGraphSimulation\(',
        'requestAnimationFrame',
        'mode: "node"',
        'hoveredNeighbors',
        'simulationPaused',
        'GRAPH_WORKER_THRESHOLD = 700',
        'GRAPH_DYNAMIC_NODE_LIMIT = 3000',
        'new Worker\(GRAPH_WORKER_URL',
        'kv-graph-settings',
        'knowledge-vault:graph-settings',
        '/graph-settings',
        'settingsHydrated',
        'data-ds-dark-theme',
        'themeRevision',
        'knowledge-vault:open-file',
        'name: "shell.overlay"',
        'id: "knowledge-vault-browser"',
        'id: "knowledge-vault-initializer"'
    )
    $missingClientBundleRequirements = @(
        $clientBundleRequirements | Where-Object { $clientBundleResponse.Content -notmatch $_ }
    )
    if ($clientBundleResponse.StatusCode -ne 200 -or $missingClientBundleRequirements.Count -gt 0) {
        $missingMarkers = if ($missingClientBundleRequirements.Count -gt 0) {
            $missingClientBundleRequirements -join ', '
        }
        else {
            '<none>'
        }
        throw "The Knowledge Vault interactive client bundle is not available. Missing markers: $missingMarkers"
    }

    $graphSettingsPath = Join-Path $runtimeRoot "graph-settings.json"
    $initialGraphSettings = Invoke-RestMethod `
        -Uri ("http://127.0.0.1:{0}/knowledge-vault/api/graph-settings" -f $port) `
        -Method Get `
        -TimeoutSec 5
    if ($null -ne $initialGraphSettings.settings -or (Test-Path -LiteralPath $graphSettingsPath)) {
        throw "The graph settings API did not start with an empty product-data configuration."
    }
    $requestedGraphSettings = [ordered]@{
        repulsion = 230
        linkDistance = 1.25
        clusterStrength = 70
        centerStrength = 18
        nodeScale = 1.2
        edgeWidth = 1.4
        labelLimit = 140
    }
    $savedGraphSettings = Invoke-RestMethod `
        -Uri ("http://127.0.0.1:{0}/knowledge-vault/api/graph-settings" -f $port) `
        -Method Post `
        -ContentType "application/json" `
        -Body (@{ settings = $requestedGraphSettings } | ConvertTo-Json -Depth 4) `
        -TimeoutSec 5
    $loadedGraphSettings = Invoke-RestMethod `
        -Uri ("http://127.0.0.1:{0}/knowledge-vault/api/graph-settings" -f $port) `
        -Method Get `
        -TimeoutSec 5
    $storedGraphSettings = Get-Content -Raw -Encoding UTF8 -LiteralPath $graphSettingsPath | ConvertFrom-Json
    foreach ($settingName in $requestedGraphSettings.Keys) {
        $expected = [double]$requestedGraphSettings[$settingName]
        if (
            [double]$savedGraphSettings.settings.$settingName -ne $expected -or
            [double]$loadedGraphSettings.settings.$settingName -ne $expected -or
            [double]$storedGraphSettings.settings.$settingName -ne $expected
        ) {
            throw "The graph settings API did not persist '$settingName' outside the Vault."
        }
    }
    $invalidGraphSettingsRejected = $false
    try {
        $invalidGraphSettings = [ordered]@{} + $requestedGraphSettings
        $invalidGraphSettings.repulsion = 999
        Invoke-RestMethod `
            -Uri ("http://127.0.0.1:{0}/knowledge-vault/api/graph-settings" -f $port) `
            -Method Post `
            -ContentType "application/json" `
            -Body (@{ settings = $invalidGraphSettings } | ConvertTo-Json -Depth 4) `
            -TimeoutSec 5 | Out-Null
    }
    catch {
        $invalidGraphSettingsRejected = $_.Exception.Response.StatusCode -eq [System.Net.HttpStatusCode]::BadRequest
    }
    if (-not $invalidGraphSettingsRejected) {
        throw "The graph settings API accepted a value outside the allowed range."
    }
    $brandLogoResponse = Invoke-WebRequest `
        -Uri ("http://127.0.0.1:{0}/knowledge-vault/assets/bkcs-logo.png" -f $port) `
        -UseBasicParsing `
        -TimeoutSec 5
    if (
        $brandLogoResponse.StatusCode -ne 200 -or
        [string]$brandLogoResponse.Headers["Content-Type"] -notmatch '^image/png' -or
        $brandLogoResponse.RawContentLength -ne (Get-Item -LiteralPath $brandLogoPath).Length
    ) {
        throw "The size-matched BKCS hero logo is not available from the Web UI."
    }
    $faviconResponse = Invoke-WebRequest `
        -Uri ("http://127.0.0.1:{0}/knowledge-vault/assets/knowledge-vault-favicon.png" -f $port) `
        -UseBasicParsing `
        -TimeoutSec 5
    if (
        $faviconResponse.StatusCode -ne 200 -or
        [string]$faviconResponse.Headers["Content-Type"] -notmatch '^image/png' -or
        $faviconResponse.RawContentLength -ne (Get-Item -LiteralPath $faviconPath).Length
    ) {
        throw "The Knowledge Vault favicon is not available from the Web UI."
    }
    $graphWorkerResponse = Invoke-WebRequest `
        -Uri ("http://127.0.0.1:{0}/knowledge-vault/assets/graph-worker.js" -f $port) `
        -UseBasicParsing `
        -TimeoutSec 5
    if (
        $graphWorkerResponse.StatusCode -ne 200 -or
        [string]$graphWorkerResponse.Headers["Content-Type"] -notmatch '^text/javascript' -or
        $graphWorkerResponse.Content -notmatch 'tickWorkerSimulation' -or
        $graphWorkerResponse.RawContentLength -ne (Get-Item -LiteralPath $graphWorkerPath).Length
    ) {
        throw "The Knowledge Vault graph Web Worker is not available from the Web UI."
    }

    $patchPath = Join-Path $runtimeRoot "generated\knowledge-vault.patch.yml"
    $patch = if (Test-Path -LiteralPath $patchPath) { Get-Content -Raw -LiteralPath $patchPath } else { "" }
    if ($patch -notmatch "name: '@knowledge-vault/dsh-bootstrap'") {
        throw "The generated patch does not load the Knowledge Vault product plugin."
    }

    $vaultTree = Invoke-RestMethod `
        -Uri ("http://127.0.0.1:{0}/knowledge-vault/api/list?path=" -f $port) `
        -Method Get `
        -TimeoutSec 5
    $rootEntries = @($vaultTree.entries | ForEach-Object { [string]$_.name })
    if ("01_Inbox" -notin $rootEntries -or "07_Attachments" -notin $rootEntries -or "AGENTS.md" -notin $rootEntries) {
        throw "The right-panel Vault browser API did not return the complete root structure."
    }
    $filePreview = Invoke-RestMethod `
        -Uri ("http://127.0.0.1:{0}/knowledge-vault/api/file?path=AGENTS.md" -f $port) `
        -Method Get `
        -TimeoutSec 5
    if (-not $filePreview.previewable -or [string]::IsNullOrWhiteSpace([string]$filePreview.content)) {
        throw "The right-panel Vault browser API could not preview AGENTS.md."
    }
    $vaultImageResponse = Invoke-WebRequest `
        -Uri ("http://127.0.0.1:{0}/knowledge-vault/api/image?path=07_Attachments%2Freader-image.png" -f $port) `
        -Method Get `
        -UseBasicParsing `
        -TimeoutSec 5
    if (
        $vaultImageResponse.StatusCode -ne 200 -or
        $vaultImageResponse.Headers["Content-Type"] -ne "image/png" -or
        $vaultImageResponse.Headers["Cross-Origin-Resource-Policy"] -ne "same-origin" -or
        $vaultImageResponse.RawContentLength -ne (Get-Item -LiteralPath (Join-Path $initializedVault "07_Attachments\reader-image.png")).Length
    ) {
        throw "The read-only Vault image API did not return the expected image attachment."
    }
    $nonImageRejected = $false
    try {
        Invoke-WebRequest `
            -Uri ("http://127.0.0.1:{0}/knowledge-vault/api/image?path=AGENTS.md" -f $port) `
            -Method Get `
            -UseBasicParsing `
            -TimeoutSec 5 | Out-Null
    }
    catch {
        $nonImageRejected = $_.Exception.Response.StatusCode -eq [System.Net.HttpStatusCode]::UnsupportedMediaType
    }
    if (-not $nonImageRejected) {
        throw "The Vault image API did not reject a non-image file."
    }
    $knowledgeGraph = Invoke-RestMethod `
        -Uri ("http://127.0.0.1:{0}/knowledge-vault/api/graph?refresh=1" -f $port) `
        -Method Get `
        -TimeoutSec 15
    $graphNodes = @($knowledgeGraph.nodes)
    $graphEdges = @($knowledgeGraph.edges)
    $graphA = $graphNodes | Where-Object { $_.title -eq "Graph A" } | Select-Object -First 1
    $graphB = $graphNodes | Where-Object { $_.title -eq "Graph B" } | Select-Object -First 1
    if ($null -eq $graphA -or $null -eq $graphB) {
        throw "The read-only knowledge graph API did not return the graph fixture nodes."
    }
    $fixtureEdges = @($graphEdges | Where-Object {
        $_.source -eq $graphA.path -and $_.target -eq $graphB.path -and $_.kind -in @("wikilink", "related")
    })
    if (
        $knowledgeGraph.rootName -ne "vault" -or
        $fixtureEdges.Count -lt 2 -or
        $graphA.tags -notcontains "graph-test"
    ) {
        throw "The read-only knowledge graph API did not parse nodes, metadata, and explicit Markdown relationships."
    }
    $pendingUnresolved = @($knowledgeGraph.unresolved | Where-Object {
        $_.source -eq "01_Inbox/Stats Pending.md" -and $_.target -eq "Missing Stats Target"
    })
    if (
        $pendingUnresolved.Count -ne 1 -or
        @($knowledgeGraph.unresolved | Where-Object { $_.target -like "*reader-image.png" }).Count -ne 0
    ) {
        throw "The knowledge graph did not deduplicate unresolved links or excluded an existing attachment incorrectly."
    }
    $knowledgeStats = Invoke-RestMethod `
        -Uri ("http://127.0.0.1:{0}/knowledge-vault/api/stats?refresh=1" -f $port) `
        -Method Get `
        -TimeoutSec 20
    $statsFolderKeys = @($knowledgeStats.distributions.folders | ForEach-Object { [string]$_.key })
    $statsNeedsReview = @($knowledgeStats.health | Where-Object { $_.id -eq "needs-review" }) | Select-Object -First 1
    $statsUnresolved = @($knowledgeStats.health | Where-Object { $_.id -eq "unresolved-links" }) | Select-Object -First 1
    $statsRecentPaths = @($knowledgeStats.recent | ForEach-Object { [string]$_.path })
    if (
        $knowledgeStats.rootName -ne "vault" -or
        [int]$knowledgeStats.overview.markdownNotes -lt 4 -or
        [int]$knowledgeStats.overview.knowledgeCards -lt 1 -or
        [int]$knowledgeStats.overview.inboxPending -lt 1 -or
        [int]$knowledgeStats.overview.attachmentCount -lt 1 -or
        [int]$knowledgeStats.overview.explicitRelations -ne [int]$knowledgeGraph.edgeCount -or
        "01_Inbox" -notin $statsFolderKeys -or
        "02_Domains" -notin $statsFolderKeys -or
        [int]$statsNeedsReview.count -lt 1 -or
        [int]$statsUnresolved.count -lt 1 -or
        "01_Inbox/Stats Pending.md" -notin $statsRecentPaths
    ) {
        throw "The read-only knowledge statistics API did not return the expected overview, distributions, health checks, and recent files."
    }

    Write-Host "Initializing another Vault through the in-app API..."
    New-Item -ItemType Directory -Force -Path $nonEmptyVault | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $nonEmptyVault "keep.txt"), "must not be overwritten", [System.Text.Encoding]::UTF8)
    $nonEmptyRejected = $false
    try {
        Invoke-RestMethod `
            -Uri ("http://127.0.0.1:{0}/knowledge-vault/api/initialize" -f $port) `
            -Method Post `
            -ContentType "application/json" `
            -Body (@{ destination = $nonEmptyVault } | ConvertTo-Json) `
            -TimeoutSec 5 | Out-Null
    }
    catch {
        $nonEmptyRejected = $_.Exception.Response.StatusCode -eq [System.Net.HttpStatusCode]::Conflict
    }
    if (-not $nonEmptyRejected -or -not (Test-Path -LiteralPath (Join-Path $nonEmptyVault "keep.txt") -PathType Leaf)) {
        throw "The in-app initializer did not safely reject a normal non-empty directory."
    }
    $uninitializedSelectionRejected = $false
    try {
        Invoke-RestMethod `
            -Uri ("http://127.0.0.1:{0}/knowledge-vault/api/select" -f $port) `
            -Method Post `
            -ContentType "application/json" `
            -Body (@{ destination = $nonEmptyVault } | ConvertTo-Json) `
            -TimeoutSec 5 | Out-Null
    }
    catch {
        $uninitializedSelectionRejected = $_.Exception.Response.StatusCode -eq [System.Net.HttpStatusCode]::Conflict
    }
    if (-not $uninitializedSelectionRejected) {
        throw "The in-app selector accepted a directory that is not an initialized Knowledge Vault."
    }

    $uiInitialization = Invoke-RestMethod `
        -Uri ("http://127.0.0.1:{0}/knowledge-vault/api/initialize" -f $port) `
        -Method Post `
        -ContentType "application/json" `
        -Body (@{ destination = $uiInitializedVault } | ConvertTo-Json) `
        -TimeoutSec 30
    if ($uiInitialization.alreadyInitialized) {
        throw "The in-app initializer incorrectly reported a clean target as already initialized."
    }
    foreach ($requiredVaultEntry in @(
        "AGENTS.md",
        "01_Inbox",
        "07_Attachments",
        ".dsh\skills",
        ".dsh\skills\knowledge-capture\scripts\capture.py",
        ".dsh\skills\knowledge-capture\scripts\document_to_markdown.py",
        ".dsh\skills\knowledge-capture\scripts\requirements.txt",
        ".dsh\skills\knowledge-capture\references\conversion-rules.md",
        ".dsh\skills\knowledge-organize\SKILL.md",
        ".dsh\skills\knowledge-organize\scripts\organize_batch.py"
    )) {
        if (-not (Test-Path -LiteralPath (Join-Path $uiInitializedVault $requiredVaultEntry))) {
            throw "The in-app initialized Vault is missing: $requiredVaultEntry"
        }
    }
    Assert-VaultDirectoryInheritance -VaultRoot $uiInitializedVault -InitializerName "In-app initializer"
    $uiProductConfig = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $runtimeRoot "product.json") | ConvertFrom-Json
    if (-not [string]::Equals([string]$uiProductConfig.vaultRoot, $uiInitializedVault, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "The in-app initializer did not persist the newly selected Vault path."
    }
    $uiVaultTree = Invoke-RestMethod `
        -Uri ("http://127.0.0.1:{0}/knowledge-vault/api/list?path=" -f $port) `
        -Method Get `
        -TimeoutSec 5
    if (-not [string]::Equals([string]$uiVaultTree.rootName, "ui-vault", [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "The right-panel browser did not switch to the in-app initialized Vault."
    }
    $uiKnowledgeGraph = Invoke-RestMethod `
        -Uri ("http://127.0.0.1:{0}/knowledge-vault/api/graph" -f $port) `
        -Method Get `
        -TimeoutSec 15
    if (-not [string]::Equals([string]$uiKnowledgeGraph.rootName, "ui-vault", [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "The knowledge graph cache did not switch to the in-app initialized Vault."
    }
    $uiKnowledgeStats = Invoke-RestMethod `
        -Uri ("http://127.0.0.1:{0}/knowledge-vault/api/stats" -f $port) `
        -Method Get `
        -TimeoutSec 20
    if (-not [string]::Equals([string]$uiKnowledgeStats.rootName, "ui-vault", [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "The knowledge statistics cache did not switch to the in-app initialized Vault."
    }
    $uiWorkspaceResponse = Invoke-DshRpc -Method "workspace.list" -Payload @{} -RpcId "release-ui-workspace"
    $uiWorkspace = @($uiWorkspaceResponse.result.value.items) | Where-Object {
        [string]::Equals([string]$_.path, $uiInitializedVault, [System.StringComparison]::OrdinalIgnoreCase)
    } | Select-Object -First 1
    if ($null -eq $uiWorkspace) {
        throw "The in-app initialized Vault was not registered as a Harness workspace."
    }

    Write-Host "Selecting the original Vault through the in-app API..."
    $vaultSelection = Invoke-RestMethod `
        -Uri ("http://127.0.0.1:{0}/knowledge-vault/api/select" -f $port) `
        -Method Post `
        -ContentType "application/json" `
        -Body (@{ destination = $initializedVault } | ConvertTo-Json) `
        -TimeoutSec 10
    if (-not [string]::Equals([string]$vaultSelection.vaultRoot, $initializedVault, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "The in-app selector returned the wrong Vault path."
    }
    $selectedProductConfig = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $runtimeRoot "product.json") | ConvertFrom-Json
    if (-not [string]::Equals([string]$selectedProductConfig.vaultRoot, $initializedVault, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "The in-app selector did not persist the selected Vault path."
    }
    $selectedVaultTree = Invoke-RestMethod `
        -Uri ("http://127.0.0.1:{0}/knowledge-vault/api/list?path=" -f $port) `
        -Method Get `
        -TimeoutSec 5
    if (-not [string]::Equals([string]$selectedVaultTree.rootName, "vault", [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "The right-panel browser did not switch to the selected Vault."
    }
    $selectedKnowledgeStats = Invoke-RestMethod `
        -Uri ("http://127.0.0.1:{0}/knowledge-vault/api/stats" -f $port) `
        -Method Get `
        -TimeoutSec 20
    if (-not [string]::Equals([string]$selectedKnowledgeStats.rootName, "vault", [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "The knowledge statistics cache did not switch back to the selected Vault."
    }

    $sessionResponse = Invoke-DshRpc `
        -Method "session.create" `
        -Payload @{ workspaceId = $workspace.workspaceId } `
        -RpcId "release-session"
    if (-not $sessionResponse.result.ok) {
        throw "Session creation failed: $($sessionResponse | ConvertTo-Json -Depth 10)"
    }

    $sessionId = [string]$sessionResponse.result.value.sessionId
    $skillsResponse = Invoke-DshRpc `
        -Method "skill.list" `
        -Payload @{ sessionId = $sessionId } `
        -RpcId "release-skills"
    if (-not $skillsResponse.result.ok) {
        throw "Skill discovery failed: $($skillsResponse | ConvertTo-Json -Depth 10)"
    }

    $expectedSkills = @(
        "vault-retrieve",
        "knowledge-capture",
        "knowledge-organize",
        "knowledge-link",
        "knowledge-audit"
    )
    $skillNames = @($skillsResponse.result.value.skills | ForEach-Object { [string]$_.name })
    $missingSkills = @($expectedSkills | Where-Object { $_ -notin $skillNames })
    if ($missingSkills.Count -gt 0) {
        throw "Bundled skills are missing: $($missingSkills -join ', '). Found: $($skillNames -join ', ')"
    }

    Write-Host "Release validation passed."
    Write-Host "  DeepSeek Harness : $actualDshVersion"
    Write-Host "  One-click init   : $initializedVault"
    Write-Host "  In-app init      : $uiInitializedVault"
    Write-Host "  In-app select    : $initializedVault"
    Write-Host "  Web UI           : HTTP $($webResponse.StatusCode)"
    Write-Host "  Workspace        : $($workspace.title)"
    Write-Host "  Vault browser    : $($rootEntries.Count) root entries"
    Write-Host "  Knowledge graph  : $($knowledgeGraph.nodeCount) nodes / $($knowledgeGraph.edgeCount) explicit edges"
    Write-Host "  Knowledge stats  : $($knowledgeStats.overview.markdownNotes) notes / $($knowledgeStats.overview.inboxPending) Inbox pending"
    Write-Host "  Graph layout     : settings + Web Worker + 25/500/2000 benchmark"
    Write-Host "  BKCS hero logo   : 258 x 82 CSS pixels"
    Write-Host "  Product branding : Knowledge Vault + Z favicon/sidebar mark"
    Write-Host "  Bundled skills   : $($expectedSkills.Count)"
}
finally {
    $listenerMatches = netstat.exe -ano -p tcp | Select-String (":{0}\s+.*LISTENING\s+(\d+)$" -f $port)
    $listenerPids = @($listenerMatches | ForEach-Object {
        if ($_.Line -match "LISTENING\s+(\d+)$") {
            [int]$Matches[1]
        }
    } | Sort-Object -Unique)
    foreach ($listenerPid in $listenerPids) {
        Stop-Process -Id $listenerPid -Force -ErrorAction SilentlyContinue
    }

    if ($null -ne $process) {
        Start-Sleep -Milliseconds 500
        $process.Refresh()
        if (-not $process.HasExited) {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    }

    $resolvedSmoke = [System.IO.Path]::GetFullPath($smokeRoot)
    $tempPrefix = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (
        $resolvedSmoke.StartsWith($tempPrefix, [System.StringComparison]::OrdinalIgnoreCase) -and
        (Split-Path -Leaf $resolvedSmoke).StartsWith("KnowledgeVaultHarness-release-test-")
    ) {
        Start-Sleep -Milliseconds 500
        Remove-Item -LiteralPath $resolvedSmoke -Recurse -Force -ErrorAction SilentlyContinue
    }
}
