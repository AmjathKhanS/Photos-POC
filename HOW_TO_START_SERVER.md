# How to Start the Server (WSL)

## ⚠️ IMPORTANT: Always Use the Helper Script!

When running in WSL, **ALWAYS** start the server using the helper script:

```bash
cd /mnt/d/Photos\ Ai/photo-viewer/server
./start-server-wsl.sh
```

## Why You Must Use the Helper Script

If you try to start the server directly with `npm run dev` or by clicking "Start" in your IDE, you will get frequent errors like:

```
Error: not a valid Win32 application
ERR_DLOPEN_FAILED
```

**Reason:** The server needs the database to be on the **Linux filesystem** (not the Windows mount at `/mnt/d/...`) because:

1. SQLite's WAL mode doesn't work properly on Windows mounts in WSL
2. The better-sqlite3 native module is compiled for Linux
3. Without the correct environment variables, services try to access the Windows database

## What the Helper Script Does

The `start-server-wsl.sh` script automatically:

1. ✅ Copies the database to Linux filesystem (`~/photo-viewer-db/`)
2. ✅ Sets `SQLITE_DB_PATH` to point to the Linux database
3. ✅ Sets `PHOTOS_DIR` to your photos location
4. ✅ Starts the server with correct configuration
5. ✅ Syncs database back to Windows when you stop the server (Ctrl+C)

## Current Server Status

Your server is currently running **correctly** at:
- **Backend:** http://localhost:3002
- **Database:** `~/photo-viewer-db/faces.db` (Linux filesystem)
- **Photos:** `/mnt/d/Photos Ai/mobile`
- **Status:** ✅ No errors

## What Happened Before

You were getting errors because:
- Multiple server instances were running
- They were started without the `SQLITE_DB_PATH` environment variable
- They tried to access the Windows database with Linux native modules
- This caused the "not a valid Win32 application" error

## Safeguard Added

I've added an automatic check that will **prevent** this from happening again:

- If you try to run `npm run dev` directly in WSL without setting the environment variable
- You'll get a clear error message telling you to use `./start-server-wsl.sh` instead

## How to Stop the Server

Press `Ctrl+C` in the terminal where the server is running.

The database will automatically sync back to the Windows filesystem.

## Quick Commands

```bash
# Start server (ALWAYS USE THIS)
./start-server-wsl.sh

# Check if server is running
curl http://localhost:3002/health

# Check location data
./check-locations.sh

# Extract GPS from new photos
./extract-gps-wsl.sh
```

## Alternative: Run on Windows

If you don't want to deal with WSL filesystem issues, you can:

1. **Install Node.js on Windows** (not in WSL)
2. **Open PowerShell or CMD** (not WSL terminal)
3. **Run directly:**
   ```powershell
   cd "D:\Photos Ai\photo-viewer\server"
   npm run dev
   ```

This works because Windows Node.js uses the Windows-compiled better-sqlite3 module which can access Windows filesystems normally.

---

**Remember:** In WSL, always use `./start-server-wsl.sh` ✅
