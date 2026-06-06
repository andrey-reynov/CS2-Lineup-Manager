@echo off
setlocal

set "ROOT=%~dp0.."
set "NPM=%ROOT%\.tools\node-v24.16.0-win-x64\npm.cmd"

call "%NPM%" run smoke:ui
