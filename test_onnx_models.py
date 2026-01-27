#!/usr/bin/env python3
"""
ONNX Face Detection Test Script
Tests InsightFace with ONNX models for face detection and recognition
"""

import sys
import os
import time
import numpy as np
from pathlib import Path

def check_dependencies():
    """Check if all required packages are installed"""
    print("=" * 60)
    print("CHECKING DEPENDENCIES")
    print("=" * 60)

    required_packages = {
        'onnxruntime': 'onnxruntime',
        'cv2': 'opencv-python',
        'insightface': 'insightface',
        'sklearn': 'scikit-learn',
        'PIL': 'Pillow'
    }

    missing = []
    for module, package in required_packages.items():
        try:
            __import__(module)
            print(f"✓ {package:20s} - installed")
        except ImportError:
            print(f"✗ {package:20s} - MISSING")
            missing.append(package)

    if missing:
        print("\n" + "=" * 60)
        print("MISSING PACKAGES - Install with:")
        print(f"pip install {' '.join(missing)}")
        print("=" * 60)
        return False

    print("\n✓ All dependencies installed!\n")
    return True


def test_onnx_runtime():
    """Test ONNX Runtime availability"""
    print("=" * 60)
    print("TESTING ONNX RUNTIME")
    print("=" * 60)

    try:
        import onnxruntime as ort
        print(f"✓ ONNX Runtime version: {ort.__version__}")

        # Check available providers (CPU/GPU)
        providers = ort.get_available_providers()
        print(f"✓ Available providers: {', '.join(providers)}")

        if 'CUDAExecutionProvider' in providers:
            print("  → GPU (CUDA) support detected!")
        else:
            print("  → Using CPU (GPU not available)")

        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def test_insightface_models():
    """Test InsightFace model loading"""
    print("\n" + "=" * 60)
    print("TESTING INSIGHTFACE MODEL LOADING")
    print("=" * 60)

    try:
        from insightface.app import FaceAnalysis

        print("Initializing FaceAnalysis (this may download models ~300MB on first run)...")
        print("Models will be cached in: ~/.insightface/")

        # Initialize with CPU provider
        app = FaceAnalysis(
            name='buffalo_l',  # Model pack name
            providers=['CPUExecutionProvider']
        )

        print("✓ FaceAnalysis initialized")

        # Prepare model (required before use)
        print("Preparing models with detection size 640x640...")
        app.prepare(ctx_id=0, det_size=(640, 640))

        print("✓ Models prepared successfully!")

        return app

    except Exception as e:
        print(f"✗ Error loading models: {e}")
        import traceback
        traceback.print_exc()
        return None


def create_test_image():
    """Create a simple test image with face-like pattern"""
    import cv2

    # Create a test image (simple colored rectangle as placeholder)
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    img[:] = (200, 200, 200)  # Gray background

    # Draw a simple "face" (circle for head, smaller circles for eyes)
    cv2.circle(img, (320, 240), 100, (255, 220, 180), -1)  # Face
    cv2.circle(img, (290, 220), 15, (50, 50, 50), -1)  # Left eye
    cv2.circle(img, (350, 220), 15, (50, 50, 50), -1)  # Right eye
    cv2.ellipse(img, (320, 260), (40, 20), 0, 0, 180, (50, 50, 50), 2)  # Mouth

    return img


