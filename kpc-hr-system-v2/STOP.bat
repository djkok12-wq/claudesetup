@echo off
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\kpc.ps1" -Mode stop
timeout /t 3 >nul
