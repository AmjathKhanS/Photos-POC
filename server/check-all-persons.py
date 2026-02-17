import sqlite3

conn = sqlite3.connect('D:/Photos Ai/photo-viewer/server/data/faces.db')
cursor = conn.cursor()

# Count total persons
cursor.execute('SELECT COUNT(*) FROM persons')
total = cursor.fetchone()[0]
print(f'Total persons in database: {total}\n')

# Check persons 26-35 existence
cursor.execute('SELECT id, name, representative_face_id FROM persons WHERE id BETWEEN 26 AND 35 ORDER BY id')
rows = cursor.fetchall()

if rows:
    print('Persons 26-35:')
    for row in rows:
        person_id, name, rep_face_id = row
        print(f'  Person {person_id}: {name}, rep_face_id={rep_face_id}')
else:
    print('No persons found between IDs 26-35')

print(f'\nChecking if persons 19-28 exist:')
cursor.execute('SELECT id, name, representative_face_id FROM persons WHERE id BETWEEN 19 AND 28 ORDER BY id')
rows2 = cursor.fetchall()
for row in rows2:
    person_id, name, rep_face_id = row
    print(f'  Person {person_id}: {name}, rep_face_id={rep_face_id}')

conn.close()
