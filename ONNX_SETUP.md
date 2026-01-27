# ONNX Face Detection Setup & Testing Guide

This guide helps you test ONNX-based face detection and compare it with your existing dlib-based approach.

## Quick Start

### 1. Install Dependencies

```bash
# Create a virtual environment (recommended)
python -m venv venv_onnx

# Activate it
# On Linux/Mac:
source venv_onnx/bin/activate
# On Windows:
# venv_onnx\Scripts\activate

# Install ONNX requirements
pip install -r requirements_onnx.txt
```

### 2. Run the Test Script

```bash
# Basic test (uses synthetic test image)
python test_onnx_models.py

# Test with your own photo
python test_onnx_models.py /path/to/your/photo.jpg

# Example with a photo from your collection
python test_onnx_models.py ./server/data/sample_photo.jpg
```

## What the Test Does

The test script will:

1. ✓ **Check Dependencies** - Verify all packages are installed
2. ✓ **Test ONNX Runtime** - Check CPU/GPU availability
3. ✓ **Download Models** - Auto-download ONNX models (~300MB on first run)
4. ✓ **Test Detection** - Detect faces in test image
5. ✓ **Test Clustering** - Demonstrate DBSCAN clustering
6. ✓ **Benchmark** - Measure performance on different image sizes

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

✓ All dependencies installed!

TESTING ONNX RUNTIME
============================================================
✓ ONNX Runtime version: 1.17.0
✓ Available providers: CPUExecutionProvider
  → Using CPU (GPU not available)

TESTING INSIGHTFACE MODEL LOADING
============================================================
Initializing FaceAnalysis (this may download models ~300MB on first run)...
Models will be cached in: ~/.insightface/
✓ FaceAnalysis initialized
✓ Models prepared successfully!

TESTING FACE DETECTION
============================================================
Image shape: (480, 640, 3)
Running face detection...
✓ Detection completed in 45.23ms
✓ Found 1 face(s)

  Face 1:
    Bounding box: [x1, y1, x2, y2]
    Confidence: 0.9856
    Embedding shape: (512,)

TESTING CLUSTERING ALGORITHM
============================================================
Generated 10 synthetic face embeddings
Clustering with DBSCAN...
✓ Clustering completed
  Clusters found: 3
  Outliers: 1

PERFORMANCE BENCHMARK
============================================================
  640x480: 45.20ms (avg)
  1280x720: 78.50ms (avg)
  1920x1080: 145.30ms (avg)

============================================================
TEST SUITE COMPLETED
============================================================
✓ All tests passed!
```

## Comparison: ONNX vs dlib (face_recognition)

| Feature | ONNX (InsightFace) | dlib (face_recognition) |
|---------|-------------------|------------------------|
| **Speed** | Fast (30-50ms) | Slower (100-200ms) |
| **Accuracy** | Very High | High |
| **Model Size** | ~300 MB | ~100 MB |
| **GPU Support** | Yes (easy) | Limited |
| **Deployment** | Excellent | Good |
| **Cross-platform** | Excellent | Good (needs C++ compiler) |
| **Dependencies** | Lightweight | Heavy (cmake, dlib) |
| **Embedding Size** | 512-D | 128-D |

## ONNX Models Downloaded

After running the test, models are cached in `~/.insightface/models/buffalo_l/`:

```
buffalo_l/
├── det_10g.onnx              (~16 MB)  - Face detection (SCRFD)
├── w600k_r50.onnx            (~166 MB) - Face recognition (ArcFace)
├── genderage.onnx            (~1 MB)   - Age/gender estimation
└── ...
```

## GPU Support (Optional)

To enable GPU acceleration:

```bash
# Uninstall CPU version
pip uninstall onnxruntime

# Install GPU version (requires CUDA)
pip install onnxruntime-gpu==1.17.0

# Then modify the provider in code:
app = FaceAnalysis(
    name='buffalo_l',
    providers=['CUDAExecutionProvider', 'CPUExecutionProvider']  # GPU first, CPU fallback
)
```

## Troubleshooting

### Models don't download
- Check internet connection
- Manual download: https://github.com/deepinsight/insightface/releases
- Place in: `~/.insightface/models/buffalo_l/`

### "No module named onnxruntime"
```bash
pip install onnxruntime
```

### Import errors
```bash
# Reinstall all dependencies
pip install -r requirements_onnx.txt --force-reinstall
```

### Slow performance
- Reduce detection size: `det_size=(320, 320)` instead of `(640, 640)`
- Use GPU version (5-10x faster)
- Resize large images before processing

## Integration with Your Backend

After testing, you can integrate ONNX into your FastAPI backend:

```python
# In your FastAPI app
from insightface.app import FaceAnalysis

# Initialize once at startup
face_app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
face_app.prepare(ctx_id=0, det_size=(640, 640))

# Use in endpoint
@app.post("/detect-faces")
async def detect_faces(file: UploadFile):
    image = await file.read()
    img = cv2.imdecode(np.frombuffer(image, np.uint8), cv2.IMREAD_COLOR)
    faces = face_app.get(img)

    return {
        "faces_count": len(faces),
        "faces": [
            {
                "bbox": face.bbox.tolist(),
                "confidence": float(face.det_score),
                "embedding": face.embedding.tolist()
            }
            for face in faces
        ]
    }
```

## Next Steps

1. ✓ Run the test script to verify everything works
2. Compare performance with your existing `face_processor.py`
3. Decide which approach to use (ONNX recommended for production)
4. Integrate ONNX into FastAPI backend
5. Deploy to cloud/server

## Questions?

- InsightFace docs: https://github.com/deepinsight/insightface
- ONNX Runtime docs: https://onnxruntime.ai/docs/
- Model Zoo: https://github.com/deepinsight/insightface/tree/master/model_zoo
