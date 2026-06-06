# Development Setup

This project should prefer local tools and project wrappers over global installs where possible.

## Local Requirements

- Node.js with npm.
- Angular CLI, installed locally in the project.
- Rust toolchain with Cargo.
- Tauri CLI, installed locally in the project.

## Current Workspace

This workspace is initialized with:

- Angular `21.2.x`,
- Tauri `2.11.x`,
- Tauri SQL plugin with SQLite support,
- portable Node.js `24.16.0 LTS` in `.tools/node-v24.16.0-win-x64`,
- local Rust stable toolchain in `.tools/rustup` and `.tools/cargo`.

## Useful Commands

Run these from the project root:

```powershell
.\dev.cmd
.\npmw.cmd run build
.\npmw.cmd test -- --watch=false
.\npmw.cmd run desktop:dev
.\.tools\node-v24.16.0-win-x64\npm.cmd run start
.\.tools\node-v24.16.0-win-x64\npm.cmd run build
.\.tools\node-v24.16.0-win-x64\npm.cmd run auto:build
.\scripts\desktop-dev.cmd
.\scripts\desktop-build.cmd
.\scripts\auto-build.cmd
```

For browser preview:

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

For Windows release builds:

```powershell
.\scripts\auto-build.cmd
```

See [build.md](build.md) for the full build workflow.

## PowerShell Notes

In PowerShell, prefer `.\npmw.cmd` or the explicit `npm.cmd` path. Plain `npm` may resolve to `npm.ps1`, which can be blocked by Windows Execution Policy.

If `npm`, `npm start`, `ng serve`, or `ng` are not found in the terminal, or if `npm.ps1` is blocked, use the project-local wrappers:

```powershell
.\npmw.cmd start
.\npmw.cmd run desktop:dev
.\ngw.cmd serve --host 127.0.0.1
```

The project also includes PATH shims in `bin/`. After opening a new terminal, these commands should work from the project root:

```powershell
npm start
ng serve --host 127.0.0.1
```

When running Tauri manually in this local setup, Cargo can be pointed to the project-local toolchain:

```powershell
$env:CARGO_HOME = (Resolve-Path .tools).Path + '\cargo'
$env:RUSTUP_HOME = (Resolve-Path .tools).Path + '\rustup'
```
