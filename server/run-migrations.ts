import { runMigration as runScreenshotMigration } from './src/migrations/add-screenshot-detection.js';
import { runMigration as runLocationMigration } from './src/migrations/add-location-tables.js';

async function runAll() {
  try {
    console.log('Running all migrations...\n');
    await runScreenshotMigration();
    await runLocationMigration();
    console.log('\n✅ All migrations completed!');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

runAll();
