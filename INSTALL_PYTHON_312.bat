@echo off
REM Install Python 3.12 using winget

echo ============================================================
echo INSTALLING PYTHON 3.12
echo ============================================================
echo.

echo This will install Python 3.12 alongside your existing Python 3.14
echo.

REM Check if winget is available
winget --version >nul 2>&1
if %errorlevel% neq 0 (
    echo X winget not found!
    echo.
    echo Please install Python 3.12 manually from:
    echo   https://www.python.org/downloads/release/python-3120/
    echo.
    echo Download: "Windows installer (64-bit)"
    echo Make sure to check "Add Python to PATH" during installation!
    pause
    exit /b 1
)

echo Installing Python 3.12 via winget...
echo.

winget install --id Python.Python.3.12 -e --source winget

if %errorlevel% neq 0 (
    echo.
    echo X Installation failed
    echo.
    echo Please install Python 3.12 manually from:
    echo   https://www.python.org/downloads/release/python-3120/
    pause
    exit /b 1
)

echo.
echo ============================================================
echo Python 3.12 installed successfully!
echo ============================================================
echo.
echo You may need to close and reopen Command Prompt for PATH changes to take effect.
echo.
echo After that, run: INSTALL_AND_RUN_WINDOWS_FIXED.bat
echo.

pause
