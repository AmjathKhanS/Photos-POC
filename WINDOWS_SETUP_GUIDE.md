# Windows Installation Guide - ONNX Face Detection

## Quick Start (Easiest Method)

### Option 1: Double-Click Batch File (Recommended)

1. **Ensure Python is installed** (see below if not)
2. **Double-click** `INSTALL_AND_RUN_WINDOWS.bat`
3. Wait for installation and test to complete

### Option 2: Run PowerShell Script

1. Open **PowerShell** (right-click Start → Windows PowerShell)
2. Navigate to project directory:
   ```powershell
   cd "D:\Photos Ai\photo-viewer"
   ```
3. Run the script:
   ```powershell
   .\INSTALL_AND_RUN_WINDOWS.ps1
   ```

---

## Prerequisites: Install Python (If Not Installed)

### Method 1: Official Python Installer (Recommended)

1. Download Python from: https://www.python.org/downloads/
2. Run the installer
3. **IMPORTANT**: ✅ Check **"Add Python to PATH"** during installation
4. Click "Install Now"

### Method 2: Using winget (Windows Package Manager)

Open PowerShell or Command Prompt and run:
```powershell
winget install Python.Python.3.12
```

### Verify Python Installation

Open Command Prompt and run:
```cmd
python --version
```

You should see something like: `Python 3.12.x`

---

## Installation Steps (If Running Manually)

### Step 1: Open Command Prompt or PowerShell

- Press `Win + R`
- Type `cmd` or `powershell`
- Press Enter

### Step 2: Navigate to Project Directory

```cmd
cd "D:\Photos Ai\photo-viewer"
```

### Step 3: Create Virtual Environment

```cmd
python -m venv venv_onnx
```

### Step 4: Activate Virtual Environment

**Command Prompt:**
```cmd
venv_onnx\Scripts\activate
```

**PowerShell:**
```powershell
.\venv_onnx\Scripts\Activate.ps1
```

If PowerShell gives an error about execution policy, run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Step 5: Install Packages

```cmd
python -m pip install --upgrade pip
pip install -r requirements_onnx.txt
```

### Step 6: Run the Test

```cmd
python test_onnx_models.py
```

Or test with your own image:
```cmd
python test_onnx_models.py "path\to\your\photo.jpg"
```

---

## What the Test Does

1. ✅ Checks all dependencies are installed
2. ✅ Tests ONNX Runtime (CPU/GPU detection)
3. ✅ Downloads InsightFace models (~300MB first time)
4. ✅ Runs face detection test
5. ✅ Demonstrates clustering
6. ✅ Benchmarks performance

---

## Expected Output

```
============================================================
ONNX FACE DETECTION TEST SUITE
============================================================

CHECKING DEPENDENCIES
============================================================
✓ onnxruntime          - installed
✓ opencv-python        - installed
✓ insightface          - installed
✓ scikit-learn         - installed
✓ Pillow               - installed

TESTING ONNX RUNTIME
============================================================
✓ ONNX Runtime version: 1.17.0
✓ Available providers: CPUExecutionProvider

TESTING FACE DETECTION
============================================================
✓ Detection completed in 45.23ms
✓ Found 1 face(s)

============================================================
TEST SUITE COMPLETED
============================================================
✓ All tests passed!
```

---

## Running Again (After Installation)

Once installed, you can run tests anytime:

**With virtual environment:**
```cmd
venv_onnx\Scripts\python.exe test_onnx_models.py
```

**Or activate venv first:**
```cmd
venv_onnx\Scripts\activate
python test_onnx_models.py
```

---

## Troubleshooting

### "Python is not recognized"

**Problem:** Python not in PATH

**Solution:**
1. Reinstall Python with "Add Python to PATH" checked
2. OR manually add Python to PATH:
   - Search "Environment Variables" in Windows
   - Edit "Path" variable
   - Add: `C:\Users\YourUsername\AppData\Local\Programs\Python\Python312`

### "pip is not recognized"

**Solution:**
```cmd
python -m pip --version
```

Use `python -m pip` instead of just `pip`

### "Access denied" or "Permission denied"

**Solution:** Run Command Prompt as Administrator
- Right-click Command Prompt
- Select "Run as administrator"

### PowerShell execution policy error

**Solution:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Models fail to download

**Problem:** Internet connection or firewall

**Solution:**
1. Check internet connection
2. Disable VPN temporarily
3. Check firewall settings

### Import errors after installation

**Solution:** Reinstall packages
```cmd
venv_onnx\Scripts\python.exe -m pip install -r requirements_onnx.txt --force-reinstall
```

---

## File Locations

- **Virtual environment:** `D:\Photos Ai\photo-viewer\venv_onnx\`
- **Models cache:** `C:\Users\YourUsername\.insightface\`
- **Test script:** `D:\Photos Ai\photo-viewer\test_onnx_models.py`

---

## Next Steps

After successful test:
1. ✅ Compare with your existing face detection code
2. ✅ Integrate ONNX into your FastAPI backend
3. ✅ Deploy to production

---

## GPU Support (Optional)

To use GPU acceleration on Windows:

1. Install CUDA Toolkit from: https://developer.nvidia.com/cuda-downloads
2. Reinstall onnxruntime with GPU:
   ```cmd
   pip uninstall onnxruntime
   pip install onnxruntime-gpu
   ```

**Speed improvement:** 5-10x faster with GPU!

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `python --version` | Check Python version |
| `python -m venv venv_onnx` | Create virtual environment |
| `venv_onnx\Scripts\activate` | Activate venv (CMD) |
| `.\venv_onnx\Scripts\Activate.ps1` | Activate venv (PowerShell) |
| `pip install -r requirements_onnx.txt` | Install packages |
| `python test_onnx_models.py` | Run test |
| `deactivate` | Deactivate venv |

---

## Need Help?

If you encounter issues:
1. Check the troubleshooting section above
2. Make sure Python is properly installed
3. Ensure you're in the correct directory
4. Try running Command Prompt as Administrator
