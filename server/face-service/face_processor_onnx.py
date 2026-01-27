#!/usr/bin/env python3
"""
ONNX-based Face Detection and Recognition Service
Drop-in replacement for face_processor.py using InsightFace + ONNX
"""

import json
import sys
import os
import sqlite3
import numpy as np
from pathlib import Path
from PIL import Image
import argparse
import cv2
from insightface.app import FaceAnalysis
import pillow_heif

# Register HEIC opener with Pillow
pillow_heif.register_heif_opener()

# Supported image extensions
SUPPORTED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'}


class FaceProcessorONNX:
    def __init__(self, db_path: str, photos_dir: str, min_confidence: float = 0.95,
                 execution_provider: str = None, det_size: int = None):
        self.db_path = db_path
        self.photos_dir = photos_dir
        self.min_confidence = min_confidence

        # Get execution provider from env or parameter (default: CPU)
        self.execution_provider = execution_provider or os.getenv('ONNX_EXECUTION_PROVIDER', 'CPUExecutionProvider')

        # Get detection size from env or parameter (default: 640 for accuracy, 320 for speed)
        default_det_size = int(os.getenv('ONNX_DET_SIZE', '640'))
        self.det_size = det_size or default_det_size

        self.face_app = None
        self.setup_database()
        self.initialize_model()

    def initialize_model(self):
        """Initialize InsightFace ONNX model with configurable providers"""
        print("Initializing ONNX face detection model...", file=sys.stderr)
        print(f"  Provider: {self.execution_provider}", file=sys.stderr)
        print(f"  Detection size: {self.det_size}x{self.det_size}", file=sys.stderr)

        # Set up providers based on execution provider choice
        if self.execution_provider == 'CUDAExecutionProvider':
            providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']  # GPU with CPU fallback
        else:
            providers = ['CPUExecutionProvider']

        self.face_app = FaceAnalysis(
            name='buffalo_l',
            providers=providers
        )
        self.face_app.prepare(ctx_id=0, det_size=(self.det_size, self.det_size))
        print("ONNX model initialized successfully", file=sys.stderr)

    def setup_database(self):
        """Initialize SQLite database with required tables"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.executescript('''
            CREATE TABLE IF NOT EXISTS faces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                photo_filename TEXT NOT NULL,
                face_index INTEGER NOT NULL,
                bounding_box TEXT NOT NULL,
                encoding BLOB NOT NULL,
                person_id INTEGER,
                confidence REAL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (person_id) REFERENCES persons(id)
            );

            CREATE TABLE IF NOT EXISTS persons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                representative_face_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS processing_status (
                photo_filename TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                faces_count INTEGER DEFAULT 0,
                processed_at DATETIME,
                error_message TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_faces_photo ON faces(photo_filename);
            CREATE INDEX IF NOT EXISTS idx_faces_person ON faces(person_id);
            CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(name);
        ''')

        conn.commit()
        conn.close()

    def get_unprocessed_photos(self) -> list:
        """Get list of photos that haven't been processed yet"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Get all processed photos
        cursor.execute("SELECT photo_filename FROM processing_status WHERE status = 'completed'")
        processed = set(row[0] for row in cursor.fetchall())
        conn.close()

        # Get all photos in directory
        all_photos = []
        for file in os.listdir(self.photos_dir):
            ext = os.path.splitext(file)[1].lower()
            if ext in SUPPORTED_EXTENSIONS:
                if file not in processed:
                    all_photos.append(file)

        return all_photos

    def load_image(self, filename: str) -> np.ndarray:
        """Load image file using OpenCV"""
        filepath = os.path.join(self.photos_dir, filename)

        # Use OpenCV to load image (supports most formats)
        img = cv2.imread(filepath)

        if img is None:
            # Try with PIL for formats like HEIC
            try:
                pil_img = Image.open(filepath)
                pil_img = pil_img.convert('RGB')
                img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
            except Exception as e:
                raise Exception(f"Failed to load image {filename}: {e}")

        return img

    def detect_faces(self, filename: str) -> list:
        """Detect faces using ONNX model"""
        try:
            image = self.load_image(filename)

            # Resize large images to speed up processing
            height, width = image.shape[:2]
            max_dimension = 1500
            scale_back = 1

            if max(height, width) > max_dimension:
                scale = max_dimension / max(height, width)
                new_width = int(width * scale)
                new_height = int(height * scale)
                image_resized = cv2.resize(image, (new_width, new_height))
                scale_back = 1 / scale
            else:
                image_resized = image

            # Detect faces using ONNX
            detected_faces = self.face_app.get(image_resized)

            faces = []
            for i, face in enumerate(detected_faces):
                # Filter out blurred/low-quality faces based on confidence threshold
                if face.det_score < self.min_confidence:
                    continue

                # Get bounding box and scale back to original size
                bbox = face.bbox.astype(int)
                x1, y1, x2, y2 = bbox

                faces.append({
                    'face_index': i,
                    'bounding_box': {
                        'left': int(x1 * scale_back),
                        'top': int(y1 * scale_back),
                        'right': int(x2 * scale_back),
                        'bottom': int(y2 * scale_back)
                    },
                    'encoding': face.embedding.tobytes(),  # 512-D embedding
                    'confidence': float(face.det_score)
                })

            return faces

        except Exception as e:
            print(f"Error processing {filename}: {str(e)}", file=sys.stderr)
            return []

    def save_faces(self, filename: str, faces: list):
        """Save detected faces to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Delete existing faces for this photo (in case of re-scan)
        cursor.execute("DELETE FROM faces WHERE photo_filename = ?", (filename,))

        # Insert new faces
        for face in faces:
            cursor.execute('''
                INSERT INTO faces (photo_filename, face_index, bounding_box, encoding, confidence)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                filename,
                face['face_index'],
                json.dumps(face['bounding_box']),
                face['encoding'],
                face.get('confidence', 0.0)
            ))

        # Update processing status
        cursor.execute('''
            INSERT OR REPLACE INTO processing_status (photo_filename, status, faces_count, processed_at)
            VALUES (?, 'completed', ?, datetime('now'))
        ''', (filename, len(faces)))

        conn.commit()
        conn.close()

    def mark_failed(self, filename: str, error: str):
        """Mark a photo as failed to process"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO processing_status (photo_filename, status, error_message, processed_at)
            VALUES (?, 'failed', ?, datetime('now'))
        ''', (filename, error))
        conn.commit()
        conn.close()

    def scan_all(self, progress_callback=None):
        """Scan all unprocessed photos for faces"""
        photos = self.get_unprocessed_photos()
        total = len(photos)

        for i, filename in enumerate(photos):
            if progress_callback:
                progress_callback({
                    'status': 'scanning',
                    'total': total,
                    'processed': i,
                    'currentPhoto': filename
                })

            try:
                faces = self.detect_faces(filename)
                self.save_faces(filename, faces)
                print(json.dumps({
                    'status': 'scanning',
                    'total': total,
                    'processed': i + 1,
                    'currentPhoto': filename,
                    'facesFound': len(faces)
                }))
                sys.stdout.flush()
            except Exception as e:
                self.mark_failed(filename, str(e))
                print(json.dumps({
                    'status': 'scanning',
                    'total': total,
                    'processed': i + 1,
                    'currentPhoto': filename,
                    'error': str(e)
                }))
                sys.stdout.flush()

        print(json.dumps({'status': 'completed', 'total': total, 'processed': total}))
        sys.stdout.flush()


def main():
    parser = argparse.ArgumentParser(description='ONNX Face Detection Service')
    parser.add_argument('--photos-dir', required=True, help='Directory containing photos')
    parser.add_argument('--db-path', required=True, help='Path to SQLite database')
    parser.add_argument('--action', default='scan', choices=['scan', 'detect-single'],
                        help='Action to perform')
    parser.add_argument('--filename', help='Single filename for detect-single action')
    parser.add_argument('--min-confidence', type=float, default=0.95,
                        help='Minimum confidence threshold for face detection (0.0-1.0). Default: 0.95')
    parser.add_argument('--execution-provider',
                        choices=['CPUExecutionProvider', 'CUDAExecutionProvider'],
                        help='ONNX execution provider. Default: CPUExecutionProvider (or ONNX_EXECUTION_PROVIDER env var)')
    parser.add_argument('--det-size', type=int,
                        help='Detection size (320=fast, 640=accurate). Default: 640 (or ONNX_DET_SIZE env var)')

    args = parser.parse_args()

    processor = FaceProcessorONNX(
        args.db_path,
        args.photos_dir,
        args.min_confidence,
        args.execution_provider,
        args.det_size
    )

    if args.action == 'scan':
        processor.scan_all()
    elif args.action == 'detect-single' and args.filename:
        faces = processor.detect_faces(args.filename)
        print(json.dumps({'faces': len(faces), 'filename': args.filename}))


if __name__ == '__main__':
    main()
