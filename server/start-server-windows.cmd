@echo off
REM Start Photo Viewer Server on Windows

echo.
echo ========================================
echo   Photo Viewer Server - Windows
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Check if we're in the right directory
if not exist package.json (
    echo [ERROR] package.json not found!
    echo Please run this script from the server directory
    echo.
    pause
    exit /b 1
)

echo [INFO] Starting server...
echo [INFO] Press Ctrl+C to stop the server
echo.

npm run dev
