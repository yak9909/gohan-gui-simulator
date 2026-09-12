@echo off
cd /d "%~dp0"
start "CTRPF UI Preview Server" /min cmd /c node server.js
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:4173/?v=20260831-6"
