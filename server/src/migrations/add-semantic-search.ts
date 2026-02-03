/**
 * Migration: Add Semantic Search Tables
 * Adds tables for OCR text, visual tags, embeddings, and processing status
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../data/faces.db');

export function runMigration() {
  console.log('Running migration: add-semantic-search');
  console.log(`Database path: ${DB_PATH}`);

  const db = new Database(DB_PATH);

  try {
    // Enable foreign keys
    db.exec('PRAGMA foreign_keys = ON');

    // 1. Create photo_ocr_text table
    console.log('Creating photo_ocr_text table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS photo_ocr_text (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        photo_filename TEXT NOT NULL,
        extracted_text TEXT NOT NULL,
        confidence REAL,
        num_blocks INTEGER,
        language TEXT DEFAULT 'en',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_photo_ocr_text_photo_filename
      ON photo_ocr_text(photo_filename)
    `);

    // Create FTS5 virtual table for full-text search
    console.log('Creating FTS5 virtual table for text search...');
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS photo_ocr_text_fts USING fts5(
        photo_filename,
        extracted_text,
        content=photo_ocr_text,
        content_rowid=id
      )
    `);

    // Create triggers to keep FTS table in sync
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS photo_ocr_text_ai AFTER INSERT ON photo_ocr_text BEGIN
        INSERT INTO photo_ocr_text_fts(rowid, photo_filename, extracted_text)
        VALUES (new.id, new.photo_filename, new.extracted_text);
      END
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS photo_ocr_text_ad AFTER DELETE ON photo_ocr_text BEGIN
        DELETE FROM photo_ocr_text_fts WHERE rowid = old.id;
      END
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS photo_ocr_text_au AFTER UPDATE ON photo_ocr_text BEGIN
        DELETE FROM photo_ocr_text_fts WHERE rowid = old.id;
        INSERT INTO photo_ocr_text_fts(rowid, photo_filename, extracted_text)
        VALUES (new.id, new.photo_filename, new.extracted_text);
      END
    `);

    // 2. Create photo_visual_tags table
    console.log('Creating photo_visual_tags table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS photo_visual_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        photo_filename TEXT NOT NULL,
        tag TEXT NOT NULL,
        confidence REAL NOT NULL,
        source TEXT DEFAULT 'clip',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_photo_visual_tags_photo_filename
      ON photo_visual_tags(photo_filename)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_photo_visual_tags_tag
      ON photo_visual_tags(tag)
    `);

    // 3. Create photo_embeddings table
    console.log('Creating photo_embeddings table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS photo_embeddings (
        photo_filename TEXT PRIMARY KEY,
        clip_embedding BLOB NOT NULL,
        text_embedding BLOB,
        embedding_version TEXT DEFAULT 'v1',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_photo_embeddings_created_at
      ON photo_embeddings(created_at)
    `);

    // 4. Create semantic_processing_status table
    console.log('Creating semantic_processing_status table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS semantic_processing_status (
        photo_filename TEXT PRIMARY KEY,
        ocr_processed BOOLEAN DEFAULT 0,
        clip_processed BOOLEAN DEFAULT 0,
        last_processed_at TIMESTAMP,
        processing_time_ms INTEGER,
        error_message TEXT
      )
    `);

    console.log('✓ Migration completed successfully');
    console.log('\nCreated tables:');
    console.log('  - photo_ocr_text (with FTS5 index)');
    console.log('  - photo_visual_tags');
    console.log('  - photo_embeddings');
    console.log('  - semantic_processing_status');

    db.close();
    return true;
  } catch (error) {
    console.error('✗ Migration failed:', error);
    db.close();
    throw error;
  }
}

// Run migration immediately
runMigration();
