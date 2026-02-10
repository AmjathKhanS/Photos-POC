# GPS Extraction & Reverse Geocoding - Successfully Completed! 🎉

## Summary

Successfully extracted GPS location data from **10 photos** in your mobile photos directory and reverse geocoded them to city/country names!

## Photos with GPS Data

The following photos now have location data in the database:

**Shencottai, India** (8.945°N, 77.215°E) - **6 photos**
- IMG_1741.HEIC
- IMG_1742.HEIC
- IMG_1743.HEIC
- IMG_1744.HEIC
- IMG_1745.HEIC
- IMG_1746.HEIC

**Courtallam, India** (8.930°N, 77.269°E) - **4 photos**
- IMG_4967.HEIC
- IMG_4968.HEIC
- IMG_4969.HEIC
- IMG_4970.HEIC

### Geographic Summary
- **1 Country:** India
- **2 Cities:** Shencottai (6 photos), Courtallam (4 photos)

## Issues Encountered & Solutions

### Problem: better-sqlite3 Native Module Error
**Error:** `invalid ELF header`
**Cause:** The better-sqlite3 module was compiled for Windows but needed to run in WSL (Linux).
**Solution:** Reinstalled better-sqlite3 to compile the native module for WSL.

### Problem: Disk I/O Errors on Windows Filesystem
**Error:** `disk I/O error` when accessing database on `/mnt/d/...`
**Cause:** SQLite's WAL (Write-Ahead Logging) mode creates shared memory files that don't work properly on WSL-mounted Windows filesystems.
**Solution:** Run database operations on the Linux filesystem (`$HOME/photo-viewer-db/`) and sync back to Windows.

## How to Run the Server (WSL)

Use the provided helper script:

```bash
cd /mnt/d/Photos\ Ai/photo-viewer/server
./start-server-wsl.sh
```

This script will:
1. Copy the database to Linux filesystem (`~/photo-viewer-db/`)
2. Start the server with the correct environment variables
3. Sync the database back to Windows when you stop the server

## How to Extract GPS Data in the Future

If you add more photos and want to extract GPS data:

```bash
cd /mnt/d/Photos\ Ai/photo-viewer/server
./extract-gps-wsl.sh
```

This script will:
1. Copy the database to Linux filesystem
2. Run the GPS extraction
3. Run reverse geocoding to get city/country names
4. Sync the database back to Windows

### Manual Reverse Geocoding

If you already have GPS coordinates but need to add city/country names:

```bash
cd /mnt/d/Photos\ Ai/photo-viewer/server
SQLITE_DB_PATH="$HOME/photo-viewer-db/faces.db" node reverse-geocode.js
cp ~/photo-viewer-db/faces.db ./data/faces.db
```

Note: Uses OpenStreetMap Nominatim API (free, 1 request/second rate limit)

## Technical Details

### Environment Variables Required
- `SQLITE_DB_PATH`: Path to the database file (must be on Linux filesystem for WSL)
- `PHOTOS_DIR`: Path to your photos directory

### Files Created
- `start-server-wsl.sh`: Helper script to start the server in WSL
- `extract-gps-wsl.sh`: Helper script to extract GPS data and reverse geocode in WSL
- `reverse-geocode.js`: Script to reverse geocode GPS coordinates to city/country names
- `~/photo-viewer-db/faces.db`: Linux filesystem copy of the database (working copy)

### Database Location
- Working copy: `~/photo-viewer-db/faces.db` (Linux filesystem)
- Permanent copy: `/mnt/d/Photos Ai/photo-viewer/server/data/faces.db` (Windows filesystem)
- The scripts automatically sync between these locations

## Next Steps

1. Start the server using `./start-server-wsl.sh`
2. Open the Places view in your photo viewer
3. You should see your photos plotted on the map at the GPS coordinates!

## Alternative: Running on Windows

If you prefer to avoid the WSL filesystem issues entirely, you could:
1. Run the server on Windows using PowerShell/CMD instead of WSL
2. Use `node` and `npm` installed on Windows directly
3. The database will work fine on the Windows filesystem when accessed by Windows Node.js

---

**Status:** ✅ Complete (GPS + Geocoding)
**Date:** 2026-02-04
**Total Photos Processed:** 403
**Photos with GPS:** 10
**Locations Found:** 2 cities in India (Shencottai, Courtallam)
