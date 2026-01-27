#!/usr/bin/env python3
"""
Face Detection and Recognition Service
Processes photos to detect faces and generate face encodings
"""

import face_recognition
import json
import sys
import os
import sqlite3
import numpy as np
from pathlib import Path
from PIL import Image
import io
import argparse

# Supported image extensions
SUPPORTED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'}

class FaceProcessor:
    def __init__(self, db_path: str, photos_dir: str):
        self.db_path = db_path
        self.photos_dir = photos_dir
        self.setup_database()

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
        """Load image file, handling HEIC conversion"""
        filepath = os.path.join(self.photos_dir, filename)
        ext = os.path.splitext(filename)[1].lower()

        if ext == '.heic':
            # For HEIC, we need pillow-heif or convert via the server
            # For now, skip HEIC files and let the server handle conversion
            try:
                import pillow_heif
                pillow_heif.register_heif_opener()
                img = Image.open(filepath)
                img = img.convert('RGB')
                return np.array(img)
            except ImportError:
                # If pillow-heif not available, try loading anyway
                return face_recognition.load_image_file(filepath)

        return face_recognition.load_image_file(filepath)

    def detect_faces(self, filename: str) -> list:
        """Detect faces in an image and return encodings"""
        try:
            image = self.load_image(filename)

            # Resize large images to speed up processing
            height, width = image.shape[:2]
            max_dimension = 1500
            if max(height, width) > max_dimension:
                scale = max_dimension / max(height, width)
                new_width = int(width * scale)
                new_height = int(height * scale)
                image = np.array(Image.fromarray(image).resize((new_width, new_height)))
                scale_back = 1 / scale
            else:
                scale_back = 1

            # Detect face locations using HOG (faster) or CNN (more accurate)
            face_locations = face_recognition.face_locations(image, model="hog")
            face_encodings = face_recognition.face_encodings(image, face_locations)

            faces = []
            for i, (loc, enc) in enumerate(zip(face_locations, face_encodings)):
                # Scale bounding box back to original size
                top, right, bottom, left = loc
                faces.append({
                    'face_index': i,
                    'bounding_box': {
                        'top': int(top * scale_back),
                        'right': int(right * scale_back),
                        'bottom': int(bottom * scale_back),
                        'left': int(left * scale_back)
                    },
                    'encoding': enc.tobytes()
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
                INSERT INTO faces (photo_filename, face_index, bounding_box, encoding)
                VALUES (?, ?, ?, ?)
            ''', (
                filename,
                face['face_index'],
                json.dumps(face['bounding_box']),
                face['encoding']
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
    parser = argparse.ArgumentParser(description='Face Detection Service')
    parser.add_argument('--photos-dir', required=True, help='Directory containing photos')
    parser.add_argument('--db-path', required=True, help='Path to SQLite database')
    parser.add_argument('--action', default='scan', choices=['scan', 'detect-single'],
                        help='Action to perform')
    parser.add_argument('--filename', help='Single filename for detect-single action')

    args = parser.parse_args()

    processor = FaceProcessor(args.db_path, args.photos_dir)

    if args.action == 'scan':
        processor.scan_all()
    elif args.action == 'detect-single' and args.filename:
        faces = processor.detect_faces(args.filename)
        print(json.dumps({'faces': len(faces), 'filename': args.filename}))


if __name__ == '__main__':
    main()
