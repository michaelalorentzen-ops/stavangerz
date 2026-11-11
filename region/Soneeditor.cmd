@echo off
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"
python -W ignore tools\zone-editor\server.py
pause
