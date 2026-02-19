#!/usr/bin/env python3
from PIL import Image
from PIL.ExifTags import TAGS
import os

PHOTOS_DIR = "D:/Photos Ai/mobile"

# Check a few sample photos
sample_photos = []
for file in os.listdir(PHOTOS_DIR):
    if file.lower().endswith(('.jpg', '.jpeg', '.heic')):
        sample_photos.append(file)
        if len(sample_photos) >= 5:
            break

print(f'Checking {len(sample_photos)} sample photos for EXIF data...\n')

for photo_file in sample_photos:
    photo_path = os.path.join(PHOTOS_DIR, photo_file)
    print(f'File: {photo_file}')

    try:
        image = Image.open(photo_path)
        exif_data = image.getexif()

        if not exif_data:
            print('  No EXIF data found\n')
            continue

        # Look for camera settings
        found_camera_data = False
        for tag_id, value in exif_data.items():
            tag_name = TAGS.get(tag_id, tag_id)

            if tag_name in ['Make', 'Model', 'ISOSpeedRatings', 'FNumber', 'ExposureTime', 'FocalLength', 'LensModel']:
                print(f'  {tag_name}: {value}')
                found_camera_data = True

        if not found_camera_data:
            print('  Has EXIF but no camera settings')
        print()

    except Exception as e:
        print(f'  Error: {e}\n')
