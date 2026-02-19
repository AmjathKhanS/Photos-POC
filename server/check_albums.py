#!/usr/bin/env python3
import sqlite3
import os

DB_PATH = "D:/Photos Ai/photo-viewer/server/data/faces.db"
PHOTOS_DIR = "D:/Photos Ai/mobile"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

cursor.execute('SELECT id, title, cover_photo_filename, photo_count FROM smart_albums ORDER BY start_date DESC')
albums = cursor.fetchall()

print('Albums in database:')
for album in albums:
    album_id, title, cover_photo, photo_count = album
    photo_exists = os.path.exists(os.path.join(PHOTOS_DIR, cover_photo)) if cover_photo else False
    print(f'  [{album_id}] {title}')
    print(f'      Cover: {cover_photo}')
    print(f'      Photos: {photo_count}')
    print(f'      Cover exists: {photo_exists}')
    print()

conn.close()
