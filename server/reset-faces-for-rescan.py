"""
Reset face detection database to rescan with new optimal parameters
This will:
1. Delete all existing persons (clusters)
2. Unassign all faces from persons
3. Clear processing status
4. Keep face embeddings (no need to re-detect)

After running this, you need to:
1. Run "Scan All Photos" again (with new MIN_FACE_CONFIDENCE=0.85)
2. Run "Run Clustering" (with new CLUSTERING_EPS=0.65)
"""

import sqlite3

DB_PATH = 'D:/Photos Ai/photo-viewer/server/data/faces.db'

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

print('Current database state:')
cursor.execute('SELECT COUNT(*) FROM faces')
print(f'  Total faces: {cursor.fetchone()[0]}')

cursor.execute('SELECT COUNT(*) FROM persons')
print(f'  Total persons: {cursor.fetchone()[0]}')

cursor.execute('SELECT COUNT(*) FROM processing_status')
print(f'  Processed photos: {cursor.fetchone()[0]}')

print('\n' + '='*60)
print('RESETTING DATABASE...')
print('='*60 + '\n')

# Step 1: Delete all persons
cursor.execute('DELETE FROM persons')
deleted_persons = cursor.rowcount
print(f'1. Deleted {deleted_persons} persons')

# Step 2: Unassign all faces from persons
cursor.execute('UPDATE faces SET person_id = NULL')
updated_faces = cursor.rowcount
print(f'2. Unassigned {updated_faces} faces from persons')

# Step 3: Clear processing status to rescan
cursor.execute('DELETE FROM processing_status')
deleted_status = cursor.rowcount
print(f'3. Cleared {deleted_status} processing status records')

conn.commit()

print('\nNew database state:')
cursor.execute('SELECT COUNT(*) FROM faces')
print(f'  Total faces: {cursor.fetchone()[0]}')

cursor.execute('SELECT COUNT(*) FROM persons')
print(f'  Total persons: {cursor.fetchone()[0]}')

cursor.execute('SELECT COUNT(*) FROM processing_status')
print(f'  Processed photos: {cursor.fetchone()[0]}')

conn.close()

print('\n' + '='*60)
print('RESET COMPLETE!')
print('='*60)
print('\nNext steps:')
print('1. Go to People tab in the app')
print('2. Click "Scan All Photos" button')
print('   - This will re-detect faces with new MIN_FACE_CONFIDENCE=0.85')
print('   - Filters out non-human false positives')
print('3. After scanning completes, click "Run Clustering"')
print('   - This will group faces with new CLUSTERING_EPS=0.65')
print('   - Same person at different angles will group together')
print('\nExpected improvements:')
print('  - No non-living things detected as faces')
print('  - Same person at different angles grouped together')
