import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '../data/faces.db');

const db = new Database(DB_PATH);

console.log('Checking semantic search tables...\n');

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all() as { name: string }[];

const semanticTables = tables.filter(t =>
  t.name.includes('photo_ocr') ||
  t.name.includes('photo_visual') ||
  t.name.includes('photo_embeddings') ||
  t.name.includes('semantic_processing')
);

console.log('All tables:');
tables.forEach(t => console.log(`  - ${t.name}`));

console.log('\nSemantic search tables:');
if (semanticTables.length > 0) {
  semanticTables.forEach(t => console.log(`  ✓ ${t.name}`));
} else {
  console.log('  ✗ No semantic search tables found');
}

db.close();
