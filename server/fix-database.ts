import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, 'data/faces.db');

console.log('Fixing database tables and columns...\n');
console.log(`Database path: ${DB_PATH}\n`);

const db = new Database(DB_PATH);

try {
  // Add is_screenshot column
  try {
    db.exec(`ALTER TABLE semantic_processing_status ADD COLUMN is_screenshot BOOLEAN DEFAULT 0`);
    console.log('✓ Added is_screenshot column');
  } catch (e: any) {
    if (e.message && e.message.includes('duplicate column')) {
      console.log('✓ is_screenshot column already exists');
    } else {
      throw e;
    }
  }

  // Create memories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      photo_filenames TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✓ Created memories table');

  // Create smart_albums table
  db.exec(`
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
    )
  `);
  console.log('✓ Created smart_albums table');

  // Create smart_album_photos table
  db.exec(`
    CREATE TABLE IF NOT EXISTS smart_album_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      album_id INTEGER NOT NULL,
      photo_filename TEXT NOT NULL,
      similarity_score REAL,
      FOREIGN KEY (album_id) REFERENCES smart_albums(id) ON DELETE CASCADE
    )
  `);
  console.log('✓ Created smart_album_photos table');

  // Add is_dismissed column to memories
  try {
    db.exec(`ALTER TABLE memories ADD COLUMN is_dismissed BOOLEAN DEFAULT 0`);
    console.log('✓ Added is_dismissed column to memories table');
  } catch (e: any) {
    if (e.message && e.message.includes('duplicate column')) {
      console.log('✓ is_dismissed column already exists');
    } else {
      throw e;
    }
  }

  // Create photo_locations table
  db.exec(`
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
    )
  `);
  console.log('✓ Created photo_locations table');

  // Create location_clusters table
  db.exec(`
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
    )
  `);
  console.log('✓ Created location_clusters table');

  console.log('\n✅ All database fixes completed successfully!');

} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
} finally {
  db.close();
}
