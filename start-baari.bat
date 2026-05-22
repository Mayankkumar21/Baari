@echo off
REM Baari one-click launcher for Windows.
REM Double-click this file. First run downloads images (~1 min); later runs are fast.

cd /d "%~dp0"

echo ===================================================
echo    Baari - starting up. Please keep this window open.
echo ===================================================
echo.

REM Check Docker is available
docker info >nul 2>&1
if errorlevel 1 (
  echo Docker Desktop does not seem to be running.
  echo Please start Docker Desktop, wait for it to finish loading,
  echo then double-click this file again.
  echo.
  echo If Docker is not installed, get it from:
  echo   https://www.docker.com/products/docker-desktop
  echo.
  pause
  exit /b 1
)

REM Open the browser only once the server actually responds (handles the slow
REM first build). Polls /healthz every 2s for up to ~5 minutes, then opens.
start "" powershell -NoProfile -WindowStyle Hidden -Command ^
  "$ErrorActionPreference='SilentlyContinue'; for($i=0;$i -lt 150;$i++){ try{ if((Invoke-WebRequest 'http://localhost:8000/healthz' -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200){ Start-Process 'http://localhost:8000'; break } }catch{}; Start-Sleep -Seconds 2 }"

echo Starting Baari... the app will open in your browser automatically
echo once it is ready (the first run takes about a minute).
echo To stop Baari later: close this window.
echo.
docker compose up --build
