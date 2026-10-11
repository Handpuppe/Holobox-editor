@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not exist "%~dp0Phosaner.exe" (
  echo Phosaner.exe ontbreekt. Bouw die eerst met build-launcher.bat.
  pause
  exit /b 1
)

start "" "%~dp0Phosaner.exe" %*
exit /b 0
