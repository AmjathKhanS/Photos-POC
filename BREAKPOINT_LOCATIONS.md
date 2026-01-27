# 🎯 Breakpoint Locations - Quick Reference

This file shows **exactly where to set breakpoints** to debug each feature.

---

## 🔵 "Scan Photos" Flow - Breakpoint Locations

### Frontend (React)

**File**: `client/src/components/PeopleView.tsx`
- **Line 24**: Inside `handleStartScan()` - When user clicks button
- **Line 27**: After `await startScan()` - After scan request sent

**File**: `client/src/hooks/useFaces.ts`
- **Line 79**: Start of `startScan()` function
- **Line 82**: Before API call `fetch('/api/faces/scan')`
- **Line 84**: After API call, before starting polling
- **Line 67**: Inside polling interval - Progress updates

---

### Backend (Node.js)

**File**: `server/src/routes/faces.ts`
- **~Line 20-30**: Inside `router.post('/scan')` handler - API request received
- **~Line 25**: Before calling `faceService.scanAllPhotos()`

**File**: `server/src/services/faceService.ts`
- **Line 59**: Start of `scanAllPhotos()` function
- **Line 60**: Check if already scanning
- **Line 68**: After validating Python script exists
- **Line 75**: After validating photos directory exists
- **Line 83**: Reset scan status
- **Line 94**: Spawning Python subprocess (IMPORTANT!)
- **Line 101**: Receiving stdout from Python - Progress updates (IMPORTANT!)
- **Line 120**: Receiving stderr from Python - Errors
- **Line 126**: Python process closed - Check exit code

---

### Python (Face Processing)

**File**: `server/face-service/face_processor_onnx.py`

**Main entry point**:
- **~Line 250**: Start of `if __name__ == '__main__':`
- **~Line 260**: After parsing arguments

**Model initialization**:
- **~Line 45**: Start of `initialize_model()`
- **~Line 50**: Loading InsightFace models
- **~Line 55**: Models prepared and ready

**Photo processing**:
- **~Line 90**: Start of `scan_photos()`
- **~Line 95**: After listing photo files - Check `photo_files` list
- **~Line 105**: Start of photo loop - `for idx, filename in enumerate(photo_files):`
- **~Line 115**: Before processing single photo

**Face detection**:
- **~Line 130**: Start of `process_single_photo()`
- **~Line 135**: After reading image - Check `img` variable
- **~Line 145**: After face detection - Check `faces` array (IMPORTANT!)
- **~Line 150**: Start of face loop - `for face_idx, face in enumerate(faces):`
- **~Line 160**: After extracting embedding - Check `embedding` array
- **~Line 180**: Before saving to database

**Database operations**:
- **~Line 200**: Inside `save_face_to_db()`
- **~Line 210**: After INSERT statement - Face saved

---

## 🔵 "Auto Group Photos" Flow - Breakpoint Locations

### Frontend (React)

**File**: `client/src/components/PeopleView.tsx`
- **Line 54-60**: `onClick={runClustering}` button handler

**File**: `client/src/hooks/useFaces.ts`
- **Line 94**: Start of `runClustering()` function
- **Line 98**: Before API call with clustering params
- **Line 103**: After clustering completes, before fetching persons

---

### Backend (Node.js)

**File**: `server/src/routes/faces.ts`
- **~Line 50-60**: Inside `router.post('/cluster')` handler
- **~Line 55**: After extracting `eps` and `minSamples` parameters
- **~Line 58**: Before calling `faceClusterService.clusterFaces()`

**File**: `server/src/services/faceClusterService.ts`
- **Line 15**: Start of `clusterFaces()` function
- **Line 23**: After building Python script path
- **Line 30**: Spawning Python subprocess (IMPORTANT!)
- **Line 40**: Receiving stdout from Python
- **Line 45**: Python process closed - Check exit code

---

### Python (Clustering)

**File**: `server/face-service/face_clustering_onnx.py`

**Main entry point**:
- **~Line 140**: Start of `if __name__ == '__main__':`
- **~Line 150**: After parsing arguments

**Load faces from database**:
- **~Line 30**: Start of `load_faces_from_db()`
- **~Line 35**: After database query
- **~Line 40**: Inside loop converting encodings
- **~Line 50**: After loading all faces - Check `face_ids` and `encodings` (IMPORTANT!)

