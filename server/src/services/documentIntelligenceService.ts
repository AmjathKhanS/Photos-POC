/**
 * Document Intelligence Service
 * Manages document classification, entity extraction, and search
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PYTHON_CMD = process.env.PYTHON_EXECUTABLE || 'python3';
const DOCUMENT_SERVICE_PATH = path.join(__dirname, '../../ai/document_intelligence_service.py');
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../data/faces.db');

export interface DocumentMetadata {
  id: number;
  photo_filename: string;
  document_type: string;
  document_subtype: string | null;
  confidence: number;
  extracted_text: string;
  extracted_date: string | null;
  extracted_amount: number | null;
  extracted_currency: string | null;
  extracted_names: string; // JSON array
  extracted_entities: string; // JSON object
  document_number: string | null;
  expiry_date: string | null;
  importance_score: number;
  is_starred: boolean;
  processed_at: string;
  last_updated: string;
}

export interface DocumentAlert {
  id: number;
  photo_filename: string;
  alert_type: string;
  alert_message: string;
  alert_date: string;
  is_dismissed: boolean;
  dismissed_at: string | null;
}

export interface DocumentSearchFilters {
  document_type?: string;
  min_amount?: number;
  max_amount?: number;
  start_date?: string;
  end_date?: string;
  has_expiry?: boolean;
  is_starred?: boolean;
  search_query?: string;
}

/**
 * Call Python document intelligence service
 */
