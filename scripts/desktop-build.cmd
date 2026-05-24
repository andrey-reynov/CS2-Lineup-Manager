@echo off
setlocal

set ROOT=%~dp0..
set CARGO_HOME=%ROOT%\.tools\cargo
set RUSTUP_HOME=%ROOT%\.tools\rustup
set PATH=%CARGO_HOME%\bin;%PATH%

call "%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat" -arch=x64
if errorlevel 1 exit /b %errorlevel%

call "%ROOT%\.tools\node-v24.16.0-win-x64\npm.cmd" run desktop:build
