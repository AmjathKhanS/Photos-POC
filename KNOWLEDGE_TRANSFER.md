# Knowledge Transfer - ONNX Face Detection System

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [How It Works](#how-it-works)
4. [What Was Changed](#what-was-changed)
5. [How to Use](#how-to-use)
6. [Configuration](#configuration)
7. [Troubleshooting](#troubleshooting)
8. [Maintenance](#maintenance)

---

## System Overview

### What Does This System Do?

Your photo viewer application can now:
- **Detect faces** in photos automatically using AI (ONNX + InsightFace)
- **Group similar faces** together to identify the same person across multiple photos
- **Show which photos** each person appears in
- **Generate thumbnails** of each face
- **Support HEIC files** (iPhone photos)

### Key Features
- ✅ Server-side face detection (ONNX models)
- ✅ 512-dimensional face embeddings (high accuracy)
- ✅ DBSCAN clustering for automatic grouping
- ✅ HEIC image support
- ✅ SQLite database for face storage
- ✅ REST API for frontend integration

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                               │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  React Frontend (Client)                            │    │
│  │  - PeopleView: Shows list of people                │    │
│  │  - PersonPhotosView: Shows person's photos         │    │
│  │  - PersonCard: Person thumbnail cards              │    │
│  └────────────────────────────────────────────────────┘    │
│                        │ HTTP/REST API                      │
└────────────────────────┼────────────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────────────┐
│                    SERVER (Node.js)                          │
│                        │                                     │
│  ┌─────────────────────▼──────────────────────────────┐    │
│  │  Express.js Routes                                  │    │
│  │  - /api/faces/scan        → Start face scan        │    │
│  │  - /api/faces/cluster     → Group faces            │    │
│  │  - /api/faces/persons     → List people            │    │
│  │  - /api/faces/:id/thumbnail → Get face thumbnail   │    │
│  └──────────────┬──────────────────────────────────────┘   │
│                 │                                            │
│  ┌──────────────▼──────────────────────────────────────┐   │
│  │  Services (TypeScript)                              │   │
│  │  - faceService.ts      → Scan coordination         │   │
│  │  - faceClusterService.ts → Clustering coordination │   │
│  │  - personService.ts    → Person management         │   │
│  │  - sqliteDatabase.ts   → Database interface        │   │
│  └──────────────┬──────────────────────────────────────┘   │
│                 │ spawn Python processes                    │
└─────────────────┼───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│              PYTHON (ONNX Processing)                        │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  face_processor_onnx.py                            │    │
│  │  - Loads InsightFace ONNX models                   │    │
│  │  - Detects faces in images                         │    │
│  │  - Generates 512-D embeddings                      │    │
│  │  - Saves to SQLite database                        │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  face_clustering_onnx.py                           │    │
│  │  - Reads face embeddings from SQLite               │    │
│  │  - Runs DBSCAN clustering (cosine similarity)      │    │
│  │  - Creates "Person" groups automatically           │    │
│  │  - Updates database with person assignments        │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  Models Used:                                               │
│  - Buffalo_l (InsightFace model pack ~300MB)               │
│  - SCRFD: Face detection                                   │
│  - ArcFace: Face recognition (512-D embeddings)            │
└──────────────────────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                   DATA STORAGE                               │
│                                                              │
│  SQLite Database (server/data/faces.db)                     │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Tables:                                            │    │
│  │  - faces: Stores detected faces & embeddings       │    │
│  │  - persons: Stores grouped people                  │    │
│  │  - processing_status: Tracks scan progress         │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## How It Works

### Step-by-Step Process

#### 1. Face Detection (Scan)

```
User clicks "Scan All Photos"
    ↓
Frontend sends: POST /api/faces/scan
    ↓
Node.js server spawns Python process:
    python face_processor_onnx.py --photos-dir "D:\Photos Ai\mobile" --db-path faces.db
    ↓
Python loads InsightFace ONNX models
    ↓
For each photo:
    - Load image (supports HEIC via pillow-heif)
    - Detect faces using SCRFD model
    - Extract 512-D embedding for each face using ArcFace
    - Save to SQLite: face_id, photo_filename, bounding_box, embedding
    ↓
Scan complete
    ↓
Frontend shows: "416 faces found in 201 photos"
```

#### 2. Face Clustering (Grouping)

```
User clicks "Auto-Group Faces"
    ↓
Frontend sends: POST /api/faces/cluster
    Body: { eps: 0.3, minSamples: 2 }
    ↓
Node.js server spawns Python process:
    python face_clustering_onnx.py --db-path faces.db --eps 0.3 --metric cosine
    ↓
Python reads all face embeddings from database
    ↓
Runs DBSCAN clustering algorithm:
    - Uses cosine similarity (better for high-dimensional embeddings)
    - Groups similar faces together
    - eps=0.3 means faces must be 30% similar to group
    ↓
Creates "Person" entries in database:
    - Person 1: 88 faces
    - Person 2: 83 faces
    - etc.
    ↓
Updates faces table with person_id assignments
    ↓
Returns: { clustersFound: 34, outliers: 111 }
```

#### 3. Viewing People & Photos

```
User navigates to People tab
    ↓
Frontend fetches: GET /api/faces/persons
    ↓
Server reads from SQLite:
    SELECT * FROM persons ORDER BY face_count DESC
    ↓
Returns: [
    { id: 1, name: "Person 1", face_count: 88 },
    { id: 2, name: "Person 2", face_count: 83 },
    ...
]
    ↓
Frontend displays person cards with thumbnails

User clicks on "Person 5"
    ↓
Frontend fetches: GET /api/faces/persons/5/photos
    ↓
Server queries:
    SELECT DISTINCT photo_filename FROM faces WHERE person_id = 5
    ↓
Returns: [
    { filename: "IMG_1741.HEIC" },
    { filename: "IMG_1745.HEIC" },
    ...
]
    ↓
Frontend displays photos grid

User sees face thumbnail
    ↓
Frontend requests: GET /api/faces/1/thumbnail
    ↓
Server (faceService.ts):
    1. Reads face bounding box from database
    2. Loads photo (converts HEIC to JPEG if needed)
    3. Crops face region using bounding box
    4. Resizes to 150x150
    5. Returns JPEG image
```

---

## What Was Changed

### New Files Created

#### Python Scripts (server/face-service/)
1. **face_processor_onnx.py**
   - Purpose: Detect faces using ONNX models
   - Replaces: Old dlib-based face_processor.py
   - Key improvement: 2-3x faster, 512-D embeddings (vs 128-D)

2. **face_clustering_onnx.py**
   - Purpose: Group faces using DBSCAN clustering
   - Uses: Cosine similarity (better for 512-D embeddings)
   - Key improvement: Better grouping quality

#### TypeScript Services (server/src/services/)
3. **sqliteDatabase.ts** (NEW)
   - Purpose: SQLite database interface for Node.js
   - Provides functions to read/write faces, persons, stats

#### Configuration Files
4. **requirements_onnx.txt**
   - Python dependencies for ONNX system
   - Key packages: onnxruntime, insightface, pillow-heif

5. **INTEGRATION_COMPLETE_GUIDE.md**
   - Documentation for ONNX integration

### Modified Files

#### Backend (server/src/)

1. **services/faceService.ts**
   ```typescript
   CHANGED:
   - Python command: Now uses venv_onnx/Scripts/python.exe
   - Python script: face_processor_onnx.py (instead of face_processor.py)
   - Database: faces.db (SQLite, instead of db.json)
   - Added: HEIC to JPEG conversion for thumbnails
   - Added: Path conversion function (WSL → Windows paths)
   ```

2. **services/faceClusterService.ts**
   ```typescript
   CHANGED:
   - Python script: face_clustering_onnx.py
   - Metric: cosine similarity (instead of euclidean)
   - Database: faces.db (SQLite)
   - Added: Path conversion function
   ```

3. **services/personService.ts**
   ```typescript
   CHANGED:
   - Database import: Now imports from sqliteDatabase.ts
   - All database operations: Use SQLite instead of JSON
   - Person management: Works with SQLite persons table
   ```

4. **index.ts**
   ```typescript
   ADDED:
   - Import facesRouter from './routes/faces.js'
   - Mount route: app.use('/api/faces', facesRouter)
   ```

#### Frontend (client/src/)

5. **components/PeopleView.tsx**
   ```typescript
   CHANGED:
   - Hook: useLocalFaces → useFaces (backend instead of browser)
   - Removed: Local AI model loading
   - Scan: Now calls backend API directly
   - Clustering: Sends eps: 0.3 parameter
   ```

6. **components/PersonPhotosView.tsx**
   ```typescript
   CHANGED:
   - Data source: Backend API instead of IndexedDB
   - Fetch photos: GET /api/faces/persons/:id/photos
   - Rename person: PUT /api/faces/persons/:id
   ```

7. **utils/faceThumbnail.ts**
   ```typescript
   CHANGED:
   - Thumbnail source: Backend API /api/faces/:faceId/thumbnail
   - Removed: Client-side face extraction code
   - Simplified: Just returns URL to backend endpoint
   ```

8. **hooks/useFaces.ts**
   ```typescript
   CHANGED:
   - Clustering params: Added eps: 0.3, minSamples: 2
   ```

### Dependencies Added

#### Node.js (server/)
```json
{
  "better-sqlite3": "^9.0.0",      // SQLite database
  "@types/better-sqlite3": "^7.0.0" // TypeScript types
}
```

#### Python (venv_onnx/)
```
onnxruntime>=1.16.0       // ONNX inference engine
insightface>=0.7.3        // Face detection models
opencv-python>=4.8.0      // Image processing
Pillow>=10.0.0            // Image loading
pillow-heif               // HEIC support
numpy>=1.24.0,<2.0.0     // Array operations
scikit-learn>=1.3.0      // DBSCAN clustering
```

---

## How to Use

### Starting the System

#### Option 1: Start Manually
```bash
# In terminal 1 - Start server
cd "D:\Photos Ai\photo-viewer\server"
npm start

# Server runs on http://localhost:3002
```

#### Option 2: Start from WSL
```bash
cd /mnt/d/Photos\ Ai/photo-viewer/server
npm start
```

### Using the Application

#### 1. Open Browser
```
http://localhost:3002
```

#### 2. Navigate to People Tab
Click "People" in the navigation

#### 3. Scan Photos for Faces
```
Click "Scan All Photos" button
→ Wait for scan to complete (progress bar shows status)
→ Message: "27 faces found in 12 photos"
```

#### 4. Auto-Group Faces
```
Click "Auto-Group Faces" button
→ Wait for clustering (usually 1-5 seconds)
→ Message: "Created 7 persons"
```

#### 5. View People
- See list of 7 people with face thumbnails
- Click any person to see their photos
- Click any photo to view full size

#### 6. Rename People
- Click on person name (pencil icon appears)
- Type new name
- Press Enter to save

### API Endpoints

#### Face Scanning
```bash
# Start scan
POST http://localhost:3002/api/faces/scan

# Check status
GET http://localhost:3002/api/faces/scan/status
# Response: { status: "scanning", total: 319, processed: 150 }

# Get stats
GET http://localhost:3002/api/faces/stats
# Response: { totalPhotos: 12, processedPhotos: 12, totalFaces: 27, totalPersons: 7 }
```

#### Clustering
```bash
# Run clustering
POST http://localhost:3002/api/faces/cluster
Content-Type: application/json
{ "eps": 0.3, "minSamples": 2 }

# Response: { status: "completed", clustersFound: 7, outliers: 7 }
```

#### Person Management
```bash
# List all persons
GET http://localhost:3002/api/faces/persons

# Get specific person
GET http://localhost:3002/api/faces/persons/5

# Get person's photos
GET http://localhost:3002/api/faces/persons/5/photos

# Rename person
PUT http://localhost:3002/api/faces/persons/5
Content-Type: application/json
{ "name": "John Doe" }

# Delete person
DELETE http://localhost:3002/api/faces/persons/5
```

#### Face Thumbnails
```bash
# Get face thumbnail (150x150 JPEG)
GET http://localhost:3002/api/faces/1/thumbnail
```

---

## Configuration

### Adjusting Clustering Quality

The `eps` parameter controls how strict the grouping is:

```typescript
// STRICT grouping (fewer people mixed together, more separate groups)
{ eps: 0.25, minSamples: 2 }
// Result: Might create 50 separate people

// BALANCED grouping (recommended)
{ eps: 0.30, minSamples: 2 }
// Result: ~34 people with good accuracy

// LOOSE grouping (might mix different people)
{ eps: 0.40, minSamples: 2 }
// Result: Might create only 15 people, some mixed
```

**Where to change:**
- Frontend: `client/src/hooks/useFaces.ts` line 101
- Direct API call: Send different eps value in POST body

### Adjusting Face Detection Accuracy

Edit: `server/face-service/face_processor_onnx.py` line 33

```python
# CURRENT (balanced)
self.face_app.prepare(ctx_id=0, det_size=(640, 640))

# HIGH ACCURACY (slower, detects more faces)
self.face_app.prepare(ctx_id=0, det_size=(1024, 1024))

# FAST (less accurate, might miss small faces)
self.face_app.prepare(ctx_id=0, det_size=(320, 320))
```

### Changing Photos Directory

Edit: `server/src/services/faceService.ts` line 21

```typescript
const PHOTOS_DIR = process.env.PHOTOS_DIR ||
  (os.platform() === 'win32'
    ? 'D:\\Photos Ai\\mobile'      // Windows path
    : '/mnt/d/Photos Ai/mobile');  // WSL path
```

### Changing Database Location

Edit: `server/src/services/faceService.ts` line 24

```typescript
const DB_PATH = path.join(__dirname, '../../data/faces.db');
```

---

## Troubleshooting

### Problem: "No faces detected"

**Possible causes:**
1. Photos directory is empty or wrong path
2. HEIC support not installed
3. Python virtual environment not set up

**Solutions:**
```bash
# Check photos directory
ls "/mnt/d/Photos Ai/mobile" | head

# Install HEIC support
cd /mnt/d/Photos\ Ai/photo-viewer
./venv_onnx/Scripts/python.exe -m pip install pillow-heif

# Verify Python environment
./venv_onnx/Scripts/python.exe -c "import insightface; print('OK')"
```

### Problem: "Different people grouped together"

**Cause:** eps parameter too high (loose clustering)

**Solution:**
```bash
# Re-run clustering with stricter threshold
curl -X POST http://localhost:3002/api/faces/cluster \
  -H "Content-Type: application/json" \
  -d '{"eps": 0.25, "minSamples": 2}'
```

### Problem: "Same person split into multiple groups"

**Cause:** eps parameter too low (strict clustering)

**Solution:**
```bash
# Re-run clustering with looser threshold
curl -X POST http://localhost:3002/api/faces/cluster \
  -H "Content-Type: application/json" \
  -d '{"eps": 0.35, "minSamples": 2}'
```

### Problem: "Thumbnails not loading"

**Check server logs:**
```bash
# Look for errors in server output
# Common issue: HEIC conversion failed

# Solution: Ensure heic-convert is installed
cd /mnt/d/Photos\ Ai/photo-viewer/server
npm list heic-convert
```

### Problem: "Person photos showing 'No photos found'"

**Cause:** Frontend not updated

**Solution:**
```bash
# Rebuild frontend
cd /mnt/d/Photos\ Ai/photo-viewer/client
npm run build

# Hard refresh browser: Ctrl+Shift+R
```

### Problem: "Server won't start"

**Check for errors:**
```bash
cd /mnt/d/Photos\ Ai/photo-viewer/server

# Rebuild TypeScript
npm run build

# Check for errors in output
# Common issues:
# - Missing dependencies: npm install
# - TypeScript errors: Fix in src/ files
# - Port 3002 in use: Change PORT in .env or code
```

### Problem: "Python script not found"

**Error:** `python.exe: can't open file 'face_processor_onnx.py'`

**Cause:** Path conversion issue (WSL vs Windows paths)

**Check:**
```bash
# Verify files exist
ls /mnt/d/Photos\ Ai/photo-viewer/server/face-service/face_*_onnx.py

# Should show:
# face_clustering_onnx.py
# face_processor_onnx.py
```

---

## Maintenance

### Regular Tasks

#### 1. Clear Old Face Data
When switching photos or starting fresh:
```bash
# Stop server first
cd /mnt/d/Photos\ Ai/photo-viewer/server/data
rm faces.db

# Restart server and rescan
```

#### 2. Update Python Dependencies
```bash
cd /mnt/d/Photos\ Ai/photo-viewer
./venv_onnx/Scripts/python.exe -m pip install --upgrade onnxruntime insightface
```

#### 3. Rebuild Frontend After Changes
```bash
cd /mnt/d/Photos\ Ai/photo-viewer/client
npm run build
```

#### 4. Rebuild Backend After Changes
```bash
cd /mnt/d/Photos\ Ai/photo-viewer/server
npm run build
```

### Database Queries

#### Check Database Contents
```bash
cd /mnt/d/Photos\ Ai/photo-viewer
python3 << EOF
import sqlite3
conn = sqlite3.connect('server/data/faces.db')
cursor = conn.cursor()

# Count faces
cursor.execute('SELECT COUNT(*) FROM faces')
print('Total faces:', cursor.fetchone()[0])

# Count persons
cursor.execute('SELECT COUNT(*) FROM persons')
print('Total persons:', cursor.fetchone()[0])

# Top persons
cursor.execute('''
  SELECT person_id, COUNT(*) as count
  FROM faces
  WHERE person_id IS NOT NULL
  GROUP BY person_id
  ORDER BY count DESC
  LIMIT 5
''')
print('Top 5 persons:')
for row in cursor.fetchall():
    print(f'  Person {row[0]}: {row[1]} faces')
EOF
```

### Performance Optimization

#### Enable GPU Support (10x faster)
If you have NVIDIA GPU:

```bash
# Install CUDA-enabled ONNX Runtime
cd /mnt/d/Photos\ Ai/photo-viewer
./venv_onnx/Scripts/python.exe -m pip uninstall onnxruntime
./venv_onnx/Scripts/python.exe -m pip install onnxruntime-gpu

# Edit face_processor_onnx.py line 28:
# Change: providers=['CPUExecutionProvider']
# To: providers=['CUDAExecutionProvider', 'CPUExecutionProvider']
```

#### Batch Processing
For large photo collections, process in batches:

1. Move photos to temporary folder
2. Scan batch
3. Move to next batch
4. Repeat

---

## Key Concepts

### What is ONNX?
- Open Neural Network Exchange
- Cross-platform format for AI models
- Runs on CPU/GPU without Python/TensorFlow/PyTorch

### What is InsightFace?
- Pre-trained face recognition models
- State-of-the-art accuracy (97%+)
- Trained on millions of faces

### What are Face Embeddings?
- 512-dimensional vector representing a face
- Similar faces have similar vectors
- Example: [0.23, -0.15, 0.87, ..., 0.42] (512 numbers)

### What is DBSCAN Clustering?
- Density-Based Spatial Clustering
- Groups similar embeddings together
- Parameters:
  - **eps**: Maximum distance between faces in same group
  - **minSamples**: Minimum faces to form a group
  - **metric**: How to measure distance (cosine similarity)

### What is Cosine Similarity?
- Measures angle between two vectors
- Better for high-dimensional data (512-D)
- Range: -1 (opposite) to 1 (identical)
- 0.7+ similarity = likely same person

---

## File Structure Reference

```
photo-viewer/
├── server/
│   ├── src/
│   │   ├── services/
│   │   │   ├── faceService.ts          ← Face scan coordination
│   │   │   ├── faceClusterService.ts   ← Clustering coordination
│   │   │   ├── personService.ts        ← Person management
│   │   │   └── sqliteDatabase.ts       ← SQLite interface (NEW)
│   │   ├── routes/
│   │   │   └── faces.ts                ← API endpoints
│   │   └── index.ts                    ← Main server (added faces route)
│   ├── face-service/
│   │   ├── face_processor_onnx.py      ← ONNX face detection (NEW)
│   │   └── face_clustering_onnx.py     ← ONNX clustering (NEW)
│   ├── data/
│   │   └── faces.db                    ← SQLite database
│   └── package.json
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── PeopleView.tsx          ← People list (CHANGED)
│   │   │   ├── PersonPhotosView.tsx    ← Person photos (CHANGED)
│   │   │   └── PersonCard.tsx          ← Person card
│   │   ├── hooks/
│   │   │   └── useFaces.ts             ← Backend API hook (CHANGED)
│   │   └── utils/
│   │       └── faceThumbnail.ts        ← Thumbnail utility (CHANGED)
│   └── package.json
│
├── venv_onnx/                          ← Python virtual environment
│   └── Scripts/
│       └── python.exe                  ← Python 3.12
│
├── requirements_onnx.txt               ← Python dependencies (NEW)
└── INTEGRATION_COMPLETE_GUIDE.md       ← Integration docs (NEW)
```

---

## Quick Reference Commands

### Start Server
```bash
cd /mnt/d/Photos\ Ai/photo-viewer/server && npm start
```

### Scan Photos
```bash
curl -X POST http://localhost:3002/api/faces/scan
```

### Check Status
```bash
curl http://localhost:3002/api/faces/scan/status
```

### Cluster Faces
```bash
curl -X POST http://localhost:3002/api/faces/cluster \
  -H "Content-Type: application/json" \
  -d '{"eps": 0.3, "minSamples": 2}'
```

### List People
```bash
curl http://localhost:3002/api/faces/persons
```

### Clear Database
```bash
rm /mnt/d/Photos\ Ai/photo-viewer/server/data/faces.db
```

### Rebuild Everything
```bash
# Server
cd /mnt/d/Photos\ Ai/photo-viewer/server && npm run build

# Client
cd /mnt/d/Photos\ Ai/photo-viewer/client && npm run build
```

---

## Support & Further Reading

### Documentation Files
- `INTEGRATION_COMPLETE_GUIDE.md` - Complete integration guide
- `ONNX_SETUP.md` - ONNX setup details
- `requirements_onnx.txt` - Python dependencies

### External Resources
- [InsightFace GitHub](https://github.com/deepinsight/insightface)
- [ONNX Runtime Docs](https://onnxruntime.ai/)
- [DBSCAN Algorithm](https://en.wikipedia.org/wiki/DBSCAN)
- [Better SQLite3](https://github.com/WiseLibs/better-sqlite3)

### Getting Help
If you encounter issues:
1. Check server logs for errors
2. Verify Python environment is working
3. Check database has data
4. Try clearing cache and rescanning
5. Review this document's Troubleshooting section

---

**Last Updated:** January 19, 2026
**System Version:** ONNX Face Detection v1.0
**Author:** Claude (Anthropic)
