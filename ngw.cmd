@echo off
setlocal

set PATH=%~dp0.tools\node-v24.16.0-win-x64;%PATH%
call "%~dp0.tools\node-v24.16.0-win-x64\node.exe" "%~dp0node_modules\@angular\cli\bin\ng.js" %*
