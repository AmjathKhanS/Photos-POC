#!/usr/bin/env python3
import sqlite3

db_path = 'D:/Photos Ai/photo-viewer/server/data/faces.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get all persons with their IDs and names
cursor.execute('SELECT id, name, representative_face_id FROM persons ORDER BY id')
persons = cursor.fetchall()

print(f"Total persons: {len(persons)}\n")

for person_id, name, rep_face_id in persons:
    print(f"Person {person_id}: {name} (rep_face: {rep_face_id})")

# Check specifically for Person 26, Person 27, etc by name
print("\n\nSearching by name pattern 'Person 26', 'Person 27', etc:")
for num in [26, 27, 29, 30, 31, 32, 33, 34, 35]:
    name = f'Person {num}'
    cursor.execute('SELECT id, name, representative_face_id FROM persons WHERE name = ?', (name,))
    row = cursor.fetchone()
    if row:
        print(f"  {name}: ID={row[0]}, rep_face={row[2]}")
    else:
        print(f"  {name}: NOT FOUND")

conn.close()
