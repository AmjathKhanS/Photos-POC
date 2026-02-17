#!/usr/bin/env python3
"""
Database Initialization Script
Creates all required tables for the photo viewer application
"""

import sqlite3
import sys
from pathlib import Path

DB_PATH = sys.argv[1] if len(sys.argv) > 1 else "D:/Photos Ai/photo-viewer/server/data/faces.db"

print(f"Initializing database: {DB_PATH}")

# Ensure directory exists
Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Create faces and persons tables (from face_processor_onnx.py)
print("Creating faces, persons, and processing_status tables...")
cursor.executescript('''
    CREATE TABLE IF NOT EXISTS faces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        photo_filename TEXT NOT NULL,
        face_index INTEGER NOT NULL,
        bounding_box TEXT NOT NULL,
        encoding BLOB NOT NULL,
        person_id INTEGER,
        confidence REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (person_id) REFERENCES persons(id)
    );

    CREATE TABLE IF NOT EXISTS persons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        representative_face_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS processing_status (
        photo_filename TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        faces_count INTEGER DEFAULT 0,
        processed_at DATETIME,
        error_message TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_faces_photo ON faces(photo_filename);
    CREATE INDEX IF NOT EXISTS idx_faces_person ON faces(person_id);
    CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(name);
''')

# Create photo_metadata table (from photo_metadata_extractor.py)
print("Creating photo_metadata table...")
cursor.execute('''
    CREATE TABLE IF NOT EXISTS photo_metadata (
        photo_filename TEXT PRIMARY KEY,
        date_taken DATETIME,
        date_taken_year INTEGER,
        date_taken_month INTEGER,
        date_taken_day INTEGER,
        date_taken_season TEXT,
        file_size INTEGER,
        width INTEGER,
        height INTEGER,
        orientation TEXT,
        camera_make TEXT,
        camera_model TEXT,
        has_gps INTEGER DEFAULT 0,
        latitude REAL,
        longitude REAL,
        metadata_extracted_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
''')

cursor.execute('CREATE INDEX IF NOT EXISTS idx_photo_metadata_date ON photo_metadata(date_taken)')
cursor.execute('CREATE INDEX IF NOT EXISTS idx_photo_metadata_year_month_day ON photo_metadata(date_taken_year, date_taken_month, date_taken_day)')
cursor.execute('CREATE INDEX IF NOT EXISTS idx_photo_metadata_season ON photo_metadata(date_taken_season)')

# Create photo_quality table (from photo_quality_analyzer.py)
print("Creating photo_quality table...")
cursor.execute('''
    CREATE TABLE IF NOT EXISTS photo_quality (
        photo_filename TEXT PRIMARY KEY,
        blur_score REAL,
        brightness_score REAL,
        contrast_score REAL,
        quality_score REAL,
        is_blurry INTEGER DEFAULT 0,
        is_dark INTEGER DEFAULT 0,
        is_overexposed INTEGER DEFAULT 0,
        is_low_contrast INTEGER DEFAULT 0,
        assessed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
''')

# Create memories tables (from memory_generator.py)
print("Creating memories tables...")

# Drop old memories table if it exists with wrong schema
try:
    cursor.execute("SELECT memory_type FROM memories LIMIT 1")
    print("  Memories table already has correct schema")
except sqlite3.OperationalError:
    # Old schema detected - drop and recreate
    print("  Dropping old memories table and recreating with correct schema...")
    cursor.execute("DROP TABLE IF EXISTS memory_photos")
    cursor.execute("DROP TABLE IF EXISTS memories")

