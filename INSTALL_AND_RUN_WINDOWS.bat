@echo off
REM ONNX Face Detection - Windows Installation Script (Batch)
REM Double-click this file to run

echo ============================================================
echo ONNX FACE DETECTION - WINDOWS INSTALLATION
echo ============================================================
echo.

REM Check if Python is installed
echo Step 1: Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo X Python not found!
    echo.
    echo Please install Python from:
    echo   https://www.python.org/downloads/
    echo.
    echo OR install via winget:
    echo   winget install Python.Python.3.12
    echo.
    echo Make sure to check 'Add Python to PATH' during installation!
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
echo + Python found: %PYTHON_VERSION%
echo.

REM Check pip
echo Step 2: Checking pip...
python -m pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo X pip not found, installing...
    python -m ensurepip --default-pip
)
echo + pip is available
echo.

REM Create virtual environment
echo Step 3: Creating virtual environment...
if exist venv_onnx (
    echo   Removing existing venv_onnx...
    rmdir /s /q venv_onnx
)

python -m venv venv_onnx
if %errorlevel% neq 0 (
    echo X Failed to create virtual environment
    pause
    exit /b 1
)

echo + Virtual environment created
echo.

REM Install packages
echo Step 4: Installing Python packages...
echo   This will take 3-5 minutes...
venv_onnx\Scripts\python.exe -m pip install --upgrade pip --quiet
venv_onnx\Scripts\python.exe -m pip install -r requirements_onnx.txt

if %errorlevel% neq 0 (
    echo X Failed to install packages
    pause
    exit /b 1
)

echo + Python packages installed
echo.

REM Run the test
echo ============================================================
echo RUNNING ONNX TEST
echo ============================================================
echo.
echo Note: First run will download models (~300MB), please be patient...
echo.

venv_onnx\Scripts\python.exe test_onnx_models.py

echo.
echo ============================================================
echo INSTALLATION AND TEST COMPLETED
echo ============================================================
echo.
echo Next time, run the test with:
echo   venv_onnx\Scripts\python.exe test_onnx_models.py [optional-image-path]
echo.

pause
