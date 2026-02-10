/**
 * Migration: Add Location Tables
 * Creates tables for storing photo GPS data and location clusters
 */

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.SQLITE_DB_PATH || path.join(process.cwd(), '../server/data/faces.db');

export function runMigration() {
  console.log('📍 Adding location tables to database...\n');

  const db = new Database(DB_PATH);

  try {
    // Check if tables already exist
    const tableCheck = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name IN ('photo_locations', 'location_clusters')
    `).all();

    if (tableCheck.length > 0) {
      console.log('⚠️  Location tables already exist. Skipping migration.');
      return;
    }

    // Create photo_locations table
    console.log('Creating photo_locations table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS photo_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        photo_filename TEXT NOT NULL UNIQUE,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        altitude REAL,
        gps_timestamp TIMESTAMP,
        accuracy REAL,

        -- Reverse geocoded data (will be populated later)
        country TEXT,
        country_code TEXT,
        state TEXT,
        city TEXT,
        address TEXT,
        postal_code TEXT,

        -- Clustering (will be populated later)
        location_cluster_id INTEGER,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for performance
    console.log('Creating indexes...');
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_photo_locations_coords
      ON photo_locations(latitude, longitude);

      CREATE INDEX IF NOT EXISTS idx_photo_locations_city
      ON photo_locations(city);

      CREATE INDEX IF NOT EXISTS idx_photo_locations_country
      ON photo_locations(country);

      CREATE INDEX IF NOT EXISTS idx_photo_locations_cluster
      ON photo_locations(location_cluster_id);
    `);

    // Create location_clusters table
    console.log('Creating location_clusters table...');
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

    console.log('\n✅ Location tables created successfully!');
    console.log('   - photo_locations: Stores GPS data for each photo');
    console.log('   - location_clusters: Groups nearby photos together');

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    db.close();
  }
}

// Run migration if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration();
}
