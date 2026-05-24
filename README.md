# CS2 Nades

CS2 Nades is a local-first application for Counter-Strike 2 lineups. The goal is to let a player create or import map packs, add grenade types, save lineup positions, and quickly reference them while playing.

## Product Idea

The first version is an offline desktop app. A user should be able to:

- Add custom CS2 maps.
- Store grenade types, such as smokes, flashes, molotovs, HE grenades, and decoys.
- Create lineups with position, aim point, result point, throw type, notes, images, and videos.
- Import and export lineup packs.
- Use the same core app later as a web application.

## Chosen Stack

For the MVP we use:

- **Angular** for the user interface.
- **Tauri** for desktop builds on Windows and macOS.
- **SQLite** for local offline storage.
- **JSON/ZIP packs** for import and export.

This keeps the application local-first and portable while preserving a path to a future web version.

## Why This Stack

Angular is the main application layer and can run as a browser app, a Tauri desktop app, and later a mobile app with Capacitor or Tauri Mobile.

Tauri is preferred over Electron for the MVP because it usually produces smaller desktop applications and gives us native filesystem/database access without bundling a full Chromium runtime.

SQLite is preferred over MySQL for the offline desktop version because it does not require a separate database server. MySQL or PostgreSQL can still be used later for cloud sync, public packs, accounts, and shared community content.

## Planned Architecture

```text
Angular UI
  -> application services
  -> repository interfaces
  -> local Tauri/SQLite implementation
```

The Angular app should not depend directly on Tauri or SQLite. Instead, it should call repository interfaces so the storage layer can be replaced later.

Future web version:

```text
Angular UI
  -> application services
  -> repository interfaces
  -> HTTP API
  -> server database
```

## Suggested Project Layout

```text
src/
  app/
    core/
      models/
      services/
      repositories/
    features/
      maps/
      grenade-types/
      lineups/
      import-export/
    shared/
      ui/
      utils/

src-tauri/
  Tauri desktop shell
  SQLite commands
  filesystem commands
```

## Core Domain Models

```text
Map
  id
  name
  imagePath
  createdAt
  updatedAt

GrenadeType
  id
  name
  color
  icon

Lineup
  id
  mapId
  grenadeTypeId
  title
  side
  playerPosition
  aimPoint
  resultPoint
  throwTechnique
  movement
  description
  tags
  media
  createdAt
  updatedAt
```

## Import / Export Format

Lineup packs should be portable files, for example:

```text
my-mirage-smokes.cs2nades-pack.zip
  manifest.json
  maps/
  images/
  videos/
  lineups.json
```

This format should allow users to share smoke sets without needing an online account.

## Development Roadmap

1. Create the Angular application.
2. Add Tauri desktop shell.
3. Add local SQLite storage.
4. Build map management.
5. Build grenade type management.
6. Build lineup creation and viewing.
7. Add import/export packs.
8. Package the app for Windows.
9. Package the app for macOS.
10. Evaluate web sync and mobile support.

## CS2 Asset Extraction

During development, CS2 radar images, overview coordinate files, and grenade icons can be extracted from a local CS2 installation with:

```powershell
npm run extract:cs2-assets -- -Source2ViewerCli "C:\Tools\Source2Viewer\Source2Viewer-CLI.exe" -Clean
```

See `docs/cs2-asset-extraction.md` for the full workflow.

## Local Requirements

For development we need:

- Node.js with npm.
- Angular CLI, installed locally in the project.
- Rust toolchain with Cargo.
- Tauri CLI, installed locally in the project.

The project should prefer local npm dependencies over global installs where possible.

## Current Local Setup

This workspace is initialized with:

- Angular `21.2.x`.
- Tauri `2.11.x`.
- Tauri SQL plugin with SQLite support.
- Portable Node.js `24.16.0 LTS` in `.tools/node-v24.16.0-win-x64`.
- Local Rust stable toolchain in `.tools/rustup` and `.tools/cargo`.

Useful Windows commands from the project root:

```powershell
.\.tools\node-v24.16.0-win-x64\npm.cmd run start
.\.tools\node-v24.16.0-win-x64\npm.cmd run build
.\scripts\desktop-dev.cmd
.\scripts\desktop-build.cmd
```

When running Tauri manually in this local setup, Cargo can be pointed to the project-local toolchain:

```powershell
$env:CARGO_HOME = (Resolve-Path .tools).Path + '\cargo'
$env:RUSTUP_HOME = (Resolve-Path .tools).Path + '\rustup'
```
