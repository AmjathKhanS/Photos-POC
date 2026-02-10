# Quick Start: Enable Location-Based Photos

## ⚡ 3 Simple Steps

### Step 1: Rebuild better-sqlite3 (Windows)

Open **PowerShell** and run:

```powershell
cd "D:\Photos Ai\photo-viewer\server"
npm rebuild better-sqlite3
```

**Why?** This compiles the database driver for Windows.

---

### Step 2: Run the Database Migration

Still in PowerShell:

```powershell
node run-location-migration.js
```

**Expected output:**
```
📍 Running location tables migration...

Creating photo_locations table...
Creating indexes...
Creating location_clusters table...

✅ Migration completed successfully!
```

---

### Step 3: Restart the Server

```powershell
cd "D:\Photos Ai\photo-viewer"
npm run dev
```

**Look for:**
```
[SERVER] ✅ Server running on http://localhost:3002
[SERVER] 📍 GPS extracted: 47.6062, -122.3321
```

---

## ✅ Verify It Works

1. Open http://localhost:5173
2. Click **"Places"** tab in sidebar (📍 icon)
3. If you have photos with GPS:
   - See countries with flag emojis
   - See cities with photo counts
4. If no GPS data yet:
   - Message will explain GPS extraction
   - GPS will be extracted during indexing

---

## 🎯 What Happens Next?

- **Automatic GPS extraction** during photo indexing
- GPS data saved to database
- Locations appear in Places tab
- Foundation ready for Phase 2 (map view!)

---

**That's it!** Your location-based photos feature is now live! 🎉
