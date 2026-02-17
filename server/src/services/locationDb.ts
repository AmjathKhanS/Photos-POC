/**
 * Location Database Service
 * Handles database operations for photo locations
 */

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data/faces.db');

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

/**
 * Check if location tables exist
 */
function tablesExist(): boolean {
  try {
    const database = getDb();
    const result = database.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='photo_locations'
    `).get();
    return result !== undefined;
  } catch {
    return false;
  }
}

/**
 * Initialize location tables if they don't exist
 */
export function initLocationTables(): void {
  if (tablesExist()) {
    return; // Tables already exist
  }

  console.log('📍 Initializing location tables...');

  const database = getDb();

  try {
    // Create photo_locations table
    database.exec(`
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
    database.exec(`
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
    database.exec(`
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

    console.log('✅ Location tables initialized successfully');
  } catch (error: any) {
    console.error('❌ Failed to initialize location tables:', error.message);
  }
}

export interface PhotoLocation {
  id?: number;
  photo_filename: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  gps_timestamp?: string;
  accuracy?: number;
  country?: string;
  country_code?: string;
  state?: string;
  city?: string;
  address?: string;
  postal_code?: string;
  location_cluster_id?: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Insert or update photo location data
 */
export function upsertPhotoLocation(location: PhotoLocation): void {
  const database = getDb();

  const stmt = database.prepare(`
    INSERT INTO photo_locations (
      photo_filename,
      latitude,
      longitude,
      altitude,
      gps_timestamp,
      accuracy,
      country,
      country_code,
      state,
      city,
      address,
      postal_code,
      location_cluster_id,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(photo_filename) DO UPDATE SET
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      altitude = excluded.altitude,
      gps_timestamp = excluded.gps_timestamp,
      accuracy = excluded.accuracy,
      country = excluded.country,
      country_code = excluded.country_code,
      state = excluded.state,
      city = excluded.city,
      address = excluded.address,
      postal_code = excluded.postal_code,
      location_cluster_id = excluded.location_cluster_id,
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(
    location.photo_filename,
    location.latitude,
    location.longitude,
    location.altitude ?? null,
    location.gps_timestamp ?? null,
    location.accuracy ?? null,
    location.country ?? null,
    location.country_code ?? null,
    location.state ?? null,
    location.city ?? null,
    location.address ?? null,
    location.postal_code ?? null,
    location.location_cluster_id ?? null
  );
}

/**
 * Get location data for a specific photo
 */
export function getPhotoLocation(filename: string): PhotoLocation | null {
  if (!tablesExist()) return null;

  const database = getDb();

  const stmt = database.prepare(`
    SELECT * FROM photo_locations
    WHERE photo_filename = ?
  `);

  const result = stmt.get(filename) as PhotoLocation | undefined;
  return result || null;
}

/**
 * Get all photo locations
 */
export function getAllPhotoLocations(): PhotoLocation[] {
  if (!tablesExist()) return [];

  const database = getDb();

  const stmt = database.prepare(`
    SELECT * FROM photo_locations
    ORDER BY created_at DESC
  `);

  return stmt.all() as PhotoLocation[];
}

/**
 * Get count of photos with location data
 */
export function getPhotoLocationCount(): number {
  if (!tablesExist()) return 0;

  const database = getDb();

  const stmt = database.prepare(`
    SELECT COUNT(*) as count FROM photo_locations
  `);

  const result = stmt.get() as { count: number };
  return result.count;
}

/**
 * Get all unique cities with photo counts
 */
export function getCitiesWithCounts(): Array<{
  city: string;
  country: string;
  count: number;
  avg_lat: number;
  avg_lon: number;
}> {
  if (!tablesExist()) return [];

  const database = getDb();

  const stmt = database.prepare(`
    SELECT
      city,
      country,
      COUNT(*) as count,
      AVG(latitude) as avg_lat,
      AVG(longitude) as avg_lon
    FROM photo_locations
    WHERE city IS NOT NULL
    GROUP BY city, country
    ORDER BY count DESC
  `);

  return stmt.all() as Array<{
    city: string;
    country: string;
    count: number;
    avg_lat: number;
    avg_lon: number;
  }>;
}

/**
 * Get all unique countries with photo counts
 */
export function getCountriesWithCounts(): Array<{
  country: string;
  country_code: string;
  count: number;
}> {
  if (!tablesExist()) return [];

  const database = getDb();

  const stmt = database.prepare(`
    SELECT
      country,
      country_code,
      COUNT(*) as count
    FROM photo_locations
    WHERE country IS NOT NULL
    GROUP BY country, country_code
    ORDER BY count DESC
  `);

  return stmt.all() as Array<{
    country: string;
    country_code: string;
    count: number;
  }>;
}

/**
 * Get photos within a bounding box
 */
export function getPhotosInBounds(
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number
): PhotoLocation[] {
  if (!tablesExist()) return [];

  const database = getDb();

  const stmt = database.prepare(`
    SELECT * FROM photo_locations
    WHERE latitude BETWEEN ? AND ?
      AND longitude BETWEEN ? AND ?
  `);

  return stmt.all(minLat, maxLat, minLon, maxLon) as PhotoLocation[];
}

/**
 * Delete location data for a photo
 */
export function deletePhotoLocation(filename: string): void {
  if (!tablesExist()) return;

  const database = getDb();

  const stmt = database.prepare(`
    DELETE FROM photo_locations
    WHERE photo_filename = ?
  `);

  stmt.run(filename);
}

/**
 * Delete all location data (for privacy/cleanup)
 */
export function deleteAllPhotoLocations(): void {
  if (!tablesExist()) return;

  const database = getDb();

  database.prepare('DELETE FROM photo_locations').run();
}

/**
 * Check if photo has location data
 */
export function hasLocation(filename: string): boolean {
  if (!tablesExist()) return false;

  const database = getDb();

  const stmt = database.prepare(`
    SELECT 1 FROM photo_locations
    WHERE photo_filename = ?
    LIMIT 1
  `);

  return stmt.get(filename) !== undefined;
}

/**
 * Get photos by city
 */
export function getPhotosByCity(city: string, country: string): PhotoLocation[] {
  if (!tablesExist()) return [];

  const database = getDb();

  const stmt = database.prepare(`
    SELECT * FROM photo_locations
    WHERE city = ? AND country = ?
    ORDER BY created_at DESC
  `);

  return stmt.all(city, country) as PhotoLocation[];
}

/**
 * Get photos by country
 */
export function getPhotosByCountry(country: string): PhotoLocation[] {
  if (!tablesExist()) return [];

  const database = getDb();

  const stmt = database.prepare(`
    SELECT * FROM photo_locations
    WHERE country = ?
    ORDER BY created_at DESC
  `);

  return stmt.all(country) as PhotoLocation[];
}
