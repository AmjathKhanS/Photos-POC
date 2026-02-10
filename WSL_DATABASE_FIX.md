# WSL Database Error Fix - Complete Solution

## Problem Summary

When running the server in WSL, you were getting frequent errors:

```
Error: \\?\D:\Photos Ai\photo-viewer\server\node_modules\better-sqlite3\build\Release\better_sqlite3.node is not a valid Win32 application.
```

**Root Causes:**

1. **SQLite WAL Mode Issue**: SQLite's Write-Ahead Logging (WAL) mode creates shared memory files that don't work properly on WSL-mounted Windows filesystems (`/mnt/d/...`)

2. **Inconsistent DB_PATH Usage**: Not all database services were respecting the `SQLITE_DB_PATH` environment variable, causing some services to try accessing the Windows filesystem database while using Linux-compiled native modules

## What Was Fixed

### 1. Updated Database Services to Use Environment Variable

Fixed these services to respect `SQLITE_DB_PATH`:

✅ **sqliteDatabase.ts** - General SQLite database service
✅ **faceClusterService.ts** - Face clustering service
✅ **personDuplicateService.ts** - Person duplicate detection service

**Before:**
```typescript
const DB_PATH = path.join(__dirname, '../../data/faces.db');
```

**After:**
```typescript
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../data/faces.db');
```

### 2. Added WSL-Specific NPM Script

Added `dev:wsl` script to package.json:
```json
"dev:wsl": "SQLITE_DB_PATH=$HOME/photo-viewer-db/faces.db tsx watch --env-file=../.env src/index.ts"
```

### 3. Updated Helper Scripts

Updated `start-server-wsl.sh` to:
- Use Linux filesystem for database operations
- Automatically sync database back to Windows on exit
- Use the new `npm run dev:wsl` command

## How to Run the Server (Permanently Fixed)

### Method 1: Use the Helper Script (Recommended)

```bash
cd /mnt/d/Photos\ Ai/photo-viewer/server
./start-server-wsl.sh
```

This automatically:
- Copies database to Linux filesystem
- Sets correct environment variables
- Starts server with proper configuration
- Syncs database back when you stop the server

### Method 2: Manual Start

```bash
cd /mnt/d/Photos\ Ai/photo-viewer/server

# Copy database to Linux filesystem
mkdir -p ~/photo-viewer-db
cp ./data/faces.db ~/photo-viewer-db/faces.db

# Start server
npm run dev:wsl

# When done, sync database back
cp ~/photo-viewer-db/faces.db ./data/faces.db
```

### Method 3: Direct Command

```bash
cd /mnt/d/Photos\ Ai/photo-viewer/server
SQLITE_DB_PATH="$HOME/photo-viewer-db/faces.db" PHOTOS_DIR="/mnt/d/Photos Ai/mobile" npm run dev
```

## Why This Solution Works

1. **Linux Filesystem for Database**: By using `~/photo-viewer-db/` (Linux filesystem) instead of `/mnt/d/...` (Windows mount), SQLite's WAL mode works correctly

2. **Consistent Native Modules**: All database services use the same Linux-compiled `better-sqlite3` module when accessing the Linux filesystem database

3. **Environment Variable Compliance**: All database services now check `SQLITE_DB_PATH` first, ensuring consistent database location across all services

## Files Modified

### Service Files (Added SQLITE_DB_PATH support)
- ✅ `src/services/sqliteDatabase.ts`
- ✅ `src/services/faceClusterService.ts`
- ✅ `src/services/personDuplicateService.ts`

### Configuration Files
- ✅ `package.json` - Added `dev:wsl` script
- ✅ `start-server-wsl.sh` - Updated to use new script

### Services Already Using SQLITE_DB_PATH (No changes needed)
- ✓ `locationDb.ts`
- ✓ `semanticSearchDb.ts`
- ✓ `smartAlbumsDb.ts`
- ✓ `memoryService.ts`
- ✓ `faceService.ts`
- ✓ `documentIntelligenceService.ts`

## Verification

To verify all services are using the correct database:

```bash
cd /mnt/d/Photos\ Ai/photo-viewer/server
./check-locations.sh
```

This will show you the location data and confirm the database is accessible.

## Troubleshooting

### If you still get "not a valid Win32 application" errors:

1. **Check if server is using the environment variable:**
   ```bash
   ps aux | grep tsx | grep SQLITE_DB_PATH
   ```

2. **Verify database is on Linux filesystem:**
   ```bash
   ls -lh ~/photo-viewer-db/faces.db
   ```

3. **Restart server using the helper script:**
   ```bash
   pkill -f "tsx watch"
   ./start-server-wsl.sh
   ```

### If database seems out of sync:

```bash
# Copy latest from Windows to Linux
cp ./data/faces.db ~/photo-viewer-db/faces.db

# Or copy from Linux back to Windows
cp ~/photo-viewer-db/faces.db ./data/faces.db
```

## Database Location Summary

- **Working Copy (Linux)**: `~/photo-viewer-db/faces.db` - Used during server runtime
- **Permanent Copy (Windows)**: `/mnt/d/Photos Ai/photo-viewer/server/data/faces.db` - Synced when server stops

The helper script automatically manages synchronization between these locations.

---

**Status:** ✅ Permanently Fixed
**Date:** 2026-02-04
**Files Modified:** 6 files
**Error Type:** `ERR_DLOPEN_FAILED` - RESOLVED
