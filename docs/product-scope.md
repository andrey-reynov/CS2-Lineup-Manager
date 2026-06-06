# Product Scope

CS2 Nades starts as an offline desktop app for collecting, editing, importing, exporting, and viewing Counter-Strike 2 grenade lineups.

## MVP Goals

A user should be able to:

- add custom CS2 maps,
- store grenade types such as smokes, flashes, molotovs, HE grenades, and decoys,
- create lineups with position, aim point, result point, throw type, notes, images, and videos,
- import and export lineup packs,
- use the same core app later as a web application.

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

## Product Direction

The first release is local-first and account-free. Future versions can add cloud sync, public packs, accounts, shared community content, and mobile support without replacing the core lineup model.
