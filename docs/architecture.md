# Architecture

CS2 Nades uses Angular for the application layer, Tauri for desktop packaging and native access, SQLite for local storage, and portable JSON/ZIP files for import and export.

## Chosen Stack

- **Angular** for the user interface.
- **Tauri** for desktop builds on Windows and macOS.
- **SQLite** for local offline storage.
- **JSON/ZIP packs** for import and export.

This keeps the app local-first and portable while preserving a path to a future web version.

## Why This Stack

Angular can run as a browser app, a Tauri desktop app, and later a mobile app with Capacitor or Tauri Mobile.

Tauri is preferred over Electron for the MVP because it usually produces smaller desktop applications and gives native filesystem/database access without bundling a full Chromium runtime.

SQLite is preferred over MySQL for the offline desktop version because it does not require a separate database server. MySQL or PostgreSQL can still be used later for cloud sync, public packs, accounts, and shared community content.

## Planned Layers

```text
Angular UI
  -> application services
  -> repository interfaces
  -> local Tauri/SQLite implementation
```

The Angular app should not depend directly on Tauri or SQLite. It should call repository interfaces so the storage layer can be replaced later.

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

This format lets users share smoke sets without needing an online account.

The desktop app also maintains a user-facing content workspace under app data:

```text
Content/
  Maps/
    <map name>/
      Meta/
      User/
        Inbox/
        Media/
System/
```

See [content-workspace.md](content-workspace.md) for the folder contract used by exports, future scripts, generated content, and manual media drops.
