[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$productRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$vaultTemplateRoot = Join-Path $productRoot "vault-template"
$manifestPath = Join-Path $productRoot "package.json"
$lockPath = Join-Path $productRoot "pnpm-lock.yaml"

foreach ($commandName in @("node", "corepack", "python")) {
    if (-not (Get-Command $commandName -ErrorAction SilentlyContinue)) {
        throw "Missing command '$commandName'. Install Node.js and Python 3.10+ first."
    }
}

$nodeVersionText = (& node --version 2>&1 | Out-String).Trim()
if ($nodeVersionText -notmatch '^v(\d+)\.(\d+)') {
    throw "Unable to identify the Node.js version: $nodeVersionText"
}
$nodeMajor = [int]$Matches[1]
$nodeMinor = [int]$Matches[2]
if (($nodeMajor -eq 22 -and $nodeMinor -lt 19) -or $nodeMajor -lt 22 -or $nodeMajor -eq 23) {
    throw "Found Node.js $nodeVersionText; use Node.js 22.19+ or 24+."
}

$pythonVersionText = (& python --version 2>&1 | Out-String).Trim()
if ($pythonVersionText -notmatch '^Python\s+(\d+)\.(\d+)') {
    throw "Unable to identify the Python version: $pythonVersionText"
}
if ([int]$Matches[1] -lt 3 -or ([int]$Matches[1] -eq 3 -and [int]$Matches[2] -lt 10)) {
    throw "Found $pythonVersionText; Python 3.10 or later is required."
}

if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "Missing package.json at $manifestPath"
}
if (-not (Test-Path -LiteralPath $lockPath)) {
    throw "Missing pnpm-lock.yaml at $lockPath"
}

Push-Location -LiteralPath $productRoot
try {
    Write-Host "Installing the pinned DeepSeek Harness runtime..."
    $arguments = @("pnpm", "install", "--frozen-lockfile")
    if ($Force) {
        $arguments += "--force"
    }
    $previousCi = [Environment]::GetEnvironmentVariable("CI", "Process")
    try {
        # pnpm may need to recreate node_modules after an interrupted install.
        # CI mode makes that deterministic when this script is launched without a TTY.
        $env:CI = "true"
        & corepack @arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Runtime installation failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        if ($null -eq $previousCi) {
            Remove-Item Env:CI -ErrorAction SilentlyContinue
        }
        else {
            $env:CI = $previousCi
        }
    }

    if (-not (Test-Path -LiteralPath $vaultTemplateRoot -PathType Container)) {
        throw "Missing Vault template: $vaultTemplateRoot"
    }
    Push-Location -LiteralPath $vaultTemplateRoot
    try {
        & python ".agents/scripts/knowledge_router.py" --audit
        $routerExitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
    if ($routerExitCode -ne 0) {
        throw "Knowledge Vault audit failed with exit code $routerExitCode."
    }

    Write-Host "Installation complete. Run Initialize-KnowledgeBase.cmd, then Start-KnowledgeBase.cmd."
}
finally {
    Pop-Location
}
