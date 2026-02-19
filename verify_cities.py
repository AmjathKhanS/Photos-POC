import sqlite3

conn = sqlite3.connect('D:/Photos Ai/photo-viewer/server/data/faces.db')
cursor = conn.cursor()

# Check if cities are populated
cursor.execute('SELECT city, country, COUNT(*) as count FROM photo_locations WHERE city IS NOT NULL GROUP BY city, country')
cities = cursor.fetchall()

print('Cities with photos:')
print('-' * 50)
for city, country, count in cities:
    print(f'{city}, {country}: {count} photos')

print('\n' + '=' * 50)
print(f'Total cities: {len(cities)}')

conn.close()
