# CS2 Asset Extraction

This project starts with a development-only extraction workflow. The goal is to pull radar images, overview coordinate files, and grenade icons from a local Counter-Strike 2 installation, then commit or package the normalized output when building a release.

## Current Approach

Use Source 2 Viewer CLI to read the user's local CS2 VPK files. The script exports only the folders we need:

- `panorama/images/overheadmaps`
- `resource/overviews`
- `panorama/images/icons/equipment`

The temporary output lives in:

```text
public/cs2-assets/
```

Angular can serve this folder directly during development and production builds.

## Prerequisites

Download Source 2 Viewer and locate `Source2Viewer-CLI.exe`.

The script auto-detects CS2 through Steam library folders. You can also pass the CS2 path manually.

## Usage

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\extract-cs2-assets.ps1 `
  -Source2ViewerCli "C:\Tools\Source2Viewer\Source2Viewer-CLI.exe" `
  -Clean
```

If auto-detection fails:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\extract-cs2-assets.ps1 `
  -Source2ViewerCli "C:\Tools\Source2Viewer\Source2Viewer-CLI.exe" `
  -Cs2Path "C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive" `
  -Clean
```

You can also run it through npm:

```powershell
npm run extract:cs2-assets -- -Source2ViewerCli "C:\Tools\Source2Viewer\Source2Viewer-CLI.exe" -Clean
```

## Release Strategy

For the first releases, keep extraction as a maintainer/dev step:

1. Update CS2 in Steam.
2. Run the extraction script.
3. Normalize files into stable app paths.
4. Build the GitHub release.

Later, we can add an in-app import button that runs the same workflow from Tauri, but it is not required for the MVP.

## Normalized Target Shape

```text
public/cs2-assets/
  maps/
    de_mirage/
      radar.png
      overview.json
    de_nuke/
      radar.png
      radar-lower.png
      overview.json
  grenades/
    flashbang.svg
    smokegrenade.svg
    hegrenade.svg
    molotov.svg
    incgrenade.svg
    decoy.svg
```

The current script creates `_raw` output first. A follow-up normalization step should reshape it into the structure above.
