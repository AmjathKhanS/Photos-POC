import sqlite3
import os

conn = sqlite3.connect('D:/Photos Ai/photo-viewer/server/data/faces.db')
cursor = conn.cursor()

photos_dir = 'D:/Photos Ai/mobile'

# Check persons 26-35 in detail
cursor.execute('''
    SELECT p.id, p.name, p.representative_face_id, f.id as face_id,
           f.photo_filename, f.bounding_box, f.confidence
    FROM persons p
    JOIN faces f ON p.representative_face_id = f.id
    WHERE p.id BETWEEN 26 AND 35
    ORDER BY p.id
''')

rows = cursor.fetchall()
print('Persons 26-35 Face Data:\n')

for row in rows:
    person_id, person_name, rep_face_id, face_id, photo_filename, bbox, confidence = row

    photo_path = os.path.join(photos_dir, photo_filename)
    photo_exists = os.path.exists(photo_path)
    file_ext = os.path.splitext(photo_filename)[1].lower()

    print(f'Person {person_id} ({person_name}):')
    print(f'  Face ID: {face_id}')
    print(f'  Photo: {photo_filename}')
    print(f'  File type: {file_ext}')
    print(f'  Photo exists: {photo_exists}')
    print(f'  Confidence: {confidence}')
    print(f'  BBox: {bbox[:100]}...')
    print(f'  Thumbnail URL: http://localhost:3002/api/faces/{face_id}/thumbnail')
    print()

conn.close()
