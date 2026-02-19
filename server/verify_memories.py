#!/usr/bin/env python3
import sqlite3
import os

DB_PATH = "D:/Photos Ai/photo-viewer/server/data/faces.db"
PHOTOS_DIR = "D:/Photos Ai/mobile"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

cursor.execute('SELECT id, memory_type, title, memory_date, photo_count, cover_photo_filename FROM memories ORDER BY id')
memories = cursor.fetchall()

print(f'Total memories: {len(memories)}\n')

for memory in memories:
    mem_id, mem_type, title, date, photo_count, cover_photo = memory
    cover_exists = os.path.exists(os.path.join(PHOTOS_DIR, cover_photo)) if cover_photo else False

    print(f'Memory {mem_id}: {title}')
    print(f'  Type: {mem_type}')
    print(f'  Date: {date}')
    print(f'  Photos: {photo_count}')
    print(f'  Cover: {cover_photo}')
    print(f'  Cover exists: {cover_exists}')
    print()

conn.close()
