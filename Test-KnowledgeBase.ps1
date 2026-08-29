[CmdletBinding()]
param(
    [ValidateRange(15, 300)]
    [int]$TimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$productRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$vaultTemplateRoot = Join-Path $productRoot "vault-template"
$localDshCommand = Join-Path $productRoot "node_modules\.bin\dsh.cmd"
$launcher = Join-Path $productRoot "Start-DeepSeekHarness.ps1"
$initializer = Join-Path $productRoot "Initialize-KnowledgeBase.ps1"
$pluginPath = Join-Path $productRoot ".dsh\plugins\knowledge-vault-bootstrap\index.js"
$clientPluginPath = Join-Path $productRoot ".dsh\plugins\knowledge-vault-bootstrap\client.js"
$brandLogoPath = Join-Path $productRoot ".dsh\plugins\knowledge-vault-bootstrap\assets\bkcs-logo.png"
$faviconPath = Join-Path $productRoot ".dsh\plugins\knowledge-vault-bootstrap\assets\knowledge-vault-favicon.png"
$manifestPath = Join-Path $productRoot "package.json"

foreach ($path in @(
    $localDshCommand,
    $launcher,
    $initializer,
    $pluginPath,
    $clientPluginPath,
    $brandLogoPath,
    $faviconPath,
    $manifestPath,
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
    "Build-Distribution.ps1"
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
    };
${marker}`);
let plugin;
const React = { createElement() {} };
const sandbox = {
  window: {
    __ModuleLoader__: {
      load(definition) {
        plugin = definition.factory((name) => name === "react" ? React : {});
      },
    },
  },
};
vm.runInNewContext(source, sandbox, { filename: clientPath });
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
console.log("Dynamic graph simulation smoke passed.");
'@
$graphSimulationSmoke | & node - $clientPluginPath
if ($LASTEXITCODE -ne 0) {
    throw "Dynamic graph simulation validation failed with exit code $LASTEXITCODE."
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

try {
    Write-Host "Initializing a clean Knowledge Vault..."
    & $initializer -Destination $initializedVault -DataRoot $runtimeRoot
    foreach ($requiredVaultEntry in @("AGENTS.md", "01_Inbox", "07_Attachments", ".dsh\skills")) {
        if (-not (Test-Path -LiteralPath (Join-Path $initializedVault $requiredVaultEntry))) {
            throw "Initialized Vault is missing: $requiredVaultEntry"
        }
    }
    $productConfig = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $runtimeRoot "product.json") | ConvertFrom-Json
    if (-not [string]::Equals([string]$productConfig.vaultRoot, $initializedVault, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "The one-click initializer did not persist the selected Vault path."
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
    if (
        $clientBundleResponse.StatusCode -ne 200 -or
        $clientBundleResponse.Content -notmatch 'kv-explorer' -or
        $clientBundleResponse.Content -notmatch 'kv-init-launcher' -or
        $clientBundleResponse.Content -notmatch 'ctx.workspaces.pickDirectory' -or
        $clientBundleResponse.Content -notmatch 'postJson\("initialize"' -or
        $clientBundleResponse.Content -notmatch 'postJson\("select"' -or
        $clientBundleResponse.Content -notmatch 'kv-hero-logo' -or
        $clientBundleResponse.Content -notmatch 'width: 258' -or
        $clientBundleResponse.Content -notmatch 'hiddenSiblings.forEach' -or
        $clientBundleResponse.Content -notmatch '/knowledge-vault/assets/bkcs-logo.png' -or
        $clientBundleResponse.Content -notmatch 'DOCUMENT_TITLE = "Knowledge Vault"' -or
        $clientBundleResponse.Content -notmatch '/knowledge-vault/assets/knowledge-vault-favicon.png' -or
        $clientBundleResponse.Content -notmatch 'function BrandMark\(\)' -or
        $clientBundleResponse.Content -notmatch 'width: 24' -or
        $clientBundleResponse.Content -notmatch 'document title and favicon' -or
        $clientBundleResponse.Content -notmatch 'id: "knowledge-graph"' -or
        $clientBundleResponse.Content -notmatch 'function KnowledgeGraphView\(\)' -or
        $clientBundleResponse.Content -notmatch 'function createGraphSimulation\(' -or
        $clientBundleResponse.Content -notmatch 'function tickGraphSimulation\(' -or
        $clientBundleResponse.Content -notmatch 'requestAnimationFrame' -or
        $clientBundleResponse.Content -notmatch 'mode: "node"' -or
        $clientBundleResponse.Content -notmatch 'hoveredNeighbors' -or
        $clientBundleResponse.Content -notmatch 'simulationPaused' -or
        $clientBundleResponse.Content -notmatch 'knowledge-vault:open-file' -or
        $clientBundleResponse.Content -notmatch 'name: "shell.overlay"' -or
        $clientBundleResponse.Content -notmatch 'id: "knowledge-vault-browser"' -or
        $clientBundleResponse.Content -notmatch 'id: "knowledge-vault-initializer"'
    ) {
        throw "The Knowledge Vault interactive client bundle is not available."
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
    foreach ($requiredVaultEntry in @("AGENTS.md", "01_Inbox", "07_Attachments", ".dsh\skills")) {
        if (-not (Test-Path -LiteralPath (Join-Path $uiInitializedVault $requiredVaultEntry))) {
            throw "The in-app initialized Vault is missing: $requiredVaultEntry"
        }
    }
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
