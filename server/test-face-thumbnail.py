import sqlite3
import os

conn = sqlite3.connect('D:/Photos Ai/photo-viewer/server/data/faces.db')
cursor = conn.cursor()

photos_dir = 'D:/Photos Ai/mobile'

# Get sample person with faces
cursor.execute('''
    SELECT p.id, p.name, p.representative_face_id, f.photo_filename, f.bounding_box
    FROM persons p
    JOIN faces f ON p.representative_face_id = f.id
    LIMIT 5
''')

rows = cursor.fetchall()
print('Sample persons with representative faces:')
for row in rows:
    person_id, person_name, face_id, photo_filename, bbox = row
    photo_path = os.path.join(photos_dir, photo_filename)
    exists = os.path.exists(photo_path)
    print(f'  Person {person_id} ({person_name}):')
    print(f'    Face ID: {face_id}')
    print(f'    Photo: {photo_filename}')
    print(f'    Exists: {exists}')
    print(f'    Bounding box: {bbox[:50]}...')
    print(f'    Thumbnail URL: /api/faces/{face_id}/thumbnail')
    print()

conn.close()

print('\nTest these URLs in your browser:')
print('  http://localhost:3002/api/faces/1/thumbnail')
print('  http://localhost:3002/api/faces/2/thumbnail')
print('  http://localhost:3002/api/faces/3/thumbnail')
