#!/usr/bin/env python3
"""
Photo Quality Analyzer for Smart Memories
Detects blurry, poorly lit, and low-quality photos using OpenCV

Uses classical computer vision algorithms:
- Laplacian variance for blur detection
- Mean pixel value for brightness
- Standard deviation for contrast
"""

import argparse
import json
import sqlite3
import sys
from pathlib import Path
from typing import Dict, Optional

import cv2
import numpy as np
from PIL import Image
import pillow_heif


# Register HEIC plugin
pillow_heif.register_heif_opener()


class PhotoQualityAnalyzer:
    """Analyzes photo quality metrics for Smart Memories filtering"""

    # Quality thresholds
    BLUR_THRESHOLD = 100.0      # Laplacian variance threshold
    DARK_THRESHOLD = 60         # Average brightness threshold (0-255)
    BRIGHT_THRESHOLD = 200      # Overexposure threshold
    LOW_CONTRAST_THRESHOLD = 30 # Standard deviation threshold

    def __init__(self, db_path: str):
        self.db_path = db_path
        self.init_database()

    def init_database(self):
        """Create photo_quality table if it doesn't exist"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS photo_quality (
                photo_filename TEXT PRIMARY KEY,
                blur_score REAL NOT NULL,
                brightness_score REAL NOT NULL,
                contrast_score REAL NOT NULL,
                quality_score REAL NOT NULL,
                is_blurry INTEGER NOT NULL,
                is_dark INTEGER NOT NULL,
                is_overexposed INTEGER NOT NULL,
                is_low_contrast INTEGER NOT NULL,
                assessed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        conn.commit()
        conn.close()

    def load_image(self, image_path: str) -> Optional[np.ndarray]:
        """Load image and convert to numpy array (handles HEIC)"""
        try:
            # Use PIL to load (supports HEIC with pillow-heif)
            pil_image = Image.open(image_path)

            # Convert to RGB if needed
            if pil_image.mode != 'RGB':
                pil_image = pil_image.convert('RGB')

            # Convert PIL to numpy array (RGB)
            img_array = np.array(pil_image)

            # Convert RGB to BGR for OpenCV
            img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)

            return img_bgr
        except Exception as e:
            print(f"Error loading image {image_path}: {e}", file=sys.stderr)
            return None

    def calculate_blur_score(self, image: np.ndarray) -> float:
        """
        Calculate blur score using Laplacian variance

        Algorithm: Applies Laplacian operator (edge detection)
        - Sharp images have strong edges → high variance (200-500+)
        - Blurry images have weak edges → low variance (0-100)

        Returns: Blur score (higher = sharper)
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        return float(laplacian_var)

    def calculate_brightness_score(self, image: np.ndarray) -> float:
        """
        Calculate average brightness (0-255)

        Algorithm: Mean of all pixel values
        - 0 = black
        - 255 = white
        - Optimal: 100-150

        Returns: Brightness score
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        return float(np.mean(gray))

    def calculate_contrast_score(self, image: np.ndarray) -> float:
        """
        Calculate contrast using standard deviation

        Algorithm: Measures pixel value variation
        - High std dev = good contrast/detail
        - Low std dev = flat/washed out

        Returns: Contrast score (higher = more contrast)
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        return float(np.std(gray))

    def calculate_overall_quality(
        self,
        blur_score: float,
        brightness_score: float,
        contrast_score: float
    ) -> float:
        """
        Calculate overall quality score (0-100)

        Formula:
        quality = (sharpness × 0.5 + brightness × 0.3 + contrast × 0.2) × 100

        Weights:
        - Sharpness: 50% (most important - blurry photos are unusable)
        - Brightness: 30% (exposure matters)
        - Contrast: 20% (detail level)

        Returns: Overall quality score (0-100)
        """
        # Normalize blur score (0-1, capped at 500)
        sharpness = min(blur_score / 500.0, 1.0)

        # Normalize brightness (optimal around 100-150)
        if brightness_score < 60:
            brightness = brightness_score / 60.0
        elif brightness_score > 200:
            brightness = 1.0 - ((brightness_score - 200) / 55.0)
        else:
            brightness = 1.0
        brightness = max(0.0, min(1.0, brightness))

        # Normalize contrast (0-1, optimal > 50)
        contrast = min(contrast_score / 80.0, 1.0)

        # Weighted average
        quality = (
            sharpness * 0.5 +      # 50% weight on sharpness
            brightness * 0.3 +     # 30% weight on brightness
            contrast * 0.2         # 20% weight on contrast
        ) * 100.0

        return round(quality, 2)

    def analyze_photo(self, image_path: str) -> Optional[Dict]:
        """Analyze a single photo and return quality metrics"""
        image = self.load_image(image_path)

        if image is None:
            return None

        # Calculate metrics
        blur_score = self.calculate_blur_score(image)
        brightness_score = self.calculate_brightness_score(image)
        contrast_score = self.calculate_contrast_score(image)

        # Determine flags
        is_blurry = blur_score < self.BLUR_THRESHOLD
        is_dark = brightness_score < self.DARK_THRESHOLD
        is_overexposed = brightness_score > self.BRIGHT_THRESHOLD
        is_low_contrast = contrast_score < self.LOW_CONTRAST_THRESHOLD

        # Calculate overall quality
        quality_score = self.calculate_overall_quality(
            blur_score, brightness_score, contrast_score
        )

        return {
            'blur_score': round(blur_score, 2),
            'brightness_score': round(brightness_score, 2),
            'contrast_score': round(contrast_score, 2),
            'quality_score': quality_score,
            'is_blurry': is_blurry,
            'is_dark': is_dark,
            'is_overexposed': is_overexposed,
            'is_low_contrast': is_low_contrast
        }

    def save_quality_metrics(self, filename: str, metrics: Dict):
        """Save quality metrics to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            INSERT OR REPLACE INTO photo_quality
            (photo_filename, blur_score, brightness_score, contrast_score,
             quality_score, is_blurry, is_dark, is_overexposed, is_low_contrast)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            filename,
            metrics['blur_score'],
            metrics['brightness_score'],
            metrics['contrast_score'],
            metrics['quality_score'],
            1 if metrics['is_blurry'] else 0,
            1 if metrics['is_dark'] else 0,
            1 if metrics['is_overexposed'] else 0,
            1 if metrics['is_low_contrast'] else 0
        ))

        conn.commit()
        conn.close()

    def analyze_all_photos(self, photos_dir: str):
        """Analyze all photos in directory"""
        photos_path = Path(photos_dir)

        # Supported extensions
        extensions = ['.jpg', '.jpeg', '.png', '.heic', '.gif', '.webp']

        # Get all photos
        all_photos = []
        for ext in extensions:
            all_photos.extend(photos_path.glob(f'*{ext}'))
            all_photos.extend(photos_path.glob(f'*{ext.upper()}'))

        total = len(all_photos)

        print(json.dumps({
            'status': 'started',
            'total': total,
            'processed': 0
        }), flush=True)

        processed = 0
        for photo_path in all_photos:
            filename = photo_path.name

            try:
                # Analyze photo
                metrics = self.analyze_photo(str(photo_path))

                if metrics:
                    # Save to database
                    self.save_quality_metrics(filename, metrics)
                    processed += 1

                    # Report progress every 10 photos
                    if processed % 10 == 0:
                        print(json.dumps({
                            'status': 'processing',
                            'total': total,
                            'processed': processed,
                            'currentPhoto': filename
                        }), flush=True)

            except Exception as e:
                print(f"Error processing {filename}: {e}", file=sys.stderr)
                continue

        # Final status
        print(json.dumps({
            'status': 'completed',
            'total': total,
            'processed': processed
        }), flush=True)

    def analyze_single_photo(self, photos_dir: str, filename: str):
        """Analyze a single photo by filename"""
        photo_path = Path(photos_dir) / filename

        if not photo_path.exists():
            print(f"Error: Photo not found: {photo_path}", file=sys.stderr)
            return

        metrics = self.analyze_photo(str(photo_path))

        if metrics:
            self.save_quality_metrics(filename, metrics)
            print(json.dumps({
                'status': 'completed',
                'filename': filename,
                'metrics': metrics
            }), flush=True)


def main():
    parser = argparse.ArgumentParser(description='Analyze photo quality for Smart Memories')
    parser.add_argument('--photos-dir', required=True, help='Directory containing photos')
    parser.add_argument('--db-path', required=True, help='Path to SQLite database')
    parser.add_argument('--action', default='analyze-all', choices=['analyze-all', 'analyze-single'],
                        help='Action to perform')
    parser.add_argument('--filename', help='Single photo filename (for analyze-single)')

    args = parser.parse_args()

    analyzer = PhotoQualityAnalyzer(args.db_path)

    if args.action == 'analyze-all':
        analyzer.analyze_all_photos(args.photos_dir)
    elif args.action == 'analyze-single':
        if not args.filename:
            print("Error: --filename required for analyze-single", file=sys.stderr)
            sys.exit(1)
        analyzer.analyze_single_photo(args.photos_dir, args.filename)


if __name__ == '__main__':
    main()
