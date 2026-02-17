#!/usr/bin/env python3
import sqlite3

db_path = 'D:/Photos Ai/photo-viewer/server/data/faces.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Find persons with 0 faces
cursor.execute('''
    SELECT p.id, p.name, COUNT(f.id) as face_count
    FROM persons p
    LEFT JOIN faces f ON p.id = f.person_id
    GROUP BY p.id, p.name
    HAVING COUNT(f.id) = 0
    ORDER BY p.id
''')

empty_persons = cursor.fetchall()

if empty_persons:
    print(f"Found {len(empty_persons)} persons with 0 photos:\n")
    for person_id, person_name, face_count in empty_persons:
        print(f"  Person {person_id}: {person_name} (0 photos)")

    print(f"\nDeleting {len(empty_persons)} empty persons...")

    # Delete the empty persons
    for person_id, person_name, face_count in empty_persons:
        cursor.execute("DELETE FROM persons WHERE id = ?", (person_id,))

    conn.commit()
    print(f"Successfully deleted {len(empty_persons)} persons with 0 photos.")
else:
    print("No persons with 0 photos found.")

# Show remaining count
cursor.execute("SELECT COUNT(*) FROM persons")
remaining = cursor.fetchone()[0]
print(f"\nRemaining persons in database: {remaining}")

conn.close()
