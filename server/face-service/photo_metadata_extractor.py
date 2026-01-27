#!/usr/bin/env python3
"""
Photo Metadata Extractor for Smart Memories
Extracts EXIF data (date taken, camera info, GPS) from photos

Essential for:
- "On This Day" memories (date matching)
- Seasonal memories (summer, winter, etc.)
- Time-based filtering
"""

import argparse
import json
import sqlite3
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional, Tuple

from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
import pillow_heif


# Register HEIC plugin
pillow_heif.register_heif_opener()


class PhotoMetadataExtractor:
    """Extracts EXIF metadata from photos"""

    def __init__(self, db_path: str):
        self.db_path = db_path
        self.init_database()

    def init_database(self):
        """Create photo_metadata table if it doesn't exist"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS photo_metadata (
                photo_filename TEXT PRIMARY KEY,
                date_taken DATETIME,
                date_taken_year INTEGER,
                date_taken_month INTEGER,
                date_taken_day INTEGER,
                date_taken_season TEXT,
                file_size INTEGER,
                width INTEGER,
                height INTEGER,
                orientation TEXT,
                camera_make TEXT,
                camera_model TEXT,
                has_gps INTEGER DEFAULT 0,
                latitude REAL,
                longitude REAL,
                metadata_extracted_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Create indexes for fast queries
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_photo_metadata_date ON photo_metadata(date_taken)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_photo_metadata_year_month_day ON photo_metadata(date_taken_year, date_taken_month, date_taken_day)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_photo_metadata_season ON photo_metadata(date_taken_season)')

        conn.commit()
        conn.close()

    def calculate_season(self, month: int, day: int) -> str:
        """
        Calculate season from month and day

        Seasons (Northern Hemisphere):
        - Spring: March 20 - June 20
        - Summer: June 21 - September 21
        - Fall: September 22 - December 20
        - Winter: December 21 - March 19
        """
        if (month == 3 and day >= 20) or (month in [4, 5]) or (month == 6 and day <= 20):
            return 'spring'
        elif (month == 6 and day >= 21) or (month in [7, 8]) or (month == 9 and day <= 21):
            return 'summer'
        elif (month == 9 and day >= 22) or (month in [10, 11]) or (month == 12 and day <= 20):
            return 'fall'
        else:
            return 'winter'

    def get_orientation(self, width: int, height: int) -> str:
        """Determine photo orientation"""
        if width > height:
            return 'landscape'
        elif height > width:
            return 'portrait'
        else:
            return 'square'

    def parse_gps_coordinates(self, gps_info: dict) -> Optional[Tuple[float, float]]:
        """
        Parse GPS coordinates from EXIF data

        Returns: (latitude, longitude) or None
        """
        try:
            # Get GPS latitude
            gps_latitude = gps_info.get(2)  # GPSLatitude
            gps_latitude_ref = gps_info.get(1)  # GPSLatitudeRef (N/S)

            # Get GPS longitude
            gps_longitude = gps_info.get(4)  # GPSLongitude
            gps_longitude_ref = gps_info.get(3)  # GPSLongitudeRef (E/W)

            if not all([gps_latitude, gps_latitude_ref, gps_longitude, gps_longitude_ref]):
                return None

            # Convert to decimal degrees
            def to_decimal(coord):
                degrees = float(coord[0])
                minutes = float(coord[1])
                seconds = float(coord[2])
                return degrees + (minutes / 60.0) + (seconds / 3600.0)

            latitude = to_decimal(gps_latitude)
            if gps_latitude_ref == 'S':
                latitude = -latitude

            longitude = to_decimal(gps_longitude)
            if gps_longitude_ref == 'W':
                longitude = -longitude

            return (latitude, longitude)

        except Exception as e:
            print(f"Error parsing GPS: {e}", file=sys.stderr)
            return None

    def extract_exif(self, image_path: str) -> Dict:
        """Extract EXIF metadata from image"""
        try:
            # Open image
            image = Image.open(image_path)

            # Get file stats
            file_stats = Path(image_path).stat()
            file_size = file_stats.st_size

            # Get image dimensions
            width, height = image.size

            # Initialize metadata
            metadata = {
                'date_taken': None,
                'date_taken_year': None,
                'date_taken_month': None,
                'date_taken_day': None,
                'date_taken_season': None,
                'file_size': file_size,
                'width': width,
                'height': height,
                'orientation': self.get_orientation(width, height),
                'camera_make': None,
                'camera_model': None,
                'has_gps': 0,
                'latitude': None,
                'longitude': None
            }

            # Extract EXIF data
            exif_data = image.getexif()

            if not exif_data:
                # No EXIF data - use file modification time
                date_taken = datetime.fromtimestamp(file_stats.st_mtime)
                metadata['date_taken'] = date_taken.strftime('%Y-%m-%d %H:%M:%S')
                metadata['date_taken_year'] = date_taken.year
                metadata['date_taken_month'] = date_taken.month
                metadata['date_taken_day'] = date_taken.day
                metadata['date_taken_season'] = self.calculate_season(date_taken.month, date_taken.day)
                return metadata

            # Parse EXIF tags
            for tag_id, value in exif_data.items():
                tag_name = TAGS.get(tag_id, tag_id)

                if tag_name == 'DateTimeOriginal' or tag_name == 'DateTime':
                    # Parse date (format: "2024:01:22 14:30:15")
                    try:
                        date_taken = datetime.strptime(str(value), '%Y:%m:%d %H:%M:%S')
                        metadata['date_taken'] = date_taken.strftime('%Y-%m-%d %H:%M:%S')
                        metadata['date_taken_year'] = date_taken.year
                        metadata['date_taken_month'] = date_taken.month
                        metadata['date_taken_day'] = date_taken.day
                        metadata['date_taken_season'] = self.calculate_season(date_taken.month, date_taken.day)
                    except Exception as e:
                        print(f"Error parsing date: {e}", file=sys.stderr)

                elif tag_name == 'Make':
                    metadata['camera_make'] = str(value)

                elif tag_name == 'Model':
                    metadata['camera_model'] = str(value)

                elif tag_name == 'GPSInfo':
                    # Parse GPS coordinates
                    gps_coords = self.parse_gps_coordinates(value)
                    if gps_coords:
                        metadata['has_gps'] = 1
                        metadata['latitude'], metadata['longitude'] = gps_coords

            # If no date found in EXIF, use file modification time
            if metadata['date_taken'] is None:
                date_taken = datetime.fromtimestamp(file_stats.st_mtime)
                metadata['date_taken'] = date_taken.strftime('%Y-%m-%d %H:%M:%S')
                metadata['date_taken_year'] = date_taken.year
                metadata['date_taken_month'] = date_taken.month
                metadata['date_taken_day'] = date_taken.day
                metadata['date_taken_season'] = self.calculate_season(date_taken.month, date_taken.day)

            return metadata

        except Exception as e:
            print(f"Error extracting EXIF from {image_path}: {e}", file=sys.stderr)
            return None

    def save_metadata(self, filename: str, metadata: Dict):
        """Save metadata to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            INSERT OR REPLACE INTO photo_metadata
            (photo_filename, date_taken, date_taken_year, date_taken_month, date_taken_day,
             date_taken_season, file_size, width, height, orientation,
             camera_make, camera_model, has_gps, latitude, longitude)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            filename,
            metadata['date_taken'],
            metadata['date_taken_year'],
            metadata['date_taken_month'],
            metadata['date_taken_day'],
            metadata['date_taken_season'],
            metadata['file_size'],
            metadata['width'],
            metadata['height'],
            metadata['orientation'],
            metadata['camera_make'],
            metadata['camera_model'],
            metadata['has_gps'],
            metadata['latitude'],
            metadata['longitude']
        ))

        conn.commit()
        conn.close()

    def extract_all_metadata(self, photos_dir: str):
        """Extract metadata from all photos in directory"""
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
                # Extract metadata
                metadata = self.extract_exif(str(photo_path))

                if metadata:
                    # Save to database
                    self.save_metadata(filename, metadata)
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

    def extract_single_metadata(self, photos_dir: str, filename: str):
        """Extract metadata from a single photo"""
        photo_path = Path(photos_dir) / filename

        if not photo_path.exists():
            print(f"Error: Photo not found: {photo_path}", file=sys.stderr)
            return

        metadata = self.extract_exif(str(photo_path))

        if metadata:
            self.save_metadata(filename, metadata)
            print(json.dumps({
                'status': 'completed',
                'filename': filename,
                'metadata': metadata
            }), flush=True)


def main():
    parser = argparse.ArgumentParser(description='Extract photo metadata for Smart Memories')
    parser.add_argument('--photos-dir', required=True, help='Directory containing photos')
    parser.add_argument('--db-path', required=True, help='Path to SQLite database')
    parser.add_argument('--action', default='extract-all', choices=['extract-all', 'extract-single'],
                        help='Action to perform')
    parser.add_argument('--filename', help='Single photo filename (for extract-single)')

    args = parser.parse_args()

    extractor = PhotoMetadataExtractor(args.db_path)

    if args.action == 'extract-all':
        extractor.extract_all_metadata(args.photos_dir)
    elif args.action == 'extract-single':
        if not args.filename:
            print("Error: --filename required for extract-single", file=sys.stderr)
            sys.exit(1)
        extractor.extract_single_metadata(args.photos_dir, args.filename)


if __name__ == '__main__':
    main()
