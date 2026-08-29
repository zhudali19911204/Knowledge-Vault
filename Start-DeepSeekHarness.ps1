[CmdletBinding()]
param(
    [switch]$NoOpen,
    [ValidateRange(1, 65535)]
    [int]$Port = 3080,
    [string]$DataRoot,
    [string]$VaultRoot
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$productRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$vaultTemplateRoot = [System.IO.Path]::GetFullPath((Join-Path $productRoot "vault-template"))
$installScript = Join-Path $productRoot "Install-KnowledgeBase.ps1"
$localDshCommand = Join-Path $productRoot "node_modules\.bin\dsh.cmd"
$localPluginPackage = Join-Path $productRoot "node_modules\@knowledge-vault\dsh-bootstrap\package.json"
$patchTemplatePath = Join-Path $productRoot ".dsh\cordis.patch.template.yml"
$bootstrapPluginRoot = Join-Path $productRoot ".dsh\plugins\knowledge-vault-bootstrap"
$bootstrapPluginPath = Join-Path $bootstrapPluginRoot "index.js"

if ([string]::IsNullOrWhiteSpace($DataRoot)) {
    $localAppData = [Environment]::GetFolderPath("LocalApplicationData")
    if ([string]::IsNullOrWhiteSpace($localAppData)) {
        throw "Unable to resolve the per-user LocalApplicationData directory."
    }
    $DataRoot = Join-Path $localAppData "KnowledgeVaultHarness"
}
$DataRoot = [System.IO.Path]::GetFullPath($DataRoot)

if ([string]::IsNullOrWhiteSpace($VaultRoot)) {
    $productConfigPath = Join-Path $DataRoot "product.json"
    if (Test-Path -LiteralPath $productConfigPath) {
        try {
            $productConfig = Get-Content -Raw -Encoding UTF8 -LiteralPath $productConfigPath | ConvertFrom-Json
            $VaultRoot = [string]$productConfig.vaultRoot
        }
        catch {
            throw "The saved Knowledge Vault configuration is invalid: $productConfigPath"
        }
    }
    if ([string]::IsNullOrWhiteSpace($VaultRoot)) {
        $VaultRoot = $vaultTemplateRoot
    }
    elseif ([string]::Equals(
        [System.IO.Path]::GetFullPath($VaultRoot),
        $productRoot,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        # Migrate the pre-1.2 development fallback, where the app root was also the Vault.
        $VaultRoot = $vaultTemplateRoot
    }
}
$vaultRoot = [System.IO.Path]::GetFullPath($VaultRoot)

if (-not (Test-Path -LiteralPath $vaultRoot -PathType Container)) {
    throw "The configured Knowledge Vault does not exist: $vaultRoot"
}
foreach ($requiredVaultEntry in @("AGENTS.md", "01_Inbox")) {
    if (-not (Test-Path -LiteralPath (Join-Path $vaultRoot $requiredVaultEntry))) {
        throw "The configured directory is not an initialized Knowledge Vault: $vaultRoot"
    }
}

foreach ($commandName in @("node", "corepack", "python")) {
    if (-not (Get-Command $commandName -ErrorAction SilentlyContinue)) {
        throw "Missing command '$commandName'. Node.js and Python 3.10+ are required."
    }
}

if (-not (Test-Path -LiteralPath $localDshCommand) -or -not (Test-Path -LiteralPath $localPluginPackage)) {
    if (-not (Test-Path -LiteralPath $installScript)) {
        throw "The local Harness runtime is missing and no installer was found."
    }
    Write-Host "Local Harness runtime is not installed. Running the installer..."
    & $installScript
}

if (-not (Test-Path -LiteralPath $localDshCommand)) {
    throw "The local DeepSeek Harness command is still missing after installation."
}
if (-not (Test-Path -LiteralPath $localPluginPackage)) {
    throw "The Knowledge Vault UI plugin is still missing after installation."
}
if (-not (Test-Path -LiteralPath $patchTemplatePath)) {
    throw "Missing patch template: $patchTemplatePath"
}
if (-not (Test-Path -LiteralPath $bootstrapPluginPath)) {
    throw "Missing workspace bootstrap plugin: $bootstrapPluginPath"
}

$pythonVersionText = (& python --version 2>&1 | Out-String).Trim()
if ($pythonVersionText -notmatch '^Python\s+(\d+)\.(\d+)') {
    throw "Unable to identify the Python version: $pythonVersionText"
}
if ([int]$Matches[1] -lt 3 -or ([int]$Matches[1] -eq 3 -and [int]$Matches[2] -lt 10)) {
    throw "Found $pythonVersionText; Python 3.10 or later is required."
}

Push-Location -LiteralPath $vaultRoot
try {
    Write-Host "Knowledge Vault: $vaultRoot"
    Write-Host "Only this Vault will be registered automatically."
    Write-Host "Configure the model API key in Settings; never save it in the Vault."

    $directorySeparator = [System.IO.Path]::DirectorySeparatorChar
    $vaultPrefix = [System.IO.Path]::GetFullPath($vaultRoot).TrimEnd($directorySeparator) + $directorySeparator
    if (
        $DataRoot.Equals([System.IO.Path]::GetFullPath($vaultRoot), [System.StringComparison]::OrdinalIgnoreCase) -or
        $DataRoot.StartsWith($vaultPrefix, [System.StringComparison]::OrdinalIgnoreCase)
    ) {
        throw "DataRoot must be outside the Vault so credentials and sessions cannot enter the distributable package."
    }
    $dshDataRoot = Join-Path $DataRoot "dsh"
    $generatedConfigRoot = Join-Path $DataRoot "generated"
    $generatedPatchPath = Join-Path $generatedConfigRoot "knowledge-vault.patch.yml"
    New-Item -ItemType Directory -Force -Path $dshDataRoot, $generatedConfigRoot | Out-Null

    # Loader and client-module resolution are anchored at the selected DSH profile.
    # Keep a small runtime copy there so the product plugin resolves by package name.
    $runtimePluginRoot = Join-Path $dshDataRoot "profiles\web\node_modules\@knowledge-vault\dsh-bootstrap"
    New-Item -ItemType Directory -Force -Path $runtimePluginRoot | Out-Null
    foreach ($pluginFileName in @("package.json", "index.js", "client.js")) {
        $pluginSource = Join-Path $bootstrapPluginRoot $pluginFileName
        if (-not (Test-Path -LiteralPath $pluginSource -PathType Leaf)) {
            throw "Missing Knowledge Vault plugin file: $pluginSource"
        }
        Copy-Item -LiteralPath $pluginSource -Destination (Join-Path $runtimePluginRoot $pluginFileName) -Force
    }
    $runtimeAssetsRoot = Join-Path $runtimePluginRoot "assets"
    New-Item -ItemType Directory -Force -Path $runtimeAssetsRoot | Out-Null
    foreach ($assetName in @("bkcs-logo.png", "knowledge-vault-favicon.png")) {
        $assetSource = Join-Path $bootstrapPluginRoot ("assets\" + $assetName)
        if (-not (Test-Path -LiteralPath $assetSource -PathType Leaf)) {
            throw "Missing Knowledge Vault brand asset: $assetSource"
        }
        Copy-Item -LiteralPath $assetSource -Destination (Join-Path $runtimeAssetsRoot $assetName) -Force
    }

    $template = Get-Content -Raw -Encoding UTF8 -LiteralPath $patchTemplatePath
    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($generatedPatchPath, $template, $utf8WithoutBom)

    $previousDshHome = [Environment]::GetEnvironmentVariable("DSH_HOME", "Process")
    $previousVaultRoot = [Environment]::GetEnvironmentVariable("KNOWLEDGE_VAULT_ROOT", "Process")
    $previousVaultTitle = [Environment]::GetEnvironmentVariable("KNOWLEDGE_VAULT_TITLE", "Process")
    $previousVaultTemplateRoot = [Environment]::GetEnvironmentVariable("KNOWLEDGE_VAULT_TEMPLATE_ROOT", "Process")
    $previousVaultProductRoot = [Environment]::GetEnvironmentVariable("KNOWLEDGE_VAULT_PRODUCT_ROOT", "Process")
    $previousVaultProductConfig = [Environment]::GetEnvironmentVariable("KNOWLEDGE_VAULT_PRODUCT_CONFIG", "Process")
    $previousNodeUseSystemCa = [Environment]::GetEnvironmentVariable("NODE_USE_SYSTEM_CA", "Process")
    try {
        $env:DSH_HOME = $dshDataRoot
        $env:KNOWLEDGE_VAULT_ROOT = $vaultRoot
        $env:KNOWLEDGE_VAULT_TITLE = if ($vaultRoot.Equals($vaultTemplateRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            Split-Path -Leaf $productRoot
        }
        else {
            Split-Path -Leaf $vaultRoot
        }
        $env:KNOWLEDGE_VAULT_TEMPLATE_ROOT = $vaultTemplateRoot
        $env:KNOWLEDGE_VAULT_PRODUCT_ROOT = $productRoot
        $env:KNOWLEDGE_VAULT_PRODUCT_CONFIG = Join-Path $DataRoot "product.json"
        $env:NODE_USE_SYSTEM_CA = "1"

        $arguments = @("--patch", $generatedPatchPath, "--profile", "web", "--host", "127.0.0.1", "--port", [string]$Port)
        if ($NoOpen) {
            $arguments += "--no-open"
        }

        & $localDshCommand @arguments
        if ($LASTEXITCODE -ne 0) {
            throw "DeepSeek Harness failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        foreach ($entry in @(
            @{ Name = "DSH_HOME"; Value = $previousDshHome },
            @{ Name = "KNOWLEDGE_VAULT_ROOT"; Value = $previousVaultRoot },
            @{ Name = "KNOWLEDGE_VAULT_TITLE"; Value = $previousVaultTitle },
            @{ Name = "KNOWLEDGE_VAULT_TEMPLATE_ROOT"; Value = $previousVaultTemplateRoot },
            @{ Name = "KNOWLEDGE_VAULT_PRODUCT_ROOT"; Value = $previousVaultProductRoot },
            @{ Name = "KNOWLEDGE_VAULT_PRODUCT_CONFIG"; Value = $previousVaultProductConfig },
            @{ Name = "NODE_USE_SYSTEM_CA"; Value = $previousNodeUseSystemCa }
        )) {
            if ($null -eq $entry.Value) {
                Remove-Item ("Env:" + $entry.Name) -ErrorAction SilentlyContinue
            }
            else {
                [Environment]::SetEnvironmentVariable($entry.Name, [string]$entry.Value, "Process")
            }
        }
    }
}
finally {
    Pop-Location
}
