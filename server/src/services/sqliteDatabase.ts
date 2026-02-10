/**
 * SQLite Database Service
 * Provides interface to read face detection data from SQLite database
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

export interface Face {
  id: number;
  photo_filename: string;
  face_index: number;
  bounding_box: string;
  encoding: Buffer;
  person_id: number | null;
  confidence: number | null;
  created_at: string;
}

export interface Person {
  id: number;
  name: string;
  representative_face_id: number | null;
  created_at: string;
}

export interface ProcessingStatus {
  photo_filename: string;
  status: string;
  faces_count: number;
  processed_at: string | null;
  error_message: string | null;
}

// ============ Face Operations ============

export function getAllFaces(): Face[] {
  return getDb().prepare('SELECT * FROM faces').all() as Face[];
}

export function getFacesByPhoto(photoFilename: string): Face[] {
  return getDb()
    .prepare('SELECT * FROM faces WHERE photo_filename = ?')
    .all(photoFilename) as Face[];
}

export function getFaceById(id: number): Face | undefined {
  return getDb()
    .prepare('SELECT * FROM faces WHERE id = ?')
    .get(id) as Face | undefined;
}

export function updateFacePersonId(faceId: number, personId: number | null): void {
  getDb()
    .prepare('UPDATE faces SET person_id = ? WHERE id = ?')
    .run(personId, faceId);
}

export function deleteFacesByPhoto(photoFilename: string): void {
  getDb()
    .prepare('DELETE FROM faces WHERE photo_filename = ?')
    .run(photoFilename);
}

// ============ Person Operations ============

export function getAllPersons(): Person[] {
  return getDb().prepare('SELECT * FROM persons ORDER BY created_at DESC').all() as Person[];
}

export function getPersonById(id: number): Person | undefined {
  return getDb()
    .prepare('SELECT * FROM persons WHERE id = ?')
    .get(id) as Person | undefined;
}

export function createPerson(name: string): Person {
  const result = getDb()
    .prepare('INSERT INTO persons (name, created_at) VALUES (?, datetime("now"))')
    .run(name);

  return getPersonById(Number(result.lastInsertRowid))!;
}

export function updatePersonName(personId: number, name: string): void {
  getDb()
    .prepare('UPDATE persons SET name = ? WHERE id = ?')
    .run(name, personId);
}

export function deletePersonById(personId: number): void {
  const database = getDb();

  // Unassign faces
  database
    .prepare('UPDATE faces SET person_id = NULL WHERE person_id = ?')
    .run(personId);

  // Delete person
  database
    .prepare('DELETE FROM persons WHERE id = ?')
    .run(personId);
}

// ============ Processing Status ============

export function getProcessingStatus(photoFilename: string): ProcessingStatus | undefined {
  return getDb()
    .prepare('SELECT * FROM processing_status WHERE photo_filename = ?')
    .get(photoFilename) as ProcessingStatus | undefined;
}

export function getCompletedPhotosCount(): number {
  const result = getDb()
    .prepare("SELECT COUNT(*) as count FROM processing_status WHERE status = 'completed'")
    .get() as { count: number };
  return result.count;
}

// ============ Stats ============

export function getFacesCount(): number {
  const result = getDb()
    .prepare('SELECT COUNT(*) as count FROM faces')
    .get() as { count: number };
  return result.count;
}

export function getPersonsCount(): number {
  const result = getDb()
    .prepare('SELECT COUNT(*) as count FROM persons')
    .get() as { count: number };
  return result.count;
}

// ============ Photos by Person ============

export function getPhotosByPersonId(personId: number): string[] {
  const faces = getDb()
    .prepare('SELECT DISTINCT photo_filename FROM faces WHERE person_id = ?')
    .all(personId) as { photo_filename: string }[];

  return faces.map(f => f.photo_filename);
}

// ============ Photo Quality Operations ============

export interface PhotoQuality {
  photo_filename: string;
  blur_score: number;
  brightness_score: number;
  contrast_score: number;
  quality_score: number;
  is_blurry: number;
  is_dark: number;
  is_overexposed: number;
  is_low_contrast: number;
  assessed_at: string;
}

export function getPhotoQuality(photoFilename: string): PhotoQuality | undefined {
  return getDb()
    .prepare('SELECT * FROM photo_quality WHERE photo_filename = ?')
    .get(photoFilename) as PhotoQuality | undefined;
}

export function getAllPhotoQuality(): PhotoQuality[] {
  return getDb()
    .prepare('SELECT * FROM photo_quality ORDER BY quality_score DESC')
    .all() as PhotoQuality[];
}

// ============ Photo Metadata Operations ============

export interface PhotoMetadata {
  photo_filename: string;
  date_taken: string | null;
  date_taken_year: number | null;
  date_taken_month: number | null;
  date_taken_day: number | null;
  date_taken_season: string | null;
  file_size: number;
  width: number;
  height: number;
  orientation: string;
  camera_make: string | null;
  camera_model: string | null;
  has_gps: number;
  latitude: number | null;
  longitude: number | null;
  metadata_extracted_at: string;
}

export function getPhotoMetadata(photoFilename: string): PhotoMetadata | undefined {
  return getDb()
    .prepare('SELECT * FROM photo_metadata WHERE photo_filename = ?')
    .get(photoFilename) as PhotoMetadata | undefined;
}

export function getAllPhotoMetadata(): PhotoMetadata[] {
  return getDb()
    .prepare('SELECT * FROM photo_metadata ORDER BY date_taken DESC')
    .all() as PhotoMetadata[];
}

// ============ Memory Operations ============

export interface Memory {
  id: number;
  memory_type: string;
  title: string;
  description: string | null;
  date_start: string | null;
  date_end: string | null;
  person_id: number | null;
  memory_date: string;
  photo_count: number;
  cover_photo_filename: string | null;
  generated_at: string;
  is_dismissed: number;
}

export interface MemoryPhoto {
  memory_id: number;
  photo_filename: string;
  importance_score: number;
  display_order: number;
}

export function getAllMemories(includeDismissed: boolean = false): Memory[] {
  const query = includeDismissed
    ? 'SELECT * FROM memories ORDER BY generated_at DESC'
    : 'SELECT * FROM memories WHERE is_dismissed = 0 ORDER BY generated_at DESC';

  return getDb().prepare(query).all() as Memory[];
}

export function getMemoryById(memoryId: number): Memory | undefined {
  return getDb()
    .prepare('SELECT * FROM memories WHERE id = ?')
    .get(memoryId) as Memory | undefined;
}

export function getMemoryPhotos(memoryId: number): MemoryPhoto[] {
  return getDb()
    .prepare('SELECT * FROM memory_photos WHERE memory_id = ? ORDER BY display_order')
    .all(memoryId) as MemoryPhoto[];
}

export function dismissMemory(memoryId: number): void {
  getDb()
    .prepare('UPDATE memories SET is_dismissed = 1 WHERE id = ?')
    .run(memoryId);
}

export function deleteMemory(memoryId: number): void {
  const database = getDb();

  // Delete memory photos (cascade should handle this, but explicit is better)
  database
    .prepare('DELETE FROM memory_photos WHERE memory_id = ?')
    .run(memoryId);

  // Delete memory
  database
    .prepare('DELETE FROM memories WHERE id = ?')
    .run(memoryId);
}

export function getMemoriesByType(memoryType: string): Memory[] {
  return getDb()
    .prepare('SELECT * FROM memories WHERE memory_type = ? AND is_dismissed = 0 ORDER BY generated_at DESC')
    .all(memoryType) as Memory[];
}

export function getMemoriesByPerson(personId: number): Memory[] {
  return getDb()
    .prepare('SELECT * FROM memories WHERE person_id = ? AND is_dismissed = 0 ORDER BY generated_at DESC')
    .all(personId) as Memory[];
}

// Close database on exit
process.on('exit', () => {
  if (db) {
    db.close();
  }
});
