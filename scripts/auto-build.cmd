@echo off
setlocal

for %%I in ("%~dp0..") do set "ROOT=%%~fI"
set "NODE_DIR=%ROOT%\.tools\node-v24.16.0-win-x64"
set "NPM=%NODE_DIR%\npm.cmd"
set "CARGO_HOME=%ROOT%\.tools\cargo"
set "RUSTUP_HOME=%ROOT%\.tools\rustup"
set "NG_CLI_ANALYTICS=false"
set "PATH=%CARGO_HOME%\bin;%NODE_DIR%;%PATH%"

cd /d "%ROOT%"

echo.
echo [1/3] Running automated tests...
call "%NPM%" test -- --watch=false
if errorlevel 1 (
  echo.
  echo Auto build failed during tests.
  exit /b %errorlevel%
)

echo.
echo [2/3] Bumping development version...
for /f "usebackq delims=" %%V in (`"%NODE_DIR%\node.exe" "%ROOT%\scripts\bump-dev-version.mjs"`) do set "BUILD_VERSION=%%V"
if errorlevel 1 (
  echo.
  echo Auto build failed while bumping the development version.
  exit /b %errorlevel%
)
echo Version: %BUILD_VERSION%

echo.
echo [3/3] Building Windows desktop release...
call "%NPM%" run desktop:build
if errorlevel 1 (
  echo.
  echo Auto build failed during desktop packaging.
  exit /b %errorlevel%
)

echo.
echo Auto build complete.
echo Installer:
echo   %ROOT%\src-tauri\target\release\bundle\nsis\CS2 Nades_%BUILD_VERSION%_x64-setup.exe
echo MSI:
echo   %ROOT%\src-tauri\target\release\bundle\msi\CS2 Nades_%BUILD_VERSION%_x64_en-US.msi
