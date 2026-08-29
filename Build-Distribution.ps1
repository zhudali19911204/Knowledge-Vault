[CmdletBinding()]
param(
    [string]$OutputDirectory = "dist",
    [switch]$SkipValidation
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$productRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifestPath = Join-Path $productRoot "package.json"
$lockPath = Join-Path $productRoot "pnpm-lock.yaml"
$testScript = Join-Path $productRoot "Test-KnowledgeBase.ps1"

if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "Missing package.json."
}
if (-not (Test-Path -LiteralPath $lockPath)) {
    throw "Missing pnpm-lock.yaml. Run the runtime install first."
}
if (-not (Test-Path -LiteralPath $testScript)) {
    throw "Missing Test-KnowledgeBase.ps1."
}

if (-not $SkipValidation) {
    Write-Host "Running the release validation gate..."
    & $testScript
}

$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $manifestPath | ConvertFrom-Json
$version = [string]$manifest.version
$resolvedOutput = if ([System.IO.Path]::IsPathRooted($OutputDirectory)) {
    [System.IO.Path]::GetFullPath($OutputDirectory)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $productRoot $OutputDirectory))
}

New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null
$stagingContainer = Join-Path $resolvedOutput (".staging-" + [guid]::NewGuid().ToString("N"))
$bundleRoot = Join-Path $stagingContainer "Knowledge-Vault-Harness"
$zipPath = Join-Path $resolvedOutput "Knowledge-Vault-Harness-$version.zip"
$checksumPath = $zipPath + ".sha256"

$excludedTopLevel = @(".git", "node_modules", ".pnpm-store", "dist", ".venv")
$forbiddenNames = @(".env", "credentials.json", "credentials.yaml", "credentials.yml", "settings.yaml")

try {
    New-Item -ItemType Directory -Force -Path $bundleRoot | Out-Null

    $files = Get-ChildItem -LiteralPath $productRoot -Recurse -Force -File | Where-Object {
        $candidatePath = [System.IO.Path]::GetFullPath($_.FullName)
        $outputPrefix = $resolvedOutput.TrimEnd('\') + '\'
        if ($candidatePath.StartsWith($outputPrefix, [System.StringComparison]::OrdinalIgnoreCase)) { return $false }
        $relative = $_.FullName.Substring($productRoot.Length).TrimStart('\', '/')
        $parts = $relative -split '[\\/]'
        if ($parts[0] -in $excludedTopLevel) { return $false }
        if ($relative -match '(^|[\\/])\.obsidian[\\/]workspace(?:-mobile)?\.json$') { return $false }
        if ($relative -match '(^|[\\/])\.obsidian[\\/]cache[\\/]') { return $false }
        if ($relative -match '(^|[\\/])__pycache__([\\/]|$)' -or $_.Extension -eq '.pyc') { return $false }
        return $true
    }

    $sensitive = @($files | Where-Object { $_.Name.ToLowerInvariant() -in $forbiddenNames })
    if ($sensitive.Count -gt 0) {
        $shown = $sensitive.FullName -join [Environment]::NewLine
        throw "Refusing to package possible credentials or user settings:`n$shown"
    }

    foreach ($file in $files) {
        $relative = $file.FullName.Substring($productRoot.Length).TrimStart('\', '/')
        $destination = Join-Path $bundleRoot $relative
        $destinationDirectory = Split-Path -Parent $destination
        New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
        Copy-Item -LiteralPath $file.FullName -Destination $destination
    }

    if (Test-Path -LiteralPath $zipPath) {
        Remove-Item -LiteralPath $zipPath -Force
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory(
        $stagingContainer,
        $zipPath,
        [System.IO.Compression.CompressionLevel]::Optimal,
        $false
    )

    $archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
        $entryNames = @($archive.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
        $requiredEntries = @(
            "Knowledge-Vault-Harness/Install-KnowledgeBase.cmd",
            "Knowledge-Vault-Harness/Initialize-KnowledgeBase.cmd",
            "Knowledge-Vault-Harness/Initialize-KnowledgeBase.ps1",
            "Knowledge-Vault-Harness/Start-KnowledgeBase.cmd",
            "Knowledge-Vault-Harness/Test-KnowledgeBase.cmd",
            "Knowledge-Vault-Harness/package.json",
            "Knowledge-Vault-Harness/pnpm-lock.yaml",
            "Knowledge-Vault-Harness/pnpm-workspace.yaml",
            "Knowledge-Vault-Harness/AGENTS.md",
            "Knowledge-Vault-Harness/vault-template/AGENTS.md",
            "Knowledge-Vault-Harness/vault-template/01_Inbox/_Inbox 使用说明.md",
            "Knowledge-Vault-Harness/vault-template/.agents/scripts/knowledge_router.py",
            "Knowledge-Vault-Harness/vault-template/.dsh/skills/vault-retrieve/SKILL.md",
            "Knowledge-Vault-Harness/.dsh/plugins/knowledge-vault-bootstrap/index.js",
            "Knowledge-Vault-Harness/.dsh/plugins/knowledge-vault-bootstrap/client.js",
            "Knowledge-Vault-Harness/.dsh/plugins/knowledge-vault-bootstrap/graph-worker.js",
            "Knowledge-Vault-Harness/.dsh/plugins/knowledge-vault-bootstrap/assets/bkcs-logo.png",
            "Knowledge-Vault-Harness/.dsh/plugins/knowledge-vault-bootstrap/assets/knowledge-vault-favicon.png"
        )
        foreach ($requiredEntry in $requiredEntries) {
            if ($requiredEntry -notin $entryNames) {
                throw "Distribution archive is missing: $requiredEntry"
            }
        }

        $forbiddenEntries = @($entryNames | Where-Object {
            $_ -match '(^|/)(node_modules|\.git|dist|\.pnpm-store|\.venv)(/|$)' -or
            $_ -match '(^|/)\.obsidian/(workspace(?:-mobile)?\.json|cache/)'
        })
        if ($forbiddenEntries.Count -gt 0) {
            throw "Distribution archive contains forbidden entries:`n$($forbiddenEntries -join [Environment]::NewLine)"
        }
    }
    finally {
        $archive.Dispose()
    }

    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $zipPath).Hash
    $checksum = "$hash *$([System.IO.Path]::GetFileName($zipPath))$([Environment]::NewLine)"
    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($checksumPath, $checksum, $utf8WithoutBom)
    Write-Host "Distribution: $zipPath"
    Write-Host "SHA-256: $hash"
    Write-Host "Checksum file: $checksumPath"
}
finally {
    $resolvedStaging = [System.IO.Path]::GetFullPath($stagingContainer)
    $resolvedOutputPrefix = [System.IO.Path]::GetFullPath($resolvedOutput).TrimEnd('\') + '\'
    if ($resolvedStaging.StartsWith($resolvedOutputPrefix, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedStaging)) {
        Remove-Item -LiteralPath $resolvedStaging -Recurse -Force
    }
}
