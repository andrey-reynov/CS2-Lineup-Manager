@echo off
setlocal

set "ROOT=%~dp0.."
set "NODE_DIR=%ROOT%\.tools\node-v24.16.0-win-x64"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$client = New-Object Net.Sockets.TcpClient; try { $client.Connect('127.0.0.1', 4200); exit 0 } catch { exit 1 } finally { $client.Dispose() }"
if not errorlevel 1 (
  echo Angular dev server is already running on http://127.0.0.1:4200
  exit /b 0
)

cd /d "%ROOT%"
call "%NODE_DIR%\npm.cmd" run start
