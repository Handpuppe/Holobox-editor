@echo off
setlocal
cd /d "%~dp0"
set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%CSC%" (
  echo C# compiler niet gevonden.
  exit /b 1
)
"%CSC%" /nologo /target:winexe /win32icon:"Phosaner.ico" /r:System.Windows.Forms.dll /r:System.Management.dll /out:"Phosaner.exe" "tools\HoloboxLauncher.cs"
if errorlevel 1 exit /b 1
echo Gemaakt: Phosaner.exe
"%CSC%" /nologo /target:winexe /r:System.Windows.Forms.dll /r:System.Management.dll /out:"Editor.exe" "tools\HoloboxLauncher.cs"
if errorlevel 1 exit /b 1
echo Gemaakt: Editor.exe
