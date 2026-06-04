@echo off
setlocal

set "ROOT=%~dp0.."
set "CARGO_HOME=%ROOT%\.tools\cargo"
set "RUSTUP_HOME=%ROOT%\.tools\rustup"
set "NG_CLI_ANALYTICS=false"
set "PATH=%CARGO_HOME%\bin;%ROOT%\.tools\node-v24.16.0-win-x64;%PATH%"

if exist "%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat" (
  call "%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat" -arch=x64
  if errorlevel 1 exit /b %errorlevel%
)

cd /d "%ROOT%"
call "%ROOT%\.tools\node-v24.16.0-win-x64\node.exe" "%ROOT%\node_modules\@tauri-apps\cli\tauri.js" dev
