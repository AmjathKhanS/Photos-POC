/**
 * Semantic Search Database Service
 * Provides database operations for semantic search features
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

export interface OcrText {
  id: number;
  photo_filename: string;
  extracted_text: string;
  confidence: number | null;
  num_blocks: number | null;
  language: string;
  created_at: string;
}

export interface VisualTag {
  id: number;
  photo_filename: string;
  tag: string;
  confidence: number;
  source: string;
  created_at: string;
}

export interface PhotoEmbedding {
  photo_filename: string;
  clip_embedding: Buffer;
  text_embedding: Buffer | null;
  embedding_version: string;
  created_at: string;
}

export interface SemanticProcessingStatus {
  photo_filename: string;
  ocr_processed: boolean;
  clip_processed: boolean;
  is_screenshot: boolean;
  last_processed_at: string | null;
  processing_time_ms: number | null;
  error_message: string | null;
}

export interface SearchResult {
  photo_filename: string;
  score: number;
  match_type: 'visual' | 'text' | 'tag' | 'hybrid';
  ocr_text?: string;
  matched_tags?: string[];
}

// ============ OCR Text Operations ============

export function insertOcrText(
  photo_filename: string,
  extracted_text: string,
  confidence: number | null = null,
  num_blocks: number | null = null,
  language: string = 'en'
): void {
  getDb()
    .prepare(
      `INSERT INTO photo_ocr_text (photo_filename, extracted_text, confidence, num_blocks, language)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(photo_filename, extracted_text, confidence, num_blocks, language);
}

export function getOcrText(photo_filename: string): OcrText | undefined {
  return getDb()
    .prepare('SELECT * FROM photo_ocr_text WHERE photo_filename = ?')
    .get(photo_filename) as OcrText | undefined;
}

export function searchOcrTextFts(query: string, limit: number = 50): string[] {
  const results = getDb()
    .prepare(
      `SELECT photo_filename FROM photo_ocr_text_fts
       WHERE photo_ocr_text_fts MATCH ?
       LIMIT ?`
    )
    .all(query, limit) as { photo_filename: string }[];

  return results.map(r => r.photo_filename);
}

export function deleteOcrText(photo_filename: string): void {
  getDb()
    .prepare('DELETE FROM photo_ocr_text WHERE photo_filename = ?')
    .run(photo_filename);
}

// ============ Visual Tags Operations ============

export function insertVisualTag(
  photo_filename: string,
  tag: string,
  confidence: number,
  source: string = 'clip'
): void {
  getDb()
    .prepare(
      `INSERT INTO photo_visual_tags (photo_filename, tag, confidence, source)
       VALUES (?, ?, ?, ?)`
    )
    .run(photo_filename, tag, confidence, source);
}

export function insertVisualTags(
  photo_filename: string,
  tags: Array<{ tag: string; confidence: number }>,
  source: string = 'clip'
): void {
  const stmt = getDb().prepare(
    `INSERT INTO photo_visual_tags (photo_filename, tag, confidence, source)
     VALUES (?, ?, ?, ?)`
  );

  const transaction = getDb().transaction((filename: string, tagList: typeof tags) => {
    for (const { tag, confidence } of tagList) {
      stmt.run(filename, tag, confidence, source);
    }
  });

  transaction(photo_filename, tags);
}

export function getVisualTags(photo_filename: string): VisualTag[] {
  return getDb()
    .prepare('SELECT * FROM photo_visual_tags WHERE photo_filename = ? ORDER BY confidence DESC')
    .all(photo_filename) as VisualTag[];
}

export function getAllVisualTags(): VisualTag[] {
  return getDb()
    .prepare('SELECT * FROM photo_visual_tags ORDER BY confidence DESC')
    .all() as VisualTag[];
}

export function searchByTag(tag: string, minConfidence: number = 0.3): string[] {
  const results = getDb()
    .prepare(
      `SELECT DISTINCT photo_filename FROM photo_visual_tags
       WHERE tag = ? AND confidence >= ?
       ORDER BY confidence DESC`
    )
    .all(tag, minConfidence) as { photo_filename: string }[];

  return results.map(r => r.photo_filename);
}

export function deleteVisualTags(photo_filename: string): void {
  getDb()
    .prepare('DELETE FROM photo_visual_tags WHERE photo_filename = ?')
    .run(photo_filename);
}

// ============ Embeddings Operations ============

export function insertEmbedding(
  photo_filename: string,
  clip_embedding: Buffer,
  text_embedding: Buffer | null = null,
  embedding_version: string = 'v1'
): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO photo_embeddings (photo_filename, clip_embedding, text_embedding, embedding_version)
       VALUES (?, ?, ?, ?)`
    )
    .run(photo_filename, clip_embedding, text_embedding, embedding_version);
}

export function getEmbedding(photo_filename: string): PhotoEmbedding | undefined {
  return getDb()
    .prepare('SELECT * FROM photo_embeddings WHERE photo_filename = ?')
    .get(photo_filename) as PhotoEmbedding | undefined;
}

export function getAllEmbeddings(): PhotoEmbedding[] {
  return getDb()
    .prepare('SELECT * FROM photo_embeddings')
    .all() as PhotoEmbedding[];
}

export function deleteEmbedding(photo_filename: string): void {
  getDb()
    .prepare('DELETE FROM photo_embeddings WHERE photo_filename = ?')
    .run(photo_filename);
}

// ============ Processing Status Operations ============

export function upsertProcessingStatus(
  photo_filename: string,
  ocr_processed: boolean,
  clip_processed: boolean,
  processing_time_ms: number | null = null,
  error_message: string | null = null,
  is_screenshot: boolean = false
): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO semantic_processing_status
       (photo_filename, ocr_processed, clip_processed, is_screenshot, last_processed_at, processing_time_ms, error_message)
       VALUES (?, ?, ?, ?, datetime('now'), ?, ?)`
    )
    .run(photo_filename, ocr_processed ? 1 : 0, clip_processed ? 1 : 0, is_screenshot ? 1 : 0, processing_time_ms, error_message);
}

export function getProcessingStatus(photo_filename: string): SemanticProcessingStatus | undefined {
  const result = getDb()
    .prepare('SELECT * FROM semantic_processing_status WHERE photo_filename = ?')
    .get(photo_filename) as any;

  if (!result) return undefined;

  return {
    ...result,
    ocr_processed: Boolean(result.ocr_processed),
    clip_processed: Boolean(result.clip_processed),
    is_screenshot: Boolean(result.is_screenshot),
  };
}

export function getProcessingStats(): {
  total: number;
  processed: number;
  pending: number;
  failed: number;
} {
  const result = getDb()
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN ocr_processed = 1 AND clip_processed = 1 THEN 1 ELSE 0 END) as processed,
        SUM(CASE WHEN (ocr_processed = 0 OR clip_processed = 0) AND error_message IS NULL THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END) as failed
       FROM semantic_processing_status`
    )
    .get() as any;

  return {
    total: result.total || 0,
    processed: result.processed || 0,
    pending: result.pending || 0,
    failed: result.failed || 0,
  };
}

export function getUnprocessedPhotos(limit: number = 100): string[] {
  const results = getDb()
    .prepare(
      `SELECT photo_filename FROM semantic_processing_status
       WHERE ocr_processed = 0 OR clip_processed = 0
       LIMIT ?`
    )
    .all(limit) as { photo_filename: string }[];

  return results.map(r => r.photo_filename);
}

// ============ Utility Functions ============

export function clearSemanticData(photo_filename: string): void {
  const transaction = getDb().transaction(() => {
    deleteOcrText(photo_filename);
    deleteVisualTags(photo_filename);
    deleteEmbedding(photo_filename);
    getDb()
      .prepare('DELETE FROM semantic_processing_status WHERE photo_filename = ?')
      .run(photo_filename);
  });

  transaction();
}

export function getSemanticSearchStats(): {
  total_photos_with_ocr: number;
  total_photos_with_embeddings: number;
  total_visual_tags: number;
  avg_processing_time_ms: number;
} {
  const result = getDb()
    .prepare(
      `SELECT
        (SELECT COUNT(DISTINCT photo_filename) FROM photo_ocr_text) as total_photos_with_ocr,
        (SELECT COUNT(*) FROM photo_embeddings) as total_photos_with_embeddings,
        (SELECT COUNT(*) FROM photo_visual_tags) as total_visual_tags,
        (SELECT AVG(processing_time_ms) FROM semantic_processing_status WHERE processing_time_ms IS NOT NULL) as avg_processing_time_ms`
    )
    .get() as any;

  return {
    total_photos_with_ocr: result.total_photos_with_ocr || 0,
    total_photos_with_embeddings: result.total_photos_with_embeddings || 0,
    total_visual_tags: result.total_visual_tags || 0,
    avg_processing_time_ms: result.avg_processing_time_ms || 0,
  };
}

// Close database on exit
process.on('exit', () => {
  if (db) {
    db.close();
  }
});
