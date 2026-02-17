import sqlite3
import os
import json

conn = sqlite3.connect('D:/Photos Ai/photo-viewer/server/data/faces.db')
cursor = conn.cursor()

photos_dir = 'D:/Photos Ai/mobile'

# Get persons by name
person_names = ['Person 26', 'Person 27', 'Person 29', 'Person 30', 'Person 31',
                'Person 32', 'Person 33', 'Person 34', 'Person 35']

print('Checking persons by name:\n')

for person_name in person_names:
    cursor.execute('''
        SELECT p.id, p.name, p.representative_face_id, f.photo_filename, f.bounding_box, f.confidence
        FROM persons p
        LEFT JOIN faces f ON p.representative_face_id = f.id
        WHERE p.name = ?
    ''', (person_name,))

    row = cursor.fetchone()
    if row:
        person_id, name, rep_face_id, photo_filename, bbox, confidence = row

        if photo_filename:
            file_ext = os.path.splitext(photo_filename)[1].lower()
            bbox_obj = json.loads(bbox) if bbox else {}

            print(f'{name} (ID: {person_id}):')
            print(f'  Face ID: {rep_face_id}')
            print(f'  Photo: {photo_filename} ({file_ext})')
            print(f'  Confidence: {confidence}')
            if bbox_obj:
                print(f'  BBox: left={bbox_obj.get("left")}, top={bbox_obj.get("top")}, right={bbox_obj.get("right")}, bottom={bbox_obj.get("bottom")}')
                width = bbox_obj.get("right", 0) - bbox_obj.get("left", 0)
                height = bbox_obj.get("bottom", 0) - bbox_obj.get("top", 0)
                print(f'  Size: {width}x{height}')
        else:
            print(f'{name} (ID: {person_id}): No representative face found!')
    else:
        print(f'{person_name}: Not found in database')

    print()

conn.close()
