@echo off
rem PosterLight starter for Windows. Double-click this file.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo PosterLight needs Node.js. Install the LTS version from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
if not exist config.json start "" /b cmd /c "timeout /t 2 >nul & start http://localhost:8686/setup"
node server.js
echo.
echo PosterLight stopped.
pause
