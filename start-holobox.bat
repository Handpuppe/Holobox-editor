@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "PORT=4173"
set "URL=http://127.0.0.1:%PORT%/Holobox-editor/"
set "MODE=%~1"
if /I "%MODE%"=="" set "MODE=kiosk"

echo Holobox Zorgsimulator
echo Studentensimulatie (hub, Logopedie, Verpleegkunde).
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is niet gevonden. Installeer Node.js of start deze map vanuit een terminal waar node in het PATH staat.
  pause
  exit /b 1
)

if not exist "dist\index.html" (
  echo Dist ontbreekt. De app wordt nu gebouwd...
  call npm run build
  if errorlevel 1 (
    echo Bouwen is mislukt.
    pause
    exit /b 1
  )
)

echo Server starten op %URL% ...
start "Holobox-server" /min cmd /c "cd /d "%~dp0" && npx vite preview --host 127.0.0.1 --port %PORT% --strictPort"

set /a WAIT=0
:waitloop
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri '%URL%' -TimeoutSec 2; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto ready
set /a WAIT+=1
if %WAIT% GEQ 45 (
  echo De preview-server start niet op poort %PORT%.
  pause
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto waitloop

:ready
echo Browser openen...
call :openbrowser
echo.
echo De app draait. Sluit het browservenster als je klaar bent.
echo Daarna kun je dit venster sluiten.
pause
goto :eof

:openbrowser
set "EDGE86=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set "EDGE64=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "PROFILE=%TEMP%\holobox-kiosk-profile"

if /I "%MODE%"=="windowed" (
  if exist "%EDGE86%" (
    start "" "%EDGE86%" --new-window --app=%URL% --user-data-dir="%PROFILE%"
    exit /b 0
  )
  if exist "%EDGE64%" (
    start "" "%EDGE64%" --new-window --app=%URL% --user-data-dir="%PROFILE%"
    exit /b 0
  )
  if exist "%CHROME%" (
    start "" "%CHROME%" --new-window --app=%URL% --user-data-dir="%PROFILE%"
    exit /b 0
  )
  start "" "%URL%"
  exit /b 0
)

if exist "%EDGE86%" (
  start "" "%EDGE86%" --kiosk %URL% --edge-kiosk-type=fullscreen --no-first-run --disable-session-crashed-bubble --user-data-dir="%PROFILE%"
  exit /b 0
)
if exist "%EDGE64%" (
  start "" "%EDGE64%" --kiosk %URL% --edge-kiosk-type=fullscreen --no-first-run --disable-session-crashed-bubble --user-data-dir="%PROFILE%"
  exit /b 0
)
if exist "%CHROME%" (
  start "" "%CHROME%" --kiosk --app=%URL% --user-data-dir="%PROFILE%"
  exit /b 0
)
start "" "%URL%"
exit /b 0