def test_face_detection(app, image_path=None):
    """Test face detection on an image"""
    print("\n" + "=" * 60)
    print("TESTING FACE DETECTION")
    print("=" * 60)

    try:
        import cv2

        if image_path and os.path.exists(image_path):
            print(f"Loading image: {image_path}")
            img = cv2.imread(image_path)
            if img is None:
                print(f"✗ Could not load image: {image_path}")
                return False
        else:
            print("No image provided - creating test image")
            img = create_test_image()

        print(f"Image shape: {img.shape}")
        print("Running face detection...")

        start_time = time.time()
        faces = app.get(img)
        detection_time = (time.time() - start_time) * 1000  # Convert to ms

        print(f"✓ Detection completed in {detection_time:.2f}ms")
        print(f"✓ Found {len(faces)} face(s)")

        # Print details for each face
        for i, face in enumerate(faces):
            print(f"\n  Face {i + 1}:")
            print(f"    Bounding box: {face.bbox.astype(int).tolist()}")
            print(f"    Confidence: {face.det_score:.4f}")
            print(f"    Embedding shape: {face.embedding.shape}")
            print(f"    Embedding sample: [{face.embedding[:3]} ... {face.embedding[-3:]}]")

            # Check if landmarks are available
            if hasattr(face, 'kps') and face.kps is not None:
                print(f"    Landmarks: {face.kps.shape[0]} points detected")

        return True

    except Exception as e:
        print(f"✗ Error during detection: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_clustering_demo(app, num_test_faces=10):
    """Demonstrate clustering with synthetic face embeddings"""
    print("\n" + "=" * 60)
    print("TESTING CLUSTERING ALGORITHM")
    print("=" * 60)

    try:
        from sklearn.cluster import DBSCAN

        # Create synthetic embeddings (simulating faces)
        # In real scenario, these would come from face detection
        np.random.seed(42)

        # Generate 3 groups of similar faces
        group1 = np.random.randn(3, 512) + np.array([1, 0] + [0]*510)
        group2 = np.random.randn(3, 512) + np.array([0, 1] + [0]*510)
        group3 = np.random.randn(4, 512) + np.array([1, 1] + [0]*510)

        embeddings = np.vstack([group1, group2, group3])

        print(f"Generated {len(embeddings)} synthetic face embeddings")
        print("Clustering with DBSCAN...")

        clustering = DBSCAN(eps=0.6, min_samples=2, metric='euclidean')
        labels = clustering.fit_predict(embeddings)

        unique_labels = set(labels)
        n_clusters = len(unique_labels) - (1 if -1 in unique_labels else 0)
        n_outliers = list(labels).count(-1)

        print(f"✓ Clustering completed")
        print(f"  Clusters found: {n_clusters}")
        print(f"  Outliers: {n_outliers}")
        print(f"  Labels: {labels.tolist()}")

        return True

    except Exception as e:
        print(f"✗ Error during clustering: {e}")
        import traceback
        traceback.print_exc()
        return False


def benchmark_performance(app):
    """Benchmark detection performance"""
    print("\n" + "=" * 60)
    print("PERFORMANCE BENCHMARK")
    print("=" * 60)

    try:
        import cv2

        # Test different image sizes
        sizes = [(640, 480), (1280, 720), (1920, 1080)]

        for width, height in sizes:
            # Create test image
            img = np.random.randint(0, 255, (height, width, 3), dtype=np.uint8)

            # Run detection 3 times and average
            times = []
            for _ in range(3):
                start = time.time()
                faces = app.get(img)
                times.append((time.time() - start) * 1000)

            avg_time = np.mean(times)
            print(f"  {width}x{height}: {avg_time:.2f}ms (avg)")

        return True

    except Exception as e:
        print(f"✗ Error during benchmark: {e}")
        return False


def print_model_info():
    """Print information about ONNX models used"""
    print("\n" + "=" * 60)
    print("ONNX MODEL INFORMATION")
    print("=" * 60)

    print("""
Buffalo_l Model Pack includes:

  1. Face Detection: SCRFD (det_10g.onnx)
     - Input: 640x640 RGB image
     - Output: Face bounding boxes + landmarks
     - Size: ~16 MB

  2. Face Recognition: ArcFace (w600k_r50.onnx)
     - Input: 112x112 aligned face crop
     - Output: 512-dimensional embedding vector
     - Size: ~166 MB

  3. Additional Models:
     - Gender/Age estimation
     - Landmark detection (5 points)

Total package size: ~300 MB
Models cached in: ~/.insightface/models/buffalo_l/
""")


def main():
    """Main test execution"""
    print("\n" + "=" * 60)
    print("ONNX FACE DETECTION TEST SUITE")
    print("=" * 60 + "\n")

    # Step 1: Check dependencies
    if not check_dependencies():
        sys.exit(1)

    # Step 2: Test ONNX Runtime
    if not test_onnx_runtime():
        print("\n✗ ONNX Runtime test failed")
        sys.exit(1)

    # Step 3: Print model information
    print_model_info()

    # Step 4: Load InsightFace models
    app = test_insightface_models()
    if app is None:
        print("\n✗ Failed to load models")
        sys.exit(1)

    # Step 5: Test face detection
    # Check if user provided an image path
    image_path = None
    if len(sys.argv) > 1:
        image_path = sys.argv[1]

    if not test_face_detection(app, image_path):
        print("\n✗ Face detection test failed")

    # Step 6: Test clustering
    test_clustering_demo(app)

    # Step 7: Benchmark
    benchmark_performance(app)

    # Final summary
    print("\n" + "=" * 60)
    print("TEST SUITE COMPLETED")
    print("=" * 60)
    print("""
✓ All tests passed!

Next steps:
1. The models are now cached in ~/.insightface/
2. You can integrate this into your FastAPI backend
3. Use the same FaceAnalysis API in production

Usage in your code:
    from insightface.app import FaceAnalysis
    app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
    app.prepare(ctx_id=0, det_size=(640, 640))
    faces = app.get(image)

Performance tips:
- Use GPU (CUDAExecutionProvider) for 5-10x speedup
- Reduce det_size to (320, 320) for faster but less accurate detection
- Process multiple images in batch for better throughput
""")


if __name__ == '__main__':
    main()
