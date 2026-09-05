[CmdletBinding()]
param(
    [string]$Destination,
    [string]$DataRoot
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$productRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$templateRoot = [System.IO.Path]::GetFullPath((Join-Path $productRoot "vault-template"))
if (-not (Test-Path -LiteralPath $templateRoot -PathType Container)) {
    throw "Knowledge Vault template directory is missing: $templateRoot"
}

if ([string]::IsNullOrWhiteSpace($DataRoot)) {
    $localAppData = [Environment]::GetFolderPath("LocalApplicationData")
    if ([string]::IsNullOrWhiteSpace($localAppData)) {
        throw "Unable to resolve the per-user LocalApplicationData directory."
    }
    $DataRoot = Join-Path $localAppData "KnowledgeVaultHarness"
}
$DataRoot = [System.IO.Path]::GetFullPath($DataRoot)

if ([string]::IsNullOrWhiteSpace($Destination)) {
    Add-Type -AssemblyName System.Windows.Forms
    $picker = New-Object System.Windows.Forms.FolderBrowserDialog
    $picker.Description = "Choose an empty folder for your Knowledge Vault"
    $picker.ShowNewFolderButton = $true
    if ($picker.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
        Write-Host "Knowledge Vault initialization cancelled."
        exit 0
    }
    $Destination = $picker.SelectedPath
}

$vaultRoot = [System.IO.Path]::GetFullPath($Destination)
$directorySeparator = [System.IO.Path]::DirectorySeparatorChar
$productPrefix = $productRoot.TrimEnd($directorySeparator) + $directorySeparator
if (
    $vaultRoot.Equals($productRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
    $vaultRoot.StartsWith($productPrefix, [System.StringComparison]::OrdinalIgnoreCase)
) {
    throw "Choose a Knowledge Vault location outside the application directory."
}
$vaultPrefix = $vaultRoot.TrimEnd($directorySeparator) + $directorySeparator
if (
    $DataRoot.Equals($vaultRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
    $DataRoot.StartsWith($vaultPrefix, [System.StringComparison]::OrdinalIgnoreCase)
) {
    throw "DataRoot must be outside the Knowledge Vault."
}

New-Item -ItemType Directory -Force -Path $vaultRoot | Out-Null
$alreadyInitialized =
    (Test-Path -LiteralPath (Join-Path $vaultRoot "AGENTS.md") -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $vaultRoot "01_Inbox") -PathType Container)

$existingEntries = @(Get-ChildItem -LiteralPath $vaultRoot -Force)
if (-not $alreadyInitialized -and $existingEntries.Count -gt 0) {
    throw "The selected folder is not empty. Select an empty folder or an existing initialized Knowledge Vault."
}

if (-not $alreadyInitialized) {
    $directoryNames = @(
        "01_Inbox",
        "02_Domains",
        "03_Areas",
        "04_Resources",
        "05_Skills",
        "06_Archive",
        "07_Attachments",
        ".agents",
        ".obsidian",
        ".dsh"
    )
    foreach ($directoryName in $directoryNames) {
        $source = Join-Path $templateRoot $directoryName
        if (-not (Test-Path -LiteralPath $source -PathType Container)) {
            throw "Knowledge Vault template directory is missing: $source"
        }
        $destinationDirectory = Join-Path $vaultRoot $directoryName
        New-Item -ItemType Directory -Path $destinationDirectory | Out-Null
        foreach ($sourceEntry in @(Get-ChildItem -LiteralPath $source -Force)) {
            if ($directoryName -eq ".agents" -and $sourceEntry.Name -eq "tmp") { continue }
            Copy-Item -LiteralPath $sourceEntry.FullName -Destination $destinationDirectory -Recurse -Force
        }
    }

    $knowledgeHomeName = -join @([char]0x77E5, [char]0x8BC6, [char]0x5E93, [char]0x9996, [char]0x9875) + ".md"
    $routeIndexName = -join @([char]0x77E5, [char]0x8BC6, [char]0x8DEF, [char]0x7531, [char]0x7D22, [char]0x5F15) + ".md"
    $fileNames = @(
        "AGENTS.md",
        $knowledgeHomeName,
        $routeIndexName,
        "LICENSE"
    )
    foreach ($fileName in $fileNames) {
        $source = Join-Path $templateRoot $fileName
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
            throw "Knowledge Vault template file is missing: $source"
        }
        Copy-Item -LiteralPath $source -Destination (Join-Path $vaultRoot $fileName)
    }
}

New-Item -ItemType Directory -Force -Path $DataRoot | Out-Null
$productConfigPath = Join-Path $DataRoot "product.json"
$config = [ordered]@{
    vaultRoot = $vaultRoot
    initializedAt = [DateTimeOffset]::Now.ToString("o")
}
$json = $config | ConvertTo-Json
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($productConfigPath, $json + [Environment]::NewLine, $utf8WithoutBom)

Write-Host "Knowledge Vault is ready."
Write-Host "  Vault: $vaultRoot"
Write-Host "  Start: $(Join-Path $productRoot 'Start-KnowledgeBase.cmd')"
