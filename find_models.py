#!/usr/bin/env python3
"""
Find AI Model Locations on Your Device
This script shows where all the AI models are cached
"""

import os
import sys
from pathlib import Path

def get_folder_size(folder_path):
    """Calculate total size of a folder"""
    total_size = 0
    try:
        for dirpath, dirnames, filenames in os.walk(folder_path):
            for filename in filenames:
                filepath = os.path.join(dirpath, filename)
                try:
                    total_size += os.path.getsize(filepath)
                except:
                    pass
    except:
        pass
    return total_size

def format_size(bytes_size):
    """Format bytes to human-readable size"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_size < 1024.0:
            return f"{bytes_size:.2f} {unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.2f} TB"

print("=" * 80)
print("AI MODEL LOCATIONS ON YOUR DEVICE")
print("=" * 80)
print()

# 1. CLIP Model (OpenCLIP)
print("1. CLIP Model (ViT-B-32)")
print("-" * 80)
try:
    import torch
    # OpenCLIP uses torch hub cache
    torch_cache = Path.home() / '.cache' / 'torch'
    if torch_cache.exists():
        print(f"[OK] Location: {torch_cache}")

        # Look for checkpoints
        hub_dir = torch_cache / 'hub' / 'checkpoints'
        if hub_dir.exists():
            print(f"   Models: {hub_dir}")
            files = list(hub_dir.glob('*.pt')) + list(hub_dir.glob('*.pth'))
            for f in files:
                size = format_size(f.stat().st_size)
                print(f"   - {f.name} ({size})")

        # Check Hugging Face cache (alternative location)
        hf_cache = Path.home() / '.cache' / 'huggingface'
        if hf_cache.exists():
            print(f"   HuggingFace cache: {hf_cache}")
            hub_cache = hf_cache / 'hub'
            if hub_cache.exists():
                total_size = get_folder_size(hub_cache)
                print(f"   Total HF models size: {format_size(total_size)}")
    else:
        print(f"[!] Not found at default location: {torch_cache}")

except ImportError:
    print("[X] PyTorch not installed")
print()

# 2. PaddleOCR Model
print("2. PaddleOCR Model")
print("-" * 80)
try:
    # PaddleOCR caches in user home directory
    paddle_cache = Path.home() / '.paddleocr'
    if paddle_cache.exists():
        print(f"[OK] Location: {paddle_cache}")

        # List model files
        for root, dirs, files in os.walk(paddle_cache):
            for file in files:
                if file.endswith(('.pdparams', '.pdiparams', '.nb')):
                    filepath = Path(root) / file
                    size = format_size(filepath.stat().st_size)
                    rel_path = filepath.relative_to(paddle_cache)
                    print(f"   - {rel_path} ({size})")

        total_size = get_folder_size(paddle_cache)
        print(f"   Total size: {format_size(total_size)}")
    else:
        # Alternative location (Windows)
        alt_cache = Path.home() / 'AppData' / 'Local' / 'paddleocr'
        if alt_cache.exists():
            print(f"[OK] Location: {alt_cache}")
            total_size = get_folder_size(alt_cache)
            print(f"   Total size: {format_size(total_size)}")
        else:
            print(f"[!] Not found at: {paddle_cache}")
            print(f"[!] Also not at: {alt_cache}")

except Exception as e:
    print(f"[X] Error checking PaddleOCR: {e}")
print()

# 3. Sentence Transformers Model
print("3. Sentence Transformers (all-MiniLM-L6-v2)")
print("-" * 80)
try:
    from sentence_transformers import SentenceTransformer

    # Get cache directory
    st_cache = Path.home() / '.cache' / 'torch' / 'sentence_transformers'
    if st_cache.exists():
        print(f"[OK] Location: {st_cache}")

        # Look for the specific model
        model_name = "sentence-transformers_all-MiniLM-L6-v2"
        for item in st_cache.iterdir():
            if item.is_dir() and 'MiniLM' in item.name:
                print(f"   Model: {item.name}")
                total_size = get_folder_size(item)
                print(f"   Size: {format_size(total_size)}")

                # List model files
                for file in item.glob('*'):
                    if file.is_file():
                        size = format_size(file.stat().st_size)
                        print(f"   - {file.name} ({size})")
    else:
        print(f"[!] Not found at: {st_cache}")

except ImportError:
    print("[X] Sentence Transformers not installed")
print()

# 4. Check total cache sizes
print("=" * 80)
print("TOTAL CACHE SIZES")
print("=" * 80)

cache_dirs = [
    ("PyTorch/CLIP Cache", Path.home() / '.cache' / 'torch'),
    ("HuggingFace Hub", Path.home() / '.cache' / 'huggingface'),
    ("PaddleOCR Cache", Path.home() / '.paddleocr'),
]

total_all = 0
for name, cache_dir in cache_dirs:
    if cache_dir.exists():
        size = get_folder_size(cache_dir)
        total_all += size
        print(f"{name:30s}: {format_size(size):>12s} - {cache_dir}")

print(f"\n{'TOTAL AI MODELS':30s}: {format_size(total_all):>12s}")
print()

# 5. Windows-specific locations
print("=" * 80)
print("WINDOWS-SPECIFIC LOCATIONS (if applicable)")
print("=" * 80)
user_profile = os.environ.get('USERPROFILE', '')
if user_profile:
    win_caches = [
        Path(user_profile) / '.cache',
        Path(user_profile) / 'AppData' / 'Local' / 'torch',
        Path(user_profile) / 'AppData' / 'Local' / 'huggingface',
    ]

    for cache in win_caches:
        if cache.exists():
            size = get_folder_size(cache)
            print(f"✅ {cache}")
            print(f"   Size: {format_size(size)}")
print()

# 6. Model download commands
print("=" * 80)
print("HOW TO MANUALLY DOWNLOAD/VERIFY MODELS")
print("=" * 80)
print("""
To manually verify or re-download models, run these Python commands:

1. CLIP Model:
   python -c "import open_clip; open_clip.create_model_and_transforms('ViT-B-32', 'openai')"

2. PaddleOCR:
   python -c "from paddleocr import PaddleOCR; PaddleOCR(lang='en')"

3. Sentence Transformers:
   python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"
""")

print("=" * 80)
print("✅ Model location check complete!")
print("=" * 80)
