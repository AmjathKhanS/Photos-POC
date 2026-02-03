/**
 * Smart Albums Database Service
 * Handles database operations for auto-generated photo albums
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../data/faces.db');

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
  }
  return db;
}

// ============ Type Definitions ============

export interface SmartAlbum {
  id: number;
  title: string;
  description: string | null;
  cover_photo_filename: string | null;
  start_date: string | null;
  end_date: string | null;
  photo_count: number;
  cluster_method: string;
  avg_similarity: number | null;
  created_at: string;
  updated_at: string;
}

export interface SmartAlbumPhoto {
  id: number;
  album_id: number;
  photo_filename: string;
  similarity_score: number | null;
  is_cover: boolean;
  added_at: string;
}

export interface AlbumWithPhotos extends SmartAlbum {
  photos: SmartAlbumPhoto[];
}

// ============ Smart Album Operations ============

export function createAlbum(
  title: string,
  description: string | null,
  cover_photo_filename: string | null,
  start_date: string | null,
  end_date: string | null,
  photo_count: number,
  avg_similarity: number | null = null,
  cluster_method: string = 'visual_temporal'
): number {
  const result = getDb()
    .prepare(
      `INSERT INTO smart_albums (title, description, cover_photo_filename, start_date, end_date, photo_count, cluster_method, avg_similarity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(title, description, cover_photo_filename, start_date, end_date, photo_count, cluster_method, avg_similarity);

  return result.lastInsertRowid as number;
}

export function getAllAlbums(): SmartAlbum[] {
  return getDb()
    .prepare('SELECT * FROM smart_albums ORDER BY start_date DESC, created_at DESC')
    .all() as SmartAlbum[];
}

export function getAlbumById(id: number): SmartAlbum | undefined {
  return getDb()
    .prepare('SELECT * FROM smart_albums WHERE id = ?')
    .get(id) as SmartAlbum | undefined;
}

export function getAlbumWithPhotos(id: number): AlbumWithPhotos | undefined {
  const album = getAlbumById(id);
  if (!album) return undefined;

  const photos = getDb()
    .prepare('SELECT * FROM smart_album_photos WHERE album_id = ? ORDER BY added_at')
    .all(id) as SmartAlbumPhoto[];

  return {
    ...album,
    photos,
  };
}

export function updateAlbum(
  id: number,
  updates: Partial<Omit<SmartAlbum, 'id' | 'created_at'>>
): void {
  const fields = Object.keys(updates)
    .filter(key => updates[key as keyof typeof updates] !== undefined)
    .map(key => `${key} = ?`)
    .join(', ');

  if (fields.length === 0) return;

  const values = Object.values(updates).filter(v => v !== undefined);
  values.push(id);

  getDb()
    .prepare(`UPDATE smart_albums SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(...values);
}

export function deleteAlbum(id: number): void {
  getDb()
    .prepare('DELETE FROM smart_albums WHERE id = ?')
    .run(id);
}

export function clearAllAlbums(): void {
  getDb().prepare('DELETE FROM smart_albums').run();
  getDb().prepare('DELETE FROM smart_album_photos').run();
}

// ============ Album Photo Operations ============

export function addPhotoToAlbum(
  album_id: number,
  photo_filename: string,
  similarity_score: number | null = null,
  is_cover: boolean = false
): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO smart_album_photos (album_id, photo_filename, similarity_score, is_cover)
       VALUES (?, ?, ?, ?)`
    )
    .run(album_id, photo_filename, similarity_score, is_cover ? 1 : 0);
}

export function addPhotosToAlbum(
  album_id: number,
  photos: Array<{ filename: string; similarity_score?: number; is_cover?: boolean }>
): void {
  const stmt = getDb().prepare(
    `INSERT OR IGNORE INTO smart_album_photos (album_id, photo_filename, similarity_score, is_cover)
     VALUES (?, ?, ?, ?)`
  );

  const transaction = getDb().transaction((album_id: number, photoList: typeof photos) => {
    for (const photo of photoList) {
      stmt.run(
        album_id,
        photo.filename,
        photo.similarity_score ?? null,
        photo.is_cover ? 1 : 0
      );
    }
  });

  transaction(album_id, photos);
}

export function getAlbumPhotos(album_id: number): SmartAlbumPhoto[] {
  return getDb()
    .prepare('SELECT * FROM smart_album_photos WHERE album_id = ? ORDER BY added_at')
    .all(album_id) as SmartAlbumPhoto[];
}

export function removePhotoFromAlbum(album_id: number, photo_filename: string): void {
  getDb()
    .prepare('DELETE FROM smart_album_photos WHERE album_id = ? AND photo_filename = ?')
    .run(album_id, photo_filename);
}

// ============ Statistics ============

export function getAlbumStats(): {
  total_albums: number;
  total_photos_in_albums: number;
  avg_photos_per_album: number;
  avg_similarity: number;
} {
  const result = getDb()
    .prepare(
      `SELECT
        COUNT(*) as total_albums,
        SUM(photo_count) as total_photos_in_albums,
        AVG(photo_count) as avg_photos_per_album,
        AVG(avg_similarity) as avg_similarity
       FROM smart_albums`
    )
    .get() as any;

  return {
    total_albums: result.total_albums || 0,
    total_photos_in_albums: result.total_photos_in_albums || 0,
    avg_photos_per_album: result.avg_photos_per_album || 0,
    avg_similarity: result.avg_similarity || 0,
  };
}

// Close database on exit
process.on('exit', () => {
  if (db) {
    db.close();
  }
});
