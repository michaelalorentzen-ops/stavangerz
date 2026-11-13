@echo off
rem Starter spillet og soneeditoren sammen. Lukk vinduene for å stoppe dem.
chcp 65001 >nul
cd /d "%~dp0"
start "Soneeditor" cmd /k "set PYTHONUTF8=1 && python -W ignore tools\zone-editor\server.py --no-browser"
start "Stavanger Z" cmd /k "pnpm dev"
timeout /t 8 /nobreak >nul
start "" http://127.0.0.1:3000/
start "" http://127.0.0.1:5178/
