# CS2 Nades

CS2 Nades is a local-first app for Counter-Strike 2 lineups. It helps players build map packs, save grenade lineups with media and notes, and keep that knowledge available offline while playing.

## Wiki Hub

- [Product scope](docs/product-scope.md): MVP goals, roadmap, and what the app is trying to become.
- [Architecture](docs/architecture.md): chosen stack, storage direction, domain models, and pack format.
- [Development setup](docs/development-setup.md): local requirements, Windows commands, and browser/desktop workflows.
- [Build workflow](docs/build.md): automatic tests, development version bumps, and Tauri release bundles.
- [Content workspace](docs/content-workspace.md): user-facing app-data folder contract for maps, media, exports, and generated content.
- [CS2 asset extraction](docs/cs2-asset-extraction.md): development workflow for radar images, overview files, and grenade icons.
- [Prototype UI](docs/prototype-ui.md): current map screen behavior and marker coordinate notes.

## Quick Start

From the project root:

```powershell
.\dev.cmd
```

Then open:

```text
http://localhost:4200
```

For desktop development:

```powershell
.\npmw.cmd run desktop:dev
```

For Windows release builds, prefer the automatic build script:

```powershell
.\scripts\auto-build.cmd
```

The automatic build runs tests, bumps the development patch version, and creates Tauri installer bundles. See [docs/build.md](docs/build.md) for the full release flow.
