@echo off
REM ONNX Face Detection - Windows Installation Script
REM Automatically handles Python version compatibility

echo ============================================================
echo ONNX FACE DETECTION - WINDOWS INSTALLATION
echo ============================================================
echo.

REM Check for Python 3.12 specifically (most compatible)
echo Step 1: Checking for compatible Python version...
echo.

REM Try to find Python 3.12
py -3.12 --version >nul 2>&1
if %errorlevel% equ 0 (
    echo + Python 3.12 found - using this version
    set PYTHON_CMD=py -3.12
    goto :python_ok
)

REM Try to find Python 3.11
py -3.11 --version >nul 2>&1
if %errorlevel% equ 0 (
    echo + Python 3.11 found - using this version
    set PYTHON_CMD=py -3.11
    goto :python_ok
)

REM Try to find Python 3.10
py -3.10 --version >nul 2>&1
if %errorlevel% equ 0 (
    echo + Python 3.10 found - using this version
    set PYTHON_CMD=py -3.10
    goto :python_ok
)

REM Check default python
python --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VER=%%i
    echo ! Warning: Using default Python version !PYTHON_VER!
    echo ! This might not be compatible with ONNX Runtime
    set PYTHON_CMD=python
    echo.
    echo RECOMMENDATION: Install Python 3.12 for best compatibility
    echo   Download from: https://www.python.org/downloads/
    echo   OR run: winget install Python.Python.3.12
    echo.
    choice /C YN /M "Continue anyway"
    if errorlevel 2 exit /b 1
    goto :python_ok
)

REM No compatible Python found
echo X No compatible Python found!
echo.
echo Please install Python 3.10, 3.11, or 3.12 from:
echo   https://www.python.org/downloads/
echo.
echo OR install via winget:
echo   winget install Python.Python.3.12
echo.
echo Make sure to check 'Add Python to PATH' during installation!
pause
exit /b 1

:python_ok
echo.

REM Check pip
echo Step 2: Checking pip...
%PYTHON_CMD% -m pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo X pip not found, installing...
    %PYTHON_CMD% -m ensurepip --default-pip
)
echo + pip is available
echo.

REM Create virtual environment
echo Step 3: Creating virtual environment...
if exist venv_onnx (
    echo   Removing existing venv_onnx...
    rmdir /s /q venv_onnx
)

%PYTHON_CMD% -m venv venv_onnx
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
echo.

venv_onnx\Scripts\python.exe -m pip install --upgrade pip --quiet

REM Install packages one by one for better error reporting
echo   Installing onnxruntime...
venv_onnx\Scripts\python.exe -m pip install "onnxruntime>=1.16.0" 2>&1 | findstr /V "Requirement already satisfied"
if %errorlevel% neq 0 (
    echo X Failed to install onnxruntime
    echo   Your Python version might not be compatible
    echo   Please install Python 3.12 and try again
    pause
    exit /b 1
)

echo   Installing opencv-python...
venv_onnx\Scripts\python.exe -m pip install "opencv-python>=4.8.0" --quiet

echo   Installing insightface...
venv_onnx\Scripts\python.exe -m pip install "insightface>=0.7.3" --quiet

echo   Installing scikit-learn...
venv_onnx\Scripts\python.exe -m pip install "scikit-learn>=1.3.0" --quiet

echo   Installing Pillow...
venv_onnx\Scripts\python.exe -m pip install "Pillow>=10.0.0" --quiet

echo   Installing numpy...
venv_onnx\Scripts\python.exe -m pip install "numpy>=1.24.0,<2.0.0" --quiet

if %errorlevel% neq 0 (
    echo X Failed to install packages
    pause
    exit /b 1
)

echo.
echo + Python packages installed successfully!
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
