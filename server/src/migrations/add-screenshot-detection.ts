/**
 * Migration: Add Screenshot Detection
 * Adds is_screenshot column to semantic_processing_status table
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../data/faces.db');

export function runMigration() {
  console.log('Running migration: add-screenshot-detection');
  console.log(`Database path: ${DB_PATH}`);

  const db = new Database(DB_PATH);

  try {
    // Check if column already exists
    const tableInfo = db.prepare("PRAGMA table_info(semantic_processing_status)").all() as any[];
    const hasColumn = tableInfo.some((col: any) => col.name === 'is_screenshot');

    if (!hasColumn) {
      console.log('Adding is_screenshot column to semantic_processing_status table...');
      db.exec(`
        ALTER TABLE semantic_processing_status
        ADD COLUMN is_screenshot BOOLEAN DEFAULT 0
      `);
      console.log('✓ Column added successfully');
    } else {
      console.log('✓ is_screenshot column already exists');
    }

    db.close();
    return true;
  } catch (error) {
    console.error('✗ Migration failed:', error);
    db.close();
    throw error;
  }
}

// Only run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration();
}
