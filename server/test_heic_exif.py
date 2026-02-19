#!/usr/bin/env python3
from PIL import Image
from PIL.ExifTags import TAGS
import pillow_heif
import os

pillow_heif.register_heif_opener()

PHOTOS_DIR = "D:/Photos Ai/mobile"

# Check HEIC photos
heic_photos = []
for file in os.listdir(PHOTOS_DIR):
    if file.lower().endswith('.heic'):
        heic_photos.append(file)
        if len(heic_photos) >= 3:
            break

print(f'Checking {len(heic_photos)} HEIC photos for complete EXIF data...\n')

for photo_file in heic_photos:
    photo_path = os.path.join(PHOTOS_DIR, photo_file)
    print(f'File: {photo_file}')

    try:
        image = Image.open(photo_path)
        exif_data = image.getexif()

        if not exif_data:
            print('  No EXIF data found\n')
            continue

        # Print all EXIF tags
        camera_tags = {}
        for tag_id, value in exif_data.items():
            tag_name = TAGS.get(tag_id, tag_id)

            # Print camera-related tags
            if tag_name in ['Make', 'Model', 'ISOSpeedRatings', 'PhotographicSensitivity',
                           'FNumber', 'ExposureTime', 'FocalLength', 'LensModel',
                           'DateTime', 'DateTimeOriginal']:
                camera_tags[tag_name] = value

        if camera_tags:
            for tag, value in camera_tags.items():
                print(f'  {tag}: {value}')
        else:
            print('  Has EXIF but no camera settings')
        print()

    except Exception as e:
        print(f'  Error: {e}\n')
