[CmdletBinding()]
param(
    [string]$OutputDirectory = "dist",
    [switch]$SkipValidation,
    [switch]$SkipDependencyInstall
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
# Honor enterprise/user certificate stores for Node-based package and builder downloads.
# This is process-local and does not disable TLS or integrity verification.
$env:NODE_USE_SYSTEM_CA = "1"

$productRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$desktopRoot = Join-Path $productRoot "desktop"
$manifestPath = Join-Path $productRoot "package.json"
$desktopManifestPath = Join-Path $desktopRoot "package.json"
$testScript = Join-Path $productRoot "Test-KnowledgeBase.ps1"
$nodeSource = (Get-Command node -ErrorAction Stop).Source
$nodeSourceRoot = Split-Path -Parent $nodeSource
$nodeLicenseSource = Join-Path $nodeSourceRoot "LICENSE"

foreach ($required in @(
    $manifestPath,
    $desktopManifestPath,
    $testScript,
    (Join-Path $desktopRoot "main.cjs"),
    (Join-Path $desktopRoot "loading.html"),
    (Join-Path $desktopRoot "builder-config.cjs"),
    (Join-Path $productRoot "pnpm-lock.yaml"),
    $nodeSource,
    $nodeLicenseSource
)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
        throw "Missing desktop build input: $required"
    }
}

$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $manifestPath | ConvertFrom-Json
$desktopManifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $desktopManifestPath | ConvertFrom-Json
$version = [string]$manifest.version
if (-not [string]::Equals($version, [string]$desktopManifest.version, [System.StringComparison]::Ordinal)) {
    throw "Desktop package version $($desktopManifest.version) does not match product version $version."
}

$nodeVersion = (& $nodeSource --version 2>&1 | Out-String).Trim()
if ($nodeVersion -notmatch '^v(22|2[4-9]|[3-9]\d)\.') {
    throw "Desktop runtime requires Node.js 22.19+ or 24+; found $nodeVersion."
}
if ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture -ne [System.Runtime.InteropServices.Architecture]::X64) {
    throw "This build script currently produces Windows x64 packages only."
}

if (-not $SkipValidation) {
    Write-Host "Running the release validation gate..."
    & $testScript
}

if (-not $SkipDependencyInstall) {
    Write-Host "Installing locked desktop build dependencies..."
    Push-Location -LiteralPath $productRoot
    try {
        $previousCi = [Environment]::GetEnvironmentVariable("CI", "Process")
        try {
            $env:CI = "true"
            & corepack pnpm install --frozen-lockfile
            if ($LASTEXITCODE -ne 0) {
                throw "Desktop dependency installation failed with exit code $LASTEXITCODE."
            }
        }
        finally {
            if ($null -eq $previousCi) { Remove-Item Env:CI -ErrorAction SilentlyContinue }
            else { $env:CI = $previousCi }
        }
    }
    finally {
        Pop-Location
    }
}

$electronBuilderPackage = Join-Path $desktopRoot "node_modules\electron-builder\package.json"
$electronBuilderCli = Join-Path $desktopRoot "node_modules\electron-builder\cli.js"
$electronPackage = Join-Path $desktopRoot "node_modules\electron\package.json"
$electronRuntime = Join-Path $desktopRoot "node_modules\electron\dist\electron.exe"
foreach ($requiredPackage in @($electronBuilderPackage, $electronBuilderCli, $electronPackage, $electronRuntime)) {
    if (-not (Test-Path -LiteralPath $requiredPackage -PathType Leaf)) {
        throw "Desktop build dependency is missing: $requiredPackage"
    }
}

$resolvedOutput = if ([System.IO.Path]::IsPathRooted($OutputDirectory)) {
    [System.IO.Path]::GetFullPath($OutputDirectory)
}
else {
    [System.IO.Path]::GetFullPath((Join-Path $productRoot $OutputDirectory))
}
New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null

