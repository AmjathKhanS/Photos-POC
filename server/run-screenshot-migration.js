#!/usr/bin/env node
/**
 * Run Screenshot Detection Migration
 * Adds is_screenshot column to semantic_processing_status table
 */

import { register } from 'tsx/esm/api';
const unregister = register();

try {
  console.log('📦 Running screenshot detection migration...\n');

  const { runMigration } = await import('./src/migrations/add-screenshot-detection.ts');
  await runMigration();

  console.log('\n✅ Migration completed successfully!');
  console.log('\nNext steps:');
  console.log('  1. Restart your dev server (Ctrl+C, then npm run dev)');
  console.log('  2. New photos will be analyzed during indexing');
  console.log('  3. Check Screenshots & Snips tab after indexing completes\n');
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  unregister();
}
