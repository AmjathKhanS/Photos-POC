#!/usr/bin/env node
/**
 * Check if running in WSL and verify environment variables are set
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if running in WSL
function isWSL() {
  try {
    const procVersion = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
    return procVersion.includes('microsoft') || procVersion.includes('wsl');
  } catch {
    return false;
  }
}

// Check if database path is on Windows mount
function isWindowsMount(dbPath) {
  return dbPath.startsWith('/mnt/') || dbPath.includes(':\\');
}

function main() {
  if (!isWSL()) {
    // Not running in WSL, no need to check
    process.exit(0);
  }

  const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, 'data/faces.db');

  // Allow Windows mount paths if PYTHON_EXECUTABLE is set (for Python interop)
  if (isWindowsMount(dbPath) && !process.env.PYTHON_EXECUTABLE) {
    console.error('\n❌ ERROR: Running in WSL but database is on Windows filesystem!');
    console.error('');
    console.error('The SQLITE_DB_PATH is set to:', dbPath);
    console.error('');
    console.error('This will cause "not a valid Win32 application" errors because');
    console.error('better-sqlite3 native modules compiled for Linux cannot access');
    console.error('databases on Windows-mounted filesystems (/mnt/...).');
    console.error('');
    console.error('🔧 SOLUTION: Use the helper script to start the server:');
    console.error('   ./start-server-wsl.sh');
    console.error('');
    console.error('Or manually set the environment variable:');
    console.error('   export SQLITE_DB_PATH="$HOME/photo-viewer-db/faces.db"');
    console.error('');
    process.exit(1);
  }

  console.log('✅ WSL environment check passed');
  console.log('   Database location:', dbPath);
  if (process.env.PYTHON_EXECUTABLE) {
    console.log('   Python interop enabled:', process.env.PYTHON_EXECUTABLE);
  }
}

main();
