import sqlite3

conn = sqlite3.connect('D:/Photos Ai/photo-viewer/server/data/faces.db')
cursor = conn.cursor()

# First check what tables exist
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print('Available tables:', [t[0] for t in tables])
print()

# Check photo_metadata table structure
print('\nColumns in photo_metadata table:')
cursor.execute("PRAGMA table_info(photo_metadata)")
columns = cursor.fetchall()
for col in columns:
    print(f'  {col[1]} ({col[2]})')

# Check photo_locations table structure
print('\nColumns in photo_locations table:')
cursor.execute("PRAGMA table_info(photo_locations)")
columns = cursor.fetchall()
for col in columns:
    print(f'  {col[1]} ({col[2]})')

# Check location_clusters table structure
print('\nColumns in location_clusters table:')
cursor.execute("PRAGMA table_info(location_clusters)")
columns = cursor.fetchall()
for col in columns:
    print(f'  {col[1]} ({col[2]})')

# Check photos with GPS in photo_metadata
print('\n--- Checking photo_metadata ---')
cursor.execute('SELECT COUNT(*) FROM photo_metadata WHERE latitude IS NOT NULL AND longitude IS NOT NULL')
gps_count = cursor.fetchone()[0]
print(f'Photos with GPS coordinates in photo_metadata: {gps_count}')

if gps_count > 0:
    cursor.execute('SELECT * FROM photo_metadata WHERE latitude IS NOT NULL AND longitude IS NOT NULL LIMIT 15')
    rows = cursor.fetchall()
    print('\nSample GPS data from photo_metadata:')
    for row in rows:
        print(row)

# Check photo_locations
print('\n--- Checking photo_locations ---')
cursor.execute('SELECT COUNT(*) FROM photo_locations')
loc_count = cursor.fetchone()[0]
print(f'Total entries in photo_locations: {loc_count}')

if loc_count > 0:
    cursor.execute('SELECT * FROM photo_locations LIMIT 15')
    rows = cursor.fetchall()
    print('\nSample data from photo_locations:')
    for row in rows:
        print(row)

# Check location_clusters
print('\n--- Checking location_clusters ---')
cursor.execute('SELECT COUNT(*) FROM location_clusters')
cluster_count = cursor.fetchone()[0]
print(f'Total entries in location_clusters: {cluster_count}')

if cluster_count > 0:
    cursor.execute('SELECT * FROM location_clusters LIMIT 15')
    rows = cursor.fetchall()
    print('\nSample data from location_clusters:')
    for row in rows:
        print(row)

conn.close()
