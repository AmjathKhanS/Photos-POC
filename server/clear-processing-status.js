import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.SQLITE_DB_PATH || '/mnt/d/Photos Ai/photo-viewer/server/data-wsl/faces.db';

console.log('Clearing processing_status table to allow face detection...');
console.log('Database:', DB_PATH);

const db = new Database(DB_PATH);

try {
  const result = db.prepare('DELETE FROM processing_status').run();
  console.log(`✅ Cleared ${result.changes} records from processing_status table`);
  console.log('Face detection can now process all photos fresh.');
} catch (error) {
  console.error('Error:', error.message);
} finally {
  db.close();
}