$stagingRoot = Join-Path $resolvedOutput (".desktop-staging-" + [guid]::NewGuid().ToString("N"))
$deployRoot = Join-Path $stagingRoot "product"
$nodeRuntimeRoot = Join-Path $stagingRoot "node-runtime"
$builderOutput = Join-Path $stagingRoot "builder-output"
$portableContainer = Join-Path $resolvedOutput (".portable-staging-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
$portableRoot = Join-Path $portableContainer "Knowledge-Vault-Harness-Portable"
$installerName = "Knowledge-Vault-Setup-$version-win-x64.exe"
$portableName = "Knowledge-Vault-Harness-Portable-$version-win-x64.zip"
$installerPath = Join-Path $resolvedOutput $installerName
$portablePath = Join-Path $resolvedOutput $portableName
$installerChecksumPath = $installerPath + ".sha256"
$portableChecksumPath = $portablePath + ".sha256"

$forbiddenSourceNames = @(".env", "credentials.json", "credentials.yaml", "credentials.yml", "settings.yaml")
$excludedDirectoryNames = @(".git", "node_modules", ".pnpm-store", "dist", ".venv")
$sourceFiles = New-Object System.Collections.Generic.List[System.IO.FileInfo]
$pendingDirectories = New-Object System.Collections.Generic.Stack[System.IO.DirectoryInfo]
$pendingDirectories.Push((Get-Item -LiteralPath $productRoot -Force))
while ($pendingDirectories.Count -gt 0) {
    $currentDirectory = $pendingDirectories.Pop()
    foreach ($file in Get-ChildItem -LiteralPath $currentDirectory.FullName -Force -File) {
        $relative = $file.FullName.Substring($productRoot.Length).TrimStart('\', '/')
        if ($relative -match '(^|[\\/])\.obsidian[\\/]workspace(?:-mobile)?\.json$') { continue }
        $sourceFiles.Add($file)
    }
    foreach ($directory in Get-ChildItem -LiteralPath $currentDirectory.FullName -Force -Directory) {
        if ($directory.Name -in $excludedDirectoryNames) { continue }
        $relative = $directory.FullName.Substring($productRoot.Length).TrimStart('\', '/')
        if ($relative -match '(^|[\\/])\.agents[\\/]tmp$') { continue }
        if ($relative -match '(^|[\\/])\.obsidian[\\/]cache$') { continue }
        $pendingDirectories.Push($directory)
    }
}
$sensitiveSources = @($sourceFiles | Where-Object { $_.Name.ToLowerInvariant() -in $forbiddenSourceNames })
if ($sensitiveSources.Count -gt 0) {
    throw "Refusing to package possible credentials or user settings:`n$($sensitiveSources.FullName -join [Environment]::NewLine)"
}

function Write-ChecksumFile {
    param([Parameter(Mandatory)][string]$Path)
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash
    $line = "$hash *$([System.IO.Path]::GetFileName($Path))$([Environment]::NewLine)"
    [System.IO.File]::WriteAllText($Path + ".sha256", $line, (New-Object System.Text.UTF8Encoding($false)))
    return $hash
}

$buildSucceeded = $false
try {
    New-Item -ItemType Directory -Force -Path $stagingRoot, $nodeRuntimeRoot, $builderOutput | Out-Null

    Write-Host "Creating a standalone production Harness runtime..."
    Push-Location -LiteralPath $productRoot
    try {
        # Use independent copies so staging cleanup never mutates or depends on
        # pnpm's shared content-addressable hard links.
        & corepack pnpm --config.package-import-method=copy --config.node-linker=hoisted --filter knowledge-vault-harness deploy --prod --legacy $deployRoot
        if ($LASTEXITCODE -ne 0) {
            throw "pnpm deploy failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }

    $runtimeRequired = @(
        (Join-Path $deployRoot "node_modules\@deepseek-ai\dsh\package.json"),
        (Join-Path $deployRoot "node_modules\@deepseek-ai\dsh\lib\bin.js"),
        (Join-Path $deployRoot "node_modules\@knowledge-vault\dsh-bootstrap\package.json"),
        (Join-Path $deployRoot "vault-template\AGENTS.md"),
        (Join-Path $deployRoot "vault-template\.dsh\skills\knowledge-capture\scripts\capture.py"),
        (Join-Path $deployRoot "vault-template\.dsh\skills\knowledge-capture\scripts\requirements.txt"),
        (Join-Path $deployRoot ".dsh\plugins\knowledge-vault-bootstrap\client.js"),
        (Join-Path $deployRoot "README.md")
    )
    foreach ($required in $runtimeRequired) {
        if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
            throw "Standalone runtime is missing: $required"
        }
    }
    foreach ($forbiddenDirectory in @(".git", ".pnpm-store", "dist", ".venv")) {
        if (Test-Path -LiteralPath (Join-Path $deployRoot $forbiddenDirectory)) {
            throw "Standalone runtime contains forbidden directory: $forbiddenDirectory"
        }
    }

    Copy-Item -LiteralPath $nodeSource -Destination (Join-Path $nodeRuntimeRoot "node.exe")
    Copy-Item -LiteralPath $nodeLicenseSource -Destination (Join-Path $nodeRuntimeRoot "NODE-LICENSE.txt")
    [System.IO.File]::WriteAllText(
        (Join-Path $nodeRuntimeRoot "NODE-VERSION.txt"),
        "$nodeVersion$([Environment]::NewLine)",
        (New-Object System.Text.UTF8Encoding($false))
    )

    Write-Host "Validating the bundled Node and DeepSeek Harness CLI..."
    & (Join-Path $nodeRuntimeRoot "node.exe") (Join-Path $deployRoot "node_modules\@deepseek-ai\dsh\lib\bin.js") --help | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Bundled DeepSeek Harness CLI validation failed with exit code $LASTEXITCODE."
    }

    Write-Host "Building the Windows desktop installer..."
    $previousProductRoot = [Environment]::GetEnvironmentVariable("KV_DESKTOP_PRODUCT_ROOT", "Process")
    $previousNodeRoot = [Environment]::GetEnvironmentVariable("KV_DESKTOP_NODE_ROOT", "Process")
    $previousBuilderOutput = [Environment]::GetEnvironmentVariable("KV_DESKTOP_OUTPUT", "Process")
    try {
        $env:KV_DESKTOP_PRODUCT_ROOT = $deployRoot
        $env:KV_DESKTOP_NODE_ROOT = $nodeRuntimeRoot
        $env:KV_DESKTOP_OUTPUT = $builderOutput
        Push-Location -LiteralPath $desktopRoot
        try {
            # Invoke the pinned CLI directly. `pnpm exec` may trigger an implicit
            # production reinstall in non-interactive workspace builds.
            & $nodeSource $electronBuilderCli --config builder-config.cjs --win nsis --x64
            if ($LASTEXITCODE -ne 0) {
                throw "electron-builder failed with exit code $LASTEXITCODE."
            }
        }
        finally {
            Pop-Location
        }
    }
    finally {
        foreach ($entry in @(
            @{ Name = "KV_DESKTOP_PRODUCT_ROOT"; Value = $previousProductRoot },
            @{ Name = "KV_DESKTOP_NODE_ROOT"; Value = $previousNodeRoot },
            @{ Name = "KV_DESKTOP_OUTPUT"; Value = $previousBuilderOutput }
        )) {
            if ($null -eq $entry.Value) { Remove-Item ("Env:" + $entry.Name) -ErrorAction SilentlyContinue }
            else { [Environment]::SetEnvironmentVariable($entry.Name, [string]$entry.Value, "Process") }
        }
    }

    $builtInstaller = Join-Path $builderOutput $installerName
    $unpackedRoot = Join-Path $builderOutput "win-unpacked"
    if (-not (Test-Path -LiteralPath $builtInstaller -PathType Leaf)) {
        throw "Desktop installer was not produced: $builtInstaller"
    }
    if (-not (Test-Path -LiteralPath (Join-Path $unpackedRoot "Knowledge Vault.exe") -PathType Leaf)) {
        throw "Unpacked desktop application was not produced: $unpackedRoot"
    }

    Write-Host "Running the packaged desktop smoke test..."
    $smokeDataRoot = Join-Path $stagingRoot "smoke-data"
    $smokeReadyFile = Join-Path $stagingRoot "smoke-ready.json"
    $smokeStdout = Join-Path $stagingRoot "smoke-stdout.log"
    $smokeStderr = Join-Path $stagingRoot "smoke-stderr.log"
    $smokeDeletedVault = Join-Path $stagingRoot "deleted-vault"
    $expectedFallbackVault = Join-Path $unpackedRoot "resources\product\vault-template"
    $previousSmokeDataRoot = [Environment]::GetEnvironmentVariable("KV_DESKTOP_DATA_ROOT", "Process")
    $previousSmokeReadyFile = [Environment]::GetEnvironmentVariable("KV_DESKTOP_READY_FILE", "Process")
    $previousElectronRunAsNode = [Environment]::GetEnvironmentVariable("ELECTRON_RUN_AS_NODE", "Process")
    $previousElectronLogging = [Environment]::GetEnvironmentVariable("ELECTRON_ENABLE_LOGGING", "Process")
    try {
        New-Item -ItemType Directory -Force -Path $smokeDataRoot | Out-Null
        [System.IO.File]::WriteAllText(
            (Join-Path $smokeDataRoot "product.json"),
            (@{ vaultRoot = $smokeDeletedVault } | ConvertTo-Json) + [Environment]::NewLine,
            (New-Object System.Text.UTF8Encoding($false))
        )
        $env:KV_DESKTOP_DATA_ROOT = $smokeDataRoot
        $env:KV_DESKTOP_READY_FILE = $smokeReadyFile
        $env:ELECTRON_ENABLE_LOGGING = "1"
        Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
        $smokeProcess = Start-Process `
            -FilePath (Join-Path $unpackedRoot "Knowledge Vault.exe") `
            -ArgumentList "--smoke-test" `
            -PassThru `
            -WindowStyle Hidden `
            -RedirectStandardOutput $smokeStdout `
            -RedirectStandardError $smokeStderr
        if (-not $smokeProcess.WaitForExit(90000)) {
            & taskkill.exe /pid $smokeProcess.Id /t /f | Out-Null
            throw "Packaged desktop smoke test timed out."
        }
        $smokeProcess.WaitForExit()
        $smokeProcess.Refresh()
        if (-not (Test-Path -LiteralPath $smokeReadyFile -PathType Leaf)) {
            throw "Packaged desktop smoke test did not create its readiness result."
        }
        $smokeResult = Get-Content -Raw -Encoding UTF8 -LiteralPath $smokeReadyFile | ConvertFrom-Json
        $reportedExitCode = $smokeProcess.ExitCode
        $exitCodeFailed = $null -ne $reportedExitCode -and [int]$reportedExitCode -ne 0
        if ($exitCodeFailed -or -not $smokeResult.ready -or [string]::IsNullOrWhiteSpace([string]$smokeResult.vaultRoot)) {
            $smokeLog = Join-Path $smokeDataRoot "logs\desktop.log"
            $logText = if (Test-Path -LiteralPath $smokeLog) { Get-Content -Raw -LiteralPath $smokeLog } else { "" }
            $stdoutText = if (Test-Path -LiteralPath $smokeStdout) { Get-Content -Raw -LiteralPath $smokeStdout } else { "" }
            $stderrText = if (Test-Path -LiteralPath $smokeStderr) { Get-Content -Raw -LiteralPath $smokeStderr } else { "" }
            $exitCodeText = if ($null -eq $reportedExitCode) { "unavailable" } else { [string]$reportedExitCode }
            throw "Packaged desktop smoke test failed with exit code $exitCodeText.`nResult:`n$($smokeResult | ConvertTo-Json -Depth 5)`nDesktop log:`n$logText`nstdout:`n$stdoutText`nstderr:`n$stderrText"
        }
        if (-not [string]::Equals([string]$smokeResult.vaultRoot, $expectedFallbackVault, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Packaged desktop did not fall back to its bundled template after the selected Vault disappeared."
        }
        if (
            -not [string]::Equals([string]$smokeResult.recovery.reason, "missing-vault", [System.StringComparison]::Ordinal) -or
            -not [string]::Equals([string]$smokeResult.recovery.requested, $smokeDeletedVault, [System.StringComparison]::OrdinalIgnoreCase)
        ) {
            throw "Packaged desktop did not report the deleted Vault recovery result."
        }
    }
    finally {
        if ($null -eq $previousSmokeDataRoot) { Remove-Item Env:KV_DESKTOP_DATA_ROOT -ErrorAction SilentlyContinue }
        else { $env:KV_DESKTOP_DATA_ROOT = $previousSmokeDataRoot }
        if ($null -eq $previousSmokeReadyFile) { Remove-Item Env:KV_DESKTOP_READY_FILE -ErrorAction SilentlyContinue }
        else { $env:KV_DESKTOP_READY_FILE = $previousSmokeReadyFile }
        if ($null -eq $previousElectronRunAsNode) { Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue }
        else { $env:ELECTRON_RUN_AS_NODE = $previousElectronRunAsNode }
        if ($null -eq $previousElectronLogging) { Remove-Item Env:ELECTRON_ENABLE_LOGGING -ErrorAction SilentlyContinue }
        else { $env:ELECTRON_ENABLE_LOGGING = $previousElectronLogging }
    }

    New-Item -ItemType Directory -Force -Path $portableContainer | Out-Null
    # Keep peak disk use low: the unpacked app has already passed its smoke
    # test, so move it into the portable archive root instead of duplicating it.
    Move-Item -LiteralPath $unpackedRoot -Destination $portableRoot
    $portableInstructions = @"
Knowledge Vault Portable $version (Windows x64)

1. Extract the entire folder to a writable location.
2. Run "Knowledge Vault.exe". No external browser is required.
3. Python 3.10+ is still required for knowledge routing and audit scripts.
4. User settings and sessions are stored in %LOCALAPPDATA%\KnowledgeVaultHarness.
5. Your selected Vault remains outside this application folder.

The executable is not code-signed. Windows SmartScreen may show a warning.
"@
    [System.IO.File]::WriteAllText(
        (Join-Path $portableRoot "PORTABLE.txt"),
        $portableInstructions,
        (New-Object System.Text.UTF8Encoding($false))
    )

    foreach ($outputPath in @($installerPath, $portablePath, $installerChecksumPath, $portableChecksumPath)) {
        if (Test-Path -LiteralPath $outputPath) { Remove-Item -LiteralPath $outputPath -Force }
    }
    Move-Item -LiteralPath $builtInstaller -Destination $installerPath
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $builderCacheRoot = if ([string]::IsNullOrWhiteSpace($env:ELECTRON_BUILDER_CACHE)) {
        Join-Path $env:LOCALAPPDATA "electron-builder\Cache"
    }
    else {
        $env:ELECTRON_BUILDER_CACHE
    }
    $sevenZip = Get-ChildItem -LiteralPath $builderCacheRoot -Recurse -Filter "7za.exe" -File -ErrorAction Stop |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1 -ExpandProperty FullName
    if ([string]::IsNullOrWhiteSpace($sevenZip)) {
        throw "electron-builder 7za.exe was not found under: $builderCacheRoot"
    }
    Push-Location -LiteralPath $portableContainer
    try {
        & $sevenZip a -tzip -mx=9 $portablePath ".\Knowledge-Vault-Harness-Portable"
        if ($LASTEXITCODE -ne 0) {
            throw "Portable archive creation failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }

    $portableArchive = [System.IO.Compression.ZipFile]::OpenRead($portablePath)
    try {
        $entryNames = @($portableArchive.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
        $requiredEntries = @(
            "Knowledge-Vault-Harness-Portable/Knowledge Vault.exe",
            "Knowledge-Vault-Harness-Portable/resources/app.asar",
            "Knowledge-Vault-Harness-Portable/resources/runtime/node.exe",
            "Knowledge-Vault-Harness-Portable/resources/product/vault-template/AGENTS.md",
            "Knowledge-Vault-Harness-Portable/resources/product/vault-template/.dsh/skills/knowledge-capture/scripts/capture.py",
            "Knowledge-Vault-Harness-Portable/resources/product/vault-template/.dsh/skills/knowledge-capture/scripts/requirements.txt",
            "Knowledge-Vault-Harness-Portable/resources/product/node_modules/@deepseek-ai/dsh/package.json",
            "Knowledge-Vault-Harness-Portable/PORTABLE.txt"
        )
        foreach ($requiredEntry in $requiredEntries) {
            if ($requiredEntry -notin $entryNames) {
                throw "Portable archive is missing: $requiredEntry"
            }
        }
        $forbiddenEntries = @($entryNames | Where-Object {
            $_ -match '^Knowledge-Vault-Harness-Portable/resources/product/(\.git|\.pnpm-store|dist|\.venv)(/|$)' -or
            $_ -match '(^|/)\.obsidian/(workspace(?:-mobile)?\.json|cache/)'
        })
        if ($forbiddenEntries.Count -gt 0) {
            throw "Portable archive contains forbidden entries:`n$($forbiddenEntries -join [Environment]::NewLine)"
        }
    }
    finally {
        $portableArchive.Dispose()
    }

    $installerHeader = New-Object byte[] 2
    $installerStream = [System.IO.File]::OpenRead($installerPath)
    try {
        if ($installerStream.Read($installerHeader, 0, 2) -ne 2) {
            throw "Installer is too small to be a valid Windows executable."
        }
    }
    finally {
        $installerStream.Dispose()
    }
    if ($installerHeader[0] -ne 0x4D -or $installerHeader[1] -ne 0x5A) {
        throw "Installer is not a valid Windows PE executable."
    }
    $installerHash = Write-ChecksumFile -Path $installerPath
    $portableHash = Write-ChecksumFile -Path $portablePath
    $signature = Get-AuthenticodeSignature -LiteralPath $installerPath

    Write-Host "Desktop packages are ready."
    Write-Host "  Installer : $installerPath"
    Write-Host "  SHA-256   : $installerHash"
    Write-Host "  Portable  : $portablePath"
    Write-Host "  SHA-256   : $portableHash"
    Write-Host "  Signature : $($signature.Status)"
    Write-Host "  Node      : $nodeVersion (bundled x64 runtime)"
    $buildSucceeded = $true
}
finally {
    $resolvedStaging = [System.IO.Path]::GetFullPath($stagingRoot)
    $outputPrefix = $resolvedOutput.TrimEnd('\') + '\'
    if ($buildSucceeded -and $resolvedStaging.StartsWith($outputPrefix, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedStaging)) {
        try {
            # The long-path prefix avoids Windows PowerShell 5.1 failures on
            # deeply nested dependency names.
            [System.IO.Directory]::Delete("\\?\$resolvedStaging", $true)
        }
        catch {
            Write-Warning "Unable to remove desktop staging directory: $resolvedStaging ($($_.Exception.Message))"
        }
    }
    elseif (-not $buildSucceeded -and (Test-Path -LiteralPath $resolvedStaging)) {
        Write-Warning "Desktop build failed; preserving diagnostics in: $resolvedStaging"
    }
    if ($buildSucceeded -and (Test-Path -LiteralPath $portableContainer)) {
        try {
            [System.IO.Directory]::Delete("\\?\$portableContainer", $true)
        }
        catch {
            Write-Warning "Unable to remove portable staging directory: $portableContainer ($($_.Exception.Message))"
        }
    }
}
