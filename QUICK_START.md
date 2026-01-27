# Quick Start - ONNX Face Detection Test

## Option 1: Automated Installation (Recommended)

```bash
# Run the automated installation script
./INSTALL_AND_RUN.sh
```

This will:
1. Install system dependencies (requires sudo password)
2. Create virtual environment
3. Install Python packages
4. Run the test

---

## Option 2: Manual Installation

### Step 1: Install System Dependencies

```bash
sudo apt update
sudo apt install -y python3.12-venv python3-pip python3-dev
```

### Step 2: Create Virtual Environment

```bash
python3 -m venv venv_onnx
```

### Step 3: Activate Virtual Environment

```bash
source venv_onnx/bin/activate
```

### Step 4: Install Python Packages

```bash
pip install --upgrade pip
pip install -r requirements_onnx.txt
```

**Note:** This will install:
- onnxruntime (~50 MB)
- insightface (~10 MB)
- opencv-python, numpy, Pillow
- scikit-learn

### Step 5: Run the Test

```bash
# Basic test (synthetic image)
python test_onnx_models.py

# Test with your own photo
python test_onnx_models.py /path/to/your/photo.jpg

# Example: Test with a photo from server/data
python test_onnx_models.py server/data/sample_photo.jpg
```

**Important:** First run will download ONNX models (~300 MB) to `~/.insightface/`

---

## Expected First Run Time

- System dependencies: ~1-2 minutes
- Python packages: ~2-3 minutes
- Model download (first run only): ~3-5 minutes
- Test execution: ~30 seconds

**Total first run:** ~7-10 minutes
**Subsequent runs:** ~30 seconds

---

## Troubleshooting

### "command not found: python3"
```bash
# Check Python installation
which python3
python3 --version
```

### "No module named 'insightface'"
```bash
# Make sure virtual environment is activated
source venv_onnx/bin/activate

# Reinstall
pip install insightface
```

### Models fail to download
- Check internet connection
- Try again (might be temporary network issue)
- Manual download: https://github.com/deepinsight/insightface/releases

### "Permission denied"
```bash
# Make script executable
chmod +x INSTALL_AND_RUN.sh
```

---

## After Installation

### Run Tests Again

```bash
# Activate environment
source venv_onnx/bin/activate

# Run test
python test_onnx_models.py [optional-image-path]
```

### Deactivate Environment

```bash
deactivate
```

### Clean Up (if needed)

```bash
# Remove virtual environment
rm -rf venv_onnx

# Remove downloaded models (frees ~300 MB)
rm -rf ~/.insightface
```

---

## What You'll See

```
============================================================
ONNX FACE DETECTION TEST SUITE
============================================================

CHECKING DEPENDENCIES
✓ onnxruntime          - installed
✓ opencv-python        - installed
✓ insightface          - installed
✓ scikit-learn         - installed
✓ Pillow               - installed

TESTING ONNX RUNTIME
✓ ONNX Runtime version: 1.17.0
✓ Available providers: CPUExecutionProvider

TESTING INSIGHTFACE MODEL LOADING
Initializing FaceAnalysis...
✓ Models prepared successfully!

TESTING FACE DETECTION
✓ Detection completed in 45.23ms
✓ Found 1 face(s)

  Face 1:
    Bounding box: [120, 80, 340, 360]
    Confidence: 0.9856
    Embedding shape: (512,)

TESTING CLUSTERING ALGORITHM
✓ Clustering completed
  Clusters found: 3

PERFORMANCE BENCHMARK
  640x480: 45.20ms (avg)
  1280x720: 78.50ms (avg)
  1920x1080: 145.30ms (avg)

============================================================
TEST SUITE COMPLETED
============================================================
✓ All tests passed!
```

---

## Next Steps

1. ✓ Run the test to verify ONNX works
2. Compare with your existing `server/face-service/face_processor.py`
3. Integrate ONNX into FastAPI backend
4. Deploy to production

See `ONNX_SETUP.md` for detailed integration guide.
