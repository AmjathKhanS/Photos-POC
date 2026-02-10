#!/usr/bin/env node
/**
 * Run Location Tables Migration
 * Adds photo_locations and location_clusters tables
 */

import { register } from 'tsx/esm/api';
const unregister = register();

try {
  console.log('📍 Running location tables migration...\n');

  const { runMigration } = await import('./src/migrations/add-location-tables.ts');
  await runMigration();

  console.log('\n✅ Migration completed successfully!');
  console.log('\nNext steps:');
  console.log('  1. Restart your dev server (or it will auto-reload)');
  console.log('  2. New photos will have GPS extracted during indexing');
  console.log('  3. Check Places tab to see photos with location data\n');
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  unregister();
}
