import sqlite3
conn = sqlite3.connect("D:/Photos Ai/photo-viewer/server/data/faces.db")
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = [row[0] for row in cursor.fetchall()]
print("Tables in database:")
for table in tables:
    print(f"  - {table}")
conn.close()
