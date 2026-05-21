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

REM Open the browser automatically after a short delay
start "" cmd /c "timeout /t 18 /nobreak >nul && start http://localhost:8000"

echo Starting Baari... the app will open in your browser automatically.
echo To stop Baari later: close this window.
echo.
docker compose up --build