cursor.executescript('''
    CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        date_start DATETIME,
        date_end DATETIME,
        person_id INTEGER,
        memory_date DATETIME NOT NULL,
        photo_count INTEGER DEFAULT 0,
        cover_photo_filename TEXT,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_dismissed INTEGER DEFAULT 0,
        FOREIGN KEY (person_id) REFERENCES persons(id)
    );

    CREATE TABLE IF NOT EXISTS memory_photos (
        memory_id INTEGER NOT NULL,
        photo_filename TEXT NOT NULL,
        importance_score REAL DEFAULT 1.0,
        display_order INTEGER,
        PRIMARY KEY (memory_id, photo_filename),
        FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type);
    CREATE INDEX IF NOT EXISTS idx_memories_date ON memories(memory_date);
    CREATE INDEX IF NOT EXISTS idx_memories_person ON memories(person_id);
    CREATE INDEX IF NOT EXISTS idx_memory_photos_memory ON memory_photos(memory_id);
''')

# Create smart_albums tables (from fix-database.ts)
print("Creating smart_albums tables...")
cursor.executescript('''
    CREATE TABLE IF NOT EXISTS smart_albums (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        cover_photo_filename TEXT,
        start_date TEXT,
        end_date TEXT,
        photo_count INTEGER DEFAULT 0,
        avg_similarity REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS smart_album_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        album_id INTEGER NOT NULL,
        photo_filename TEXT NOT NULL,
        similarity_score REAL,
        is_cover INTEGER DEFAULT 0,
        FOREIGN KEY (album_id) REFERENCES smart_albums(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_smart_album_photos_album ON smart_album_photos(album_id);
''')

# Create photo_locations tables (from add-location-tables.ts)
print("Creating photo_locations tables...")
cursor.executescript('''
    CREATE TABLE IF NOT EXISTS photo_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        photo_filename TEXT NOT NULL UNIQUE,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        altitude REAL,
        gps_timestamp TIMESTAMP,
        accuracy REAL,
        country TEXT,
        country_code TEXT,
        state TEXT,
        city TEXT,
        address TEXT,
        postal_code TEXT,
        location_cluster_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS location_clusters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        center_latitude REAL NOT NULL,
        center_longitude REAL NOT NULL,
        radius_meters REAL DEFAULT 500,
        photo_count INTEGER DEFAULT 0,
        first_visit TIMESTAMP,
        last_visit TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_photo_locations_filename ON photo_locations(photo_filename);
    CREATE INDEX IF NOT EXISTS idx_photo_locations_coords ON photo_locations(latitude, longitude);
''')

# Create semantic_search tables (from add-semantic-search.ts migration)
print("Creating semantic_search tables...")

# Drop old photo_embeddings table if it exists with wrong schema
try:
    cursor.execute("SELECT clip_embedding FROM photo_embeddings LIMIT 1")
    print("  Photo embeddings table already has correct schema")
except sqlite3.OperationalError:
    # Old schema detected - drop and recreate
    print("  Dropping old photo_embeddings table and recreating with correct schema...")
    cursor.execute("DROP TABLE IF EXISTS photo_embeddings")
    cursor.execute("DROP TABLE IF EXISTS semantic_processing_status")

cursor.executescript('''
    CREATE TABLE IF NOT EXISTS photo_embeddings (
        photo_filename TEXT PRIMARY KEY,
        clip_embedding BLOB NOT NULL,
        text_embedding BLOB,
        embedding_version TEXT DEFAULT 'v1',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS semantic_processing_status (
        photo_filename TEXT PRIMARY KEY,
        ocr_processed BOOLEAN DEFAULT 0,
        clip_processed BOOLEAN DEFAULT 0,
        last_processed_at TIMESTAMP,
        processing_time_ms INTEGER,
        error_message TEXT,
        is_screenshot BOOLEAN DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_photo_embeddings_created_at ON photo_embeddings(created_at);
''')

# Add is_screenshot column if it doesn't exist
try:
    cursor.execute("SELECT is_screenshot FROM semantic_processing_status LIMIT 1")
except sqlite3.OperationalError:
    print("  Adding is_screenshot column to semantic_processing_status...")
    cursor.execute("ALTER TABLE semantic_processing_status ADD COLUMN is_screenshot BOOLEAN DEFAULT 0")

conn.commit()
conn.close()

print("[SUCCESS] Database initialized successfully!")
print(f"   Database path: {DB_PATH}")
print("   All tables created with indexes")
