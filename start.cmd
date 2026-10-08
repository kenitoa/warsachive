@echo off
chcp 65001 >nul
cd /d "%~dp0"
node --env-file-if-exists=.env.api scripts\start-local.mjs
if errorlevel 1 pause
