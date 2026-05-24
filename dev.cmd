@echo off
setlocal

call "%~dp0.tools\node-v24.16.0-win-x64\npm.cmd" run start -- --host 127.0.0.1
