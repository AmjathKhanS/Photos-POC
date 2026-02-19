#!/usr/bin/env python3
import sqlite3

DB_PATH = "D:/Photos Ai/photo-viewer/server/data/faces.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

cursor.execute('SELECT COUNT(*) FROM memories')
memories_count = cursor.fetchone()[0]

cursor.execute('SELECT COUNT(*) FROM memory_photos')
memory_photos_count = cursor.fetchone()[0]

print(f'Memories in database: {memories_count}')
print(f'Memory photos in database: {memory_photos_count}')

# Check what data we have for memory generation
cursor.execute('SELECT COUNT(*) FROM photo_metadata WHERE date_taken IS NOT NULL')
photos_with_dates = cursor.fetchone()[0]

cursor.execute('SELECT COUNT(*) FROM faces')
faces_count = cursor.fetchone()[0]

cursor.execute('SELECT COUNT(*) FROM persons')
persons_count = cursor.fetchone()[0]

print(f'\nData available:')
print(f'  Photos with dates: {photos_with_dates}')
print(f'  Faces detected: {faces_count}')
print(f'  Persons identified: {persons_count}')

# Check if there are any existing memories
if memories_count > 0:
    cursor.execute('SELECT id, memory_type, title, memory_date, photo_count FROM memories LIMIT 5')
    print('\nExisting memories:')
    for row in cursor.fetchall():
        print(f'  {row}')

conn.close()
