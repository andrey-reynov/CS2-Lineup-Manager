param(
    [string]$Source2ViewerCli,
    [string]$Cs2Path,
    [string]$OutputDir = "public/cs2-assets",
    [switch]$Clean
)

$ErrorActionPreference = "Stop"

function Resolve-RepoPath {
    param([string]$Path)

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return $Path
    }

    return Join-Path (Get-Location) $Path
}

function Read-SteamLibraryPaths {
    $libraryFiles = @(
        "C:\Program Files (x86)\Steam\steamapps\libraryfolders.vdf",
        "C:\Program Files\Steam\steamapps\libraryfolders.vdf"
    ) | Where-Object { Test-Path $_ }

    $paths = New-Object System.Collections.Generic.List[string]

    foreach ($libraryFile in $libraryFiles) {
        $content = Get-Content $libraryFile
        foreach ($line in $content) {
            if ($line -match '"path"\s+"([^"]+)"') {
                $paths.Add($matches[1].Replace("\\", "\"))
            }
        }
    }

    return $paths | Select-Object -Unique
}

function Find-Cs2Path {
    $candidateRoots = New-Object System.Collections.Generic.List[string]

    if ($Cs2Path) {
        $candidateRoots.Add($Cs2Path)
    }

    foreach ($libraryPath in Read-SteamLibraryPaths) {
        $candidateRoots.Add((Join-Path $libraryPath "steamapps\common\Counter-Strike Global Offensive"))
    }

    foreach ($root in ($candidateRoots | Select-Object -Unique)) {
        $pakPath = Join-Path $root "game\csgo\pak01_dir.vpk"
        if (Test-Path $pakPath) {
            return @{
                Root = (Resolve-Path $root).Path
                Pak = (Resolve-Path $pakPath).Path
            }
        }
    }

    throw "CS2 was not found. Pass -Cs2Path ""C:\...\Counter-Strike Global Offensive""."
}

function Find-Source2ViewerCli {
    if ($Source2ViewerCli) {
        if (Test-Path $Source2ViewerCli) {
            return (Resolve-Path $Source2ViewerCli).Path
        }

        throw "Source2Viewer CLI was not found at: $Source2ViewerCli"
    }

    $candidatePaths = @(
        ".tools\Source2Viewer\Source2Viewer-CLI.exe",
        ".tools\source2viewer\Source2Viewer-CLI.exe",
        ".tools\ValveResourceFormat\Source2Viewer-CLI.exe",
        "tools\Source2Viewer\Source2Viewer-CLI.exe"
    )

    foreach ($candidate in $candidatePaths) {
        $resolved = Resolve-RepoPath $candidate
        if (Test-Path $resolved) {
            return (Resolve-Path $resolved).Path
        }
    }

    $fromPath = Get-Command "Source2Viewer-CLI.exe" -ErrorAction SilentlyContinue
    if ($fromPath) {
        return $fromPath.Source
    }

    throw "Source2Viewer-CLI.exe was not found. Download Source 2 Viewer and pass -Source2ViewerCli ""C:\...\Source2Viewer-CLI.exe""."
}

function Invoke-Source2Viewer {
    param(
        [string]$Cli,
        [string]$Pak,
        [string]$Destination,
        [string]$Extensions,
        [string]$FilePath
    )

    $args = @(
        "-i", $Pak,
        "-o", $Destination,
        "-d",
        "--vpk_extensions", $Extensions,
        "--vpk_filepath", $FilePath,
        "--threads", "4"
    )

    Write-Host "Running Source2Viewer-CLI for $FilePath"
    & $Cli @args

    if ($LASTEXITCODE -ne 0) {
        throw "Source2Viewer-CLI failed with exit code $LASTEXITCODE."
    }
}

$cs2 = Find-Cs2Path
$cli = Find-Source2ViewerCli
$output = Resolve-RepoPath $OutputDir
$rawOutput = Join-Path $output "_raw"

if ($Clean -and (Test-Path $output)) {
    Remove-Item -LiteralPath $output -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $rawOutput | Out-Null

Invoke-Source2Viewer `
    -Cli $cli `
    -Pak $cs2.Pak `
    -Destination $rawOutput `
    -Extensions "vtex_c,txt" `
    -FilePath "panorama/images/overheadmaps,resource/overviews"

Invoke-Source2Viewer `
    -Cli $cli `
    -Pak $cs2.Pak `
    -Destination $rawOutput `
    -Extensions "vsvg_c,svg,vtex_c" `
    -FilePath "panorama/images/icons/equipment"

$manifest = [ordered]@{
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    cs2Path = $cs2.Root
    pakPath = $cs2.Pak
    source2ViewerCli = $cli
    exportedFolders = @(
        "panorama/images/overheadmaps",
        "resource/overviews",
        "panorama/images/icons/equipment"
    )
    nextNormalizationTargets = @(
        "Copy radar PNG files from _raw/panorama/images/overheadmaps into maps/<map>/",
        "Parse overview TXT files from _raw/resource/overviews into maps/<map>/overview.json",
        "Copy grenade icons from _raw/panorama/images/icons/equipment into grenades/"
    )
}

$manifestPath = Join-Path $output "asset-manifest.json"
$manifest | ConvertTo-Json -Depth 4 | Set-Content -Path $manifestPath -Encoding UTF8

Write-Host ""
Write-Host "CS2 assets exported."
Write-Host "Output: $output"
Write-Host "Manifest: $manifestPath"