async function callDocumentService(action: string, filename?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const args = [
      DOCUMENT_SERVICE_PATH,
      '--db-path', DB_PATH,
      '--action', action,
    ];

    if (filename) {
      args.push('--filename', filename);
    }

    // On Windows, .bat files need to be executed with shell: true
    const spawnOptions = PYTHON_CMD.endsWith('.bat') ? { shell: true } : {};
    const process = spawn(PYTHON_CMD, args, spawnOptions);

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        console.error('Document service error:', stderr);
        reject(new Error(`Document service exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (error) {
        console.error('Failed to parse document service output:', stdout);
        reject(new Error(`Invalid JSON from document service: ${error}`));
      }
    });

    process.on('error', (error) => {
      reject(new Error(`Failed to start document service: ${error.message}`));
    });
  });
}

/**
 * Process all documents in the library
 */
export async function processAllDocuments(): Promise<{
  success: boolean;
  total: number;
  processed: number;
  failed: number;
  error?: string;
}> {
  try {
    console.log('📄 Starting document intelligence processing...');
    const result = await callDocumentService('process-all');

    console.log(`✅ Processed ${result.processed}/${result.total} documents`);

    return {
      success: true,
      total: result.total,
      processed: result.processed,
      failed: result.failed,
    };
  } catch (error) {
    console.error('Document processing failed:', error);
    return {
      success: false,
      total: 0,
      processed: 0,
      failed: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Process a single document
 */
export async function processSingleDocument(filename: string): Promise<{
  success: boolean;
  metadata?: any;
  error?: string;
}> {
  try {
    const result = await callDocumentService('process-one', filename);
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get all documents with filters
 */
export function getAllDocuments(filters: DocumentSearchFilters = {}): DocumentMetadata[] {
  const db = new Database(DB_PATH, { readonly: true });

  let query = `
    SELECT dm.*, pm.file_size, pm.width, pm.height
    FROM document_metadata dm
    LEFT JOIN photo_metadata pm ON dm.photo_filename = pm.photo_filename
    WHERE 1=1
  `;

  const params: any[] = [];

  if (filters.document_type) {
    query += ` AND dm.document_type = ?`;
    params.push(filters.document_type);
  }

  if (filters.min_amount !== undefined) {
    query += ` AND dm.extracted_amount >= ?`;
    params.push(filters.min_amount);
  }

  if (filters.max_amount !== undefined) {
    query += ` AND dm.extracted_amount <= ?`;
    params.push(filters.max_amount);
  }

  if (filters.start_date) {
    query += ` AND dm.extracted_date >= ?`;
    params.push(filters.start_date);
  }

  if (filters.end_date) {
    query += ` AND dm.extracted_date <= ?`;
    params.push(filters.end_date);
  }

  if (filters.has_expiry) {
    query += ` AND dm.expiry_date IS NOT NULL`;
  }

  if (filters.is_starred !== undefined) {
    query += ` AND dm.is_starred = ?`;
    params.push(filters.is_starred ? 1 : 0);
  }

  if (filters.search_query) {
    query += ` AND dm.photo_filename IN (
      SELECT photo_filename FROM document_search_fts
      WHERE document_search_fts MATCH ?
    )`;
    params.push(filters.search_query);
  }

  query += ` ORDER BY dm.importance_score DESC, dm.extracted_date DESC`;

  const stmt = db.prepare(query);
  const documents = stmt.all(...params) as DocumentMetadata[];
  db.close();

  return documents;
}

/**
 * Get document by filename
 */
export function getDocumentByFilename(filename: string): DocumentMetadata | undefined {
  const db = new Database(DB_PATH, { readonly: true });

  const stmt = db.prepare(`
    SELECT dm.*, pm.file_size, pm.width, pm.height
    FROM document_metadata dm
    LEFT JOIN photo_metadata pm ON dm.photo_filename = pm.photo_filename
    WHERE dm.photo_filename = ?
  `);

  const document = stmt.get(filename) as DocumentMetadata | undefined;
  db.close();

  return document;
}

/**
 * Get document statistics
 */
export function getDocumentStats(): any {
  const db = new Database(DB_PATH, { readonly: true });

  const total = db.prepare('SELECT COUNT(*) as count FROM document_metadata').get() as { count: number };

  const byType = db.prepare(`
    SELECT document_type, COUNT(*) as count
    FROM document_metadata
    GROUP BY document_type
    ORDER BY count DESC
  `).all();

  const totalAmount = db.prepare(`
    SELECT
      SUM(extracted_amount) as total_amount,
      AVG(extracted_amount) as avg_amount,
      COUNT(CASE WHEN extracted_amount IS NOT NULL THEN 1 END) as with_amount
    FROM document_metadata
  `).get();

  const expiringCount = db.prepare(`
    SELECT COUNT(*) as count
    FROM document_metadata
    WHERE expiry_date IS NOT NULL
      AND DATE(expiry_date) BETWEEN DATE('now') AND DATE('now', '+30 days')
  `).get() as { count: number };

  const expiredCount = db.prepare(`
    SELECT COUNT(*) as count
    FROM document_metadata
    WHERE expiry_date IS NOT NULL
      AND DATE(expiry_date) < DATE('now')
  `).get() as { count: number };

  db.close();

  return {
    total_documents: total.count,
    by_type: byType,
    financial: {
      ...totalAmount,
    },
    expiring_soon: expiringCount.count,
    expired: expiredCount.count,
  };
}

/**
 * Get active alerts
 */
export function getActiveAlerts(): DocumentAlert[] {
  const db = new Database(DB_PATH, { readonly: true });

  const stmt = db.prepare(`
    SELECT * FROM document_alerts
    WHERE is_dismissed = 0
    ORDER BY alert_date DESC
  `);

  const alerts = stmt.all() as DocumentAlert[];
  db.close();

  return alerts;
}

/**
 * Dismiss an alert
 */
export function dismissAlert(alertId: number): void {
  const db = new Database(DB_PATH);

  const stmt = db.prepare(`
    UPDATE document_alerts
    SET is_dismissed = 1, dismissed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  stmt.run(alertId);
  db.close();
}

/**
 * Star/unstar a document
 */
export function toggleStar(filename: string, isStarred: boolean): void {
  const db = new Database(DB_PATH);

  const stmt = db.prepare(`
    UPDATE document_metadata
    SET is_starred = ?
    WHERE photo_filename = ?
  `);

  stmt.run(isStarred ? 1 : 0, filename);
  db.close();
}

/**
 * Search documents using full-text search
 */
export function searchDocuments(query: string): DocumentMetadata[] {
  const db = new Database(DB_PATH, { readonly: true });

  const stmt = db.prepare(`
    SELECT dm.*, pm.file_size, pm.width, pm.height
    FROM document_metadata dm
    LEFT JOIN photo_metadata pm ON dm.photo_filename = pm.photo_filename
    WHERE dm.photo_filename IN (
      SELECT photo_filename FROM document_search_fts
      WHERE document_search_fts MATCH ?
    )
    ORDER BY dm.importance_score DESC
    LIMIT 100
  `);

  const documents = stmt.all(query) as DocumentMetadata[];
  db.close();

  return documents;
}

/**
 * Get expiring documents
 */
export function getExpiringDocuments(daysAhead: number = 30): DocumentMetadata[] {
  const db = new Database(DB_PATH, { readonly: true });

  const stmt = db.prepare(`
    SELECT dm.*, pm.file_size, pm.width, pm.height
    FROM document_metadata dm
    LEFT JOIN photo_metadata pm ON dm.photo_filename = pm.photo_filename
    WHERE dm.expiry_date IS NOT NULL
      AND DATE(dm.expiry_date) BETWEEN DATE('now') AND DATE('now', '+' || ? || ' days')
    ORDER BY dm.expiry_date ASC
  `);

  const documents = stmt.all(daysAhead) as DocumentMetadata[];
  db.close();

  return documents;
}

/**
 * Delete document metadata
 */
export function deleteDocument(filename: string): void {
  const db = new Database(DB_PATH);

  const stmt = db.prepare('DELETE FROM document_metadata WHERE photo_filename = ?');
  stmt.run(filename);

  db.close();
}
