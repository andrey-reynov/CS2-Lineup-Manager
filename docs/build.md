# Build Workflow

This project uses a repeatable Windows-first build workflow for development releases. The goal is to make every installer build easy to reproduce and safe to install over an older local build.

## Main Command

Run this from the project root:

```powershell
.\scripts\auto-build.cmd
```

Equivalent npm command:

```powershell
.\.tools\node-v24.16.0-win-x64\npm.cmd run auto:build
```

In PowerShell, call `npm.cmd` or `.\npmw.cmd` explicitly. Plain `npm` can resolve to `npm.ps1`, and Windows may block that file when script execution is disabled.

## What The Script Does

`scripts/auto-build.cmd` runs three steps:

1. Runs the Angular/Vitest test suite.
2. Increments the development patch version after tests pass.
3. Runs the Tauri Windows release build.

The version bump happens after tests pass so failed builds do not consume version numbers.

## Version Bump

Development builds use numeric patch versions such as `0.1.1`, `0.1.2`, and `0.1.3`. This matters because Windows installers behave better when each build has a higher version than the installed app.

The bump helper is:

```text
scripts/bump-dev-version.mjs
```

It updates these files together:

```text
package.json
package-lock.json
src-tauri/tauri.conf.json
src-tauri/Cargo.toml
```

To check the next version without changing files:

```powershell
.\.tools\node-v24.16.0-win-x64\npm.cmd run version:bump-dev -- --dry-run
```

To bump the version without building:

```powershell
.\.tools\node-v24.16.0-win-x64\npm.cmd run version:bump-dev
```

## Desktop Build

For desktop development, prefer:

```powershell
.\npmw.cmd run desktop:dev
```

or:

```powershell
.\.tools\node-v24.16.0-win-x64\npm.cmd run desktop:dev
```

Avoid `npm run desktop:dev` in PowerShell if it triggers an `npm.ps1 cannot be loaded` execution policy error.

The desktop build itself is handled by:

```text
scripts/run-tauri-build.cmd
```

That script sets the local Node/Rust tool paths and runs:

```text
@tauri-apps/cli tauri build
```

Tauri then runs the Angular production build through `beforeBuildCommand` in:

```text
src-tauri/tauri.conf.json
```

## Output Artifacts

Successful builds produce Windows installers under:

```text
src-tauri/target/release/bundle/nsis/CS2 Nades_<version>_x64-setup.exe
src-tauri/target/release/bundle/msi/CS2 Nades_<version>_x64_en-US.msi
```

Use the NSIS `.exe` installer for the usual manual install flow. Keep the MSI available for cases where Windows Installer tooling is preferred.

## Installed App Updates

For local development, each automatic build increments the patch version. Installing a newer build over an older one should behave like an update because the Tauri app identifier stays the same:

```text
com.cs2nades.desktop
```

User content should stay in app data / local storage instead of the installation directory, so reinstalling or upgrading the app should not remove saved maps, lineups, screenshots, or descriptions.

## Expected Warning

The Angular production build may currently print a non-blocking style budget warning for `src/app/app.scss`. The build still succeeds unless Angular reports it as an error.

## Troubleshooting

If a build fails with messages about being unable to resolve project files, `node_modules`, or `src/styles.scss`, the command may have run inside a restricted sandbox. Rerun the same command with normal filesystem access.

If the installer output still has the old version, check that the version files match:

```text
package.json
package-lock.json
src-tauri/tauri.conf.json
src-tauri/Cargo.toml
```
