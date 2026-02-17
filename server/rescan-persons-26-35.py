#!/usr/bin/env python3
import sqlite3
import sys

# Connect to database
db_path = 'D:/Photos Ai/photo-viewer/server/data/faces.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get photos for Person 26, Person 27, Person 29-35 (by name, not ID)
person_names = ['Person 26', 'Person 27', 'Person 29', 'Person 30', 'Person 31',
                'Person 32', 'Person 33', 'Person 34', 'Person 35']
cursor.execute(f'''
    SELECT DISTINCT f.photo_filename, p.id, p.name
    FROM faces f
    JOIN persons p ON f.person_id = p.id
    WHERE p.name IN ({','.join('?' * len(person_names))})
    ORDER BY p.id
''', person_names)

photos = cursor.fetchall()

print(f"Found {len(photos)} photos for persons 26, 27, 29-35:\n")
filenames = []
for photo_filename, person_id, person_name in photos:
    print(f"  {person_name}: {photo_filename}")
    filenames.append(photo_filename)

# Clear processing status for these photos so they can be rescanned
print(f"\nClearing processing status for {len(set(filenames))} unique photos...")
unique_filenames = list(set(filenames))
for filename in unique_filenames:
    cursor.execute("DELETE FROM processing_status WHERE photo_filename = ?", (filename,))
    cursor.execute("DELETE FROM faces WHERE photo_filename = ?", (filename,))

conn.commit()
print(f"Cleared {len(unique_filenames)} photos. They will be rescanned on next scan.")

# Output the filenames for verification
print("\nFiles to be rescanned:")
for filename in unique_filenames:
    print(f"  {filename}")

conn.close()
