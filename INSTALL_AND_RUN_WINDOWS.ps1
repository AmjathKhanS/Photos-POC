# ONNX Face Detection - Windows Installation Script (PowerShell)
# Run this in PowerShell (not Command Prompt)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "ONNX FACE DETECTION - WINDOWS INSTALLATION" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Python is installed
Write-Host "Step 1: Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = & python --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Python found: $pythonVersion" -ForegroundColor Green
    } else {
        throw "Python not found"
    }
} catch {
    Write-Host "✗ Python not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Python from:" -ForegroundColor Yellow
    Write-Host "  https://www.python.org/downloads/" -ForegroundColor White
    Write-Host ""
    Write-Host "OR install via winget:" -ForegroundColor Yellow
    Write-Host "  winget install Python.Python.3.12" -ForegroundColor White
    Write-Host ""
    Write-Host "Make sure to check 'Add Python to PATH' during installation!" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Check if pip is available
Write-Host "Step 2: Checking pip..." -ForegroundColor Yellow
try {
    $pipVersion = & python -m pip --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ pip found: $pipVersion" -ForegroundColor Green
    } else {
        throw "pip not found"
    }
} catch {
    Write-Host "✗ pip not found, installing..." -ForegroundColor Yellow
    python -m ensurepip --default-pip
    python -m pip install --upgrade pip
}

Write-Host ""

# Create virtual environment
Write-Host "Step 3: Creating virtual environment..." -ForegroundColor Yellow
if (Test-Path "venv_onnx") {
    Write-Host "  Removing existing venv_onnx..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force venv_onnx
}

python -m venv venv_onnx

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to create virtual environment" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✓ Virtual environment created" -ForegroundColor Green
Write-Host ""

# Activate virtual environment and install packages
Write-Host "Step 4: Installing Python packages..." -ForegroundColor Yellow
Write-Host "  This will take 3-5 minutes..." -ForegroundColor Gray

& .\venv_onnx\Scripts\python.exe -m pip install --upgrade pip | Out-Null
& .\venv_onnx\Scripts\python.exe -m pip install -r requirements_onnx.txt

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to install packages" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✓ Python packages installed" -ForegroundColor Green
Write-Host ""

# Run the test
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "RUNNING ONNX TEST" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: First run will download models (~300MB), please be patient..." -ForegroundColor Yellow
Write-Host ""

& .\venv_onnx\Scripts\python.exe test_onnx_models.py

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "INSTALLATION AND TEST COMPLETED" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next time, run the test with:" -ForegroundColor Green
Write-Host "  .\venv_onnx\Scripts\python.exe test_onnx_models.py [optional-image-path]" -ForegroundColor White
Write-Host ""

Read-Host "Press Enter to exit"