**Clustering**:
- **~Line 60**: Start of `cluster_faces()`
- **~Line 65**: After converting to numpy array - Check `encoding_matrix.shape`
- **~Line 70**: After normalization (if using cosine)
- **~Line 75**: Creating DBSCAN object
- **~Line 80**: After `fit_predict()` - Check `labels` array (IMPORTANT!)

**Save results**:
- **~Line 100**: Start of `save_clustering_results()`
- **~Line 105**: After getting unique labels - Check how many persons
- **~Line 110**: Clearing existing persons
- **~Line 115**: Inside loop creating persons
- **~Line 125**: Inside loop assigning faces to persons
- **~Line 140**: Setting representative faces

---

## 🎯 Critical Breakpoints (Set These First!)

### For "Scan Photos" debugging:

**Must-have breakpoints**:
1. ✅ `server/src/services/faceService.ts` **Line 94** - Python spawn command
2. ✅ `server/src/services/faceService.ts` **Line 101** - Progress updates
3. ✅ `server/face-service/face_processor_onnx.py` **~Line 145** - Faces detected
4. ✅ `server/face-service/face_processor_onnx.py` **~Line 160** - Embedding extracted

**Nice-to-have breakpoints**:
- `client/src/hooks/useFaces.ts` **Line 82** - API call
- `server/face-service/face_processor_onnx.py` **~Line 50** - Model loading

---

### For "Auto Group Photos" debugging:

**Must-have breakpoints**:
1. ✅ `server/src/services/faceClusterService.ts` **Line 30** - Python spawn
2. ✅ `server/face-service/face_clustering_onnx.py` **~Line 50** - Faces loaded
3. ✅ `server/face-service/face_clustering_onnx.py` **~Line 80** - Cluster labels
4. ✅ `server/face-service/face_clustering_onnx.py` **~Line 105** - Persons being created

**Nice-to-have breakpoints**:
- `client/src/hooks/useFaces.ts` **Line 98** - Clustering API call
- `server/face-service/face_clustering_onnx.py` **~Line 65** - Encoding matrix

---

## 🔍 What to Inspect at Each Breakpoint

### When paused at: `faceService.ts` Line 94 (Python spawn)

**Check these variables**:
```javascript
PYTHON_CMD        // Should be: path to python.exe
pythonScript      // Should be: path to face_processor_onnx.py
PHOTOS_DIR        // Should be: "D:\Photos Ai\mobile"
DB_PATH           // Should be: path to faces.db
scanStatus.status // Should be: "scanning"
```

---

### When paused at: `faceService.ts` Line 101 (Progress updates)

**Check these variables**:
```javascript
data.toString()   // Should be: JSON like {"status":"scanning","processed":1,...}
progress          // Should be: Parsed JSON object
scanStatus        // Should be updated with new values
```

---

### When paused at: `face_processor_onnx.py` ~Line 145 (Faces detected)

**Check these variables**:
```python
filename          # Current photo being processed
img.shape         # Image dimensions, e.g., (3000, 4000, 3)
len(faces)        # Number of faces detected, e.g., 3
faces[0].bbox     # Bounding box of first face
```

---

### When paused at: `face_processor_onnx.py` ~Line 160 (Embedding extracted)

**Check these variables**:
```python
face              # Current face object
face_idx          # Index of face in photo (0, 1, 2, ...)
bbox              # Dictionary with left, top, right, bottom
embedding.shape   # Should be: (512,)
embedding.dtype   # Should be: float32
confidence        # Detection confidence, e.g., 0.9876
```

---

### When paused at: `face_clustering_onnx.py` ~Line 50 (Faces loaded)

**Check these variables**:
```python
len(face_ids)     # Total faces loaded, e.g., 27
len(encodings)    # Should match len(face_ids)
encodings[0].shape # Should be: (512,)
```

---

### When paused at: `face_clustering_onnx.py` ~Line 80 (Cluster labels)

**Check these variables**:
```python
encoding_matrix.shape  # Should be: (27, 512)
eps                    # Should be: 0.3
min_samples            # Should be: 2
metric                 # Should be: 'cosine'
labels                 # Array like: [0, 0, 1, 2, 1, 0, 3, ...]
len(set(labels))       # Number of unique clusters + outliers (-1)
```

