import sqlite3

conn = sqlite3.connect('D:/Photos Ai/photo-viewer/server/data/faces.db')
cursor = conn.cursor()

print('Clearing processing status...')
cursor.execute('DELETE FROM processing_status')
conn.commit()

cursor.execute('SELECT COUNT(*) FROM processing_status')
print(f'Processing status records: {cursor.fetchone()[0]}')
print('✅ Done! You can now run "Scan All Photos" again.')

conn.close()
