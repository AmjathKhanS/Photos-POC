# Quick Start Guide - WSL

## Start the Server

```bash
./start-server-wsl.sh
```

That's it! The script handles everything automatically:
- ✅ Database setup on Linux filesystem
- ✅ Correct environment variables
- ✅ Auto-sync back to Windows on exit

## Extract GPS from Photos

```bash
./extract-gps-wsl.sh
```

Automatically:
- ✅ Extracts GPS coordinates
- ✅ Reverse geocodes to city/country names
- ✅ Saves everything to database

## Check Location Data

```bash
./check-locations.sh
```

Shows:
- Total photos with GPS
- Countries and photo counts
- Cities and photo counts

## Verify Server is Running

```bash
curl http://localhost:3002/api/locations/count
```

Should return: `{"count":10}` (or your current photo count)

## Stop the Server

Press `Ctrl+C` in the terminal where the server is running.

The database will automatically sync back to Windows.

---

**Current Status:**
- ✅ 10 photos with GPS data
- ✅ 2 cities: Shencottai (6), Courtallam (4)
- ✅ All database services fixed
- ✅ No more "Win32 application" errors

**Server URL:** http://localhost:3002
**Frontend URL:** http://localhost:5173