---

### When paused at: `face_clustering_onnx.py` ~Line 105 (Persons being created)

**Check these variables**:
```python
unique_labels      # Set of cluster IDs, e.g., {0, 1, 2, 3, 4, 5, 6}
len(unique_labels) # Number of persons, e.g., 7
person_id_map      # Mapping cluster IDs to database person IDs
```

---

## 💡 Pro Tips

### Tip 1: Start with Backend, Then Add Frontend

**Recommended order**:
1. First debug session: Backend only (easier to understand)
2. Second debug session: Add frontend breakpoints
3. Third debug session: Add Python breakpoints

### Tip 2: Use "Step Over" (F10) Not "Step Into" (F11)

- **F10 (Step Over)**: Executes function and moves to next line
- **F11 (Step Into)**: Goes inside function (can get lost in library code)

**Recommended**: Use F10 most of the time, only F11 for your own functions

### Tip 3: Don't Set Too Many Breakpoints

**Good**: 3-5 key breakpoints
**Bad**: 20+ breakpoints everywhere

**Start small**, add more as needed.

### Tip 4: Use Conditional Breakpoints for Loops

When debugging photo processing loop:
```javascript
// Instead of pausing on every photo, only pause on photo #5
filename === "IMG_0005.jpg"
```

### Tip 5: Check Call Stack When Lost

If paused and confused where you are:
1. Look at **Call Stack** panel (bottom of Debug sidebar)
2. Shows: `main → scan_photos → process_single_photo ← YOU ARE HERE`
3. Click any function to jump to that level

---

## 📋 Debugging Checklist

### Before Starting Debug Session:

- [ ] VS Code opened in correct folder (`/mnt/d/Photos Ai/photo-viewer`)
- [ ] `.vscode/launch.json` file exists
- [ ] All dependencies installed (`npm install` in server & client)
- [ ] Python virtual environment set up (`venv_onnx`)

### For Backend Debugging:

- [ ] Set breakpoint in `faceService.ts` at Python spawn (Line 94)
- [ ] Set breakpoint at progress handler (Line 101)
- [ ] Press F5 → Select "🟢 Debug Backend"
- [ ] Wait for "Server running on http://localhost:3002"
- [ ] Start frontend manually: `cd client && npm run dev`
- [ ] Open browser: http://localhost:3000
- [ ] Click "Scan Photos" button
- [ ] Verify breakpoint hits

### For Python Debugging:

- [ ] Set breakpoint at face detection result (face_processor_onnx.py ~Line 145)
- [ ] Press F5 → Select "🐍 Debug Python - Face Detection"
- [ ] Python starts and loads models
- [ ] Verify breakpoint hits when processing photo
- [ ] Check `faces` array has detected faces

### For Frontend Debugging:

- [ ] Start frontend: `cd client && npm run dev`
- [ ] Open Chrome DevTools (F12)
- [ ] Sources tab → Find PeopleView.tsx
- [ ] Add breakpoint in button handler
- [ ] Click button, verify breakpoint hits

---

## 🎓 Common Questions

**Q: Breakpoint shows gray dot instead of red?**
A: Source maps not loaded yet. Trigger the code once, then breakpoint will become red.

**Q: Breakpoint not hitting even though code runs?**
A: Check if you're in the right file. Sometimes there are multiple copies (src vs dist vs node_modules).

**Q: Too much output in Debug Console?**
A: Right-click Console → Clear Console, or add filters.

**Q: How do I stop debugging?**
A: Press Shift+F5 or click the red square stop button.

**Q: Can I modify variables while debugging?**
A: Yes! In Debug Console, type: `scanStatus = {status: 'idle', total: 0, processed: 0}`

---

## ✅ Summary

**Quick Start**:
1. Open VS Code in project folder
2. Press **F5** → Select debug configuration
3. Set breakpoints at critical locations (see sections above)
4. Trigger action in UI
5. Debug!

**Most Important Breakpoints**:
- Backend: `faceService.ts` Line 94, 101
- Python Scan: `face_processor_onnx.py` ~Line 145, 160
- Python Cluster: `face_clustering_onnx.py` ~Line 50, 80

Happy debugging! 🐛
