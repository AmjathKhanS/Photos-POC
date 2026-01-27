# 🐛 Debugging Guide - People Tab (Face Detection & Clustering)

This guide shows you how to debug the entire People tab workflow **without modifying any code**.

---

## ✅ Debug Configurations Available

Open VS Code's Run panel (Ctrl+Shift+D) to see these debug options:

1. **🟢 Debug Backend (Node.js Server)** - Debug API routes and services
2. **🔵 Debug Frontend (Chrome)** - Debug React components in Chrome
3. **🐍 Debug Python - Face Detection** - Debug face scanning process
4. **🐍 Debug Python - Clustering** - Debug face grouping process
5. **🚀 Full Stack Debug** - Debug both Frontend + Backend together

---

## 🎯 How to Debug Each Feature

### Debug "Scan Photos" Flow

#### Step 1: Start Backend Debugger

1. **Open VS Code** in project folder: `/mnt/d/Photos Ai/photo-viewer`
2. Press **F5** (or Click Run → Start Debugging)
3. Select **"🟢 Debug Backend (Node.js Server)"**
4. Wait for: `Server running on http://localhost:3002`

#### Step 2: Set Breakpoints (Backend)

Click on these line numbers to add breakpoints:

**File**: `server/src/routes/faces.ts`
- **Line 20-25** (approx) - Where `POST /api/faces/scan` is handled
- **Line 30-35** (approx) - Where `POST /api/faces/cluster` is handled

**File**: `server/src/services/faceService.ts`
- **Line 59** - Start of `scanAllPhotos()` function
- **Line 94** - Where Python subprocess is spawned
- **Line 101** - Where Python progress updates are captured

**File**: `server/src/services/faceClusterService.ts`
- **Line 15** - Start of `clusterFaces()` function
- **Line 30** - Where Python clustering subprocess is spawned

#### Step 3: Open Frontend

In a **separate terminal** (Ctrl+Shift+`):

```bash
cd client
npm run dev
```

Open browser: http://localhost:3000

#### Step 4: Trigger Debug

1. Navigate to **People tab**
2. Click **"Scan Photos"** button
3. **Breakpoint hits!** VS Code pauses execution
4. You can now:
   - **Hover over variables** to see values
   - **Check Debug Console** (View → Debug Console)
   - **Step through code**: F10 (next line), F11 (step into function)
   - **Continue**: F5

#### Step 5: Inspect Variables

When paused, check these in the **Debug panel** (left side):

**Variables to inspect**:
- `scanStatus` - Current scan progress
- `PHOTOS_DIR` - Photo directory path
- `pythonScript` - Path to Python script
- `PYTHON_CMD` - Python command being used
- `scanProcess` - The Python subprocess object

**In Debug Console**, you can run:
```javascript
// Check scan status
scanStatus

// Check if Python process is running
scanProcess !== null

// Check photo directory
PHOTOS_DIR
```

---

### Debug "Auto Group Photos" Flow

#### Step 1: Backend Already Running

If backend debugger is already running from "Scan Photos" debug, you can reuse it.

Otherwise, start it: **F5** → **"🟢 Debug Backend"**

#### Step 2: Set Clustering Breakpoints

**File**: `server/src/services/faceClusterService.ts`
- **Line 15-20** - Start of `clusterFaces()` function
- **Line 30** - Python spawn command

#### Step 3: Trigger Clustering

1. In browser, click **"Auto Group Photos"** button
2. **Breakpoint hits!** VS Code pauses
3. Inspect variables:
   - `eps` - Clustering distance parameter (should be 0.3)
   - `minSamples` - Minimum faces per person (should be 2)
   - `pythonScript` - Path to clustering script

---

### Debug Python Scripts (Face Detection)

**When to use**: Debug ONNX model loading, face detection logic, or database operations

#### Step 1: Stop Backend (if running)

Press **Shift+F5** to stop current debug session

#### Step 2: Start Python Debugger

1. Press **F5**
2. Select **"🐍 Debug Python - Face Detection (Scan)"**
3. Python script starts in debug mode

#### Step 3: Set Python Breakpoints

**File**: `server/face-service/face_processor_onnx.py`

Click line numbers to add breakpoints:
- **Line 45** (approx) - `initialize_model()` - Where ONNX models load
- **Line 120** (approx) - `process_single_photo()` - Where each photo is processed
- **Line 150** (approx) - Inside face detection loop
- **Line 180** (approx) - `save_face_to_db()` - Where faces are saved

#### Step 4: Inspect Python Variables

When paused, check **Debug panel**:

**Variables to inspect**:
- `photo_files` - List of all photos found
- `img` - Current image being processed (numpy array)
- `faces` - Array of detected faces
- `face.bbox` - Bounding box coordinates
- `embedding` - 512-D face embedding vector
- `len(faces)` - Number of faces detected in current photo

**In Debug Console**:
```python
# Check face count
len(faces)

# Check embedding shape
embedding.shape  # Should be (512,)

# Check first face
faces[0]

# Check database
conn.execute("SELECT COUNT(*) FROM faces").fetchone()
```

---

### Debug Python Scripts (Clustering)

#### Step 1: Start Clustering Debugger

1. Press **F5**
2. Select **"🐍 Debug Python - Clustering (Auto-Group)"**

#### Step 2: Set Clustering Breakpoints

**File**: `server/face-service/face_clustering_onnx.py`

- **Line 30** (approx) - `load_faces_from_db()` - Loading faces from database
- **Line 60** (approx) - `cluster_faces()` - DBSCAN clustering
- **Line 90** (approx) - After `labels = ...` - Check cluster assignments
- **Line 120** (approx) - `save_clustering_results()` - Saving persons

#### Step 3: Inspect Clustering Data

**Variables to inspect**:
- `face_ids` - List of face IDs from database
- `encodings` - List of 512-D embeddings
- `encoding_matrix` - Numpy array shape (27, 512)
- `labels` - Cluster assignments [0, 0, 1, 2, 1, ...]
- `unique_labels` - Set of unique person IDs

**In Debug Console**:
```python
# Check how many faces loaded
len(face_ids)

# Check encoding matrix shape
encoding_matrix.shape  # Should be (27, 512)

# Check cluster labels
labels  # Should be like [0, 0, 1, 1, 2, 2, ...]

# Check how many persons found
len(set(label for label in labels if label != -1))
```

---

## 🚀 Debug Both Frontend + Backend Together

**Best for**: Understanding the complete request/response flow

### Step 1: Start Full Stack Debug

1. Press **F5**
2. Select **"🚀 Full Stack Debug (Frontend + Backend)"**
3. This starts:
   - Node.js server in debug mode
   - Chrome browser with debugger attached

### Step 2: Set Breakpoints in Both Layers

**Backend**: Set breakpoints in `server/src/routes/faces.ts`

**Frontend**:
- Open Chrome DevTools (F12)
- Go to **Sources** tab
- Navigate: `webpack:// → src → components → PeopleView.tsx`
- Click line numbers to add breakpoints

### Step 3: See Complete Flow

1. Click **"Scan Photos"** in browser
2. **Frontend breakpoint hits** (Chrome DevTools)
3. Step through → API call made
4. **Backend breakpoint hits** (VS Code)
5. Step through → See request processing

---

## 📊 What to Look For (Expected Values)

### When "Scan Photos" is triggered:

**Backend breakpoint at `POST /scan` handler**:
- `req.method` = `"POST"`
- `req.path` = `"/api/faces/scan"`

**Backend breakpoint at Python spawn**:
- `PYTHON_CMD` = Path to `python.exe`
- `pythonScript` = Path to `face_processor_onnx.py`
- `PHOTOS_DIR` = `"D:\Photos Ai\mobile"`
- `DB_PATH` = Path to `faces.db`

**Python breakpoint at model initialization**:
- `self.face_app` is created
- Models download to `~/.insightface/models/buffalo_l/`

**Python breakpoint at face processing**:
- `photo_files` = List of 12 photos
- For each photo:
  - `img` = Numpy array (e.g., shape (3000, 4000, 3))
  - `faces` = List of Face objects (e.g., length 3)
  - Each `face.embedding` = Numpy array shape (512,)
  - Each `face.bbox` = Array [x1, y1, x2, y2]

### When "Auto Group Photos" is triggered:

**Backend breakpoint at `POST /cluster` handler**:
- `req.body` = `{eps: 0.3, minSamples: 2}`

**Python breakpoint at clustering**:
- `face_ids` = List of 27 face IDs
- `encodings` = List of 27 embeddings (each 512-D)
- `encoding_matrix.shape` = `(27, 512)`
- `labels` after clustering = Array like `[0, 0, 1, 2, 1, 0, 3, ...]`
- Number of unique persons = `7`

---

## 💡 Debug Tips

### 1. Use Logpoints (No Code Modification!)

Instead of adding `console.log()`:
1. **Right-click line number** → **Add Logpoint**
2. Enter expression: `"Status:", scanStatus`
3. Logs to console without modifying code!

### 2. Conditional Breakpoints

Only pause when condition is true:
1. **Right-click breakpoint** → **Edit Breakpoint**
2. Enter condition: `scanStatus.processed > 5`
3. Only pauses when processing photo 6+

### 3. Watch Expressions

Auto-monitor variables:
1. In **Debug panel** → **Watch** section
2. Click **+** and add: `scanStatus.processed`
3. Updates in real-time as code runs

### 4. Call Stack

See function call hierarchy:
- **Debug panel** → **Call Stack** section
- Shows: `handleStartScan → startScan → fetch`
- Click any frame to jump to that function

### 5. Debug Console Commands

While paused, run code in Debug Console:

```javascript
// Check all faces in database
await fetch('/api/faces').then(r => r.json())

// Check specific person
await fetch('/api/faces/persons/1').then(r => r.json())

// Manually update scan status
scanStatus = {status: 'idle', total: 0, processed: 0}
```

---

## 🔍 Debugging Common Scenarios

### Scenario 1: "Scan Photos button not working"

**Debug Steps**:
1. Set breakpoint in `client/src/components/PeopleView.tsx` at button handler
2. Click button
3. If breakpoint doesn't hit → Button handler not connected
4. If breakpoint hits → Check what `startScan()` does
5. Set breakpoint in `client/src/hooks/useFaces.ts` in `startScan()` function
6. Check if API call is made: `fetch('/api/faces/scan')`
7. Set backend breakpoint to see if request arrives

### Scenario 2: "No faces detected"

**Debug Steps**:
1. Start Python debugger: **"🐍 Debug Python - Face Detection"**
2. Set breakpoint at `process_single_photo()`
3. Check `photo_files` list - Are photos found?
4. Check `img` - Is image loaded correctly?
5. Check `faces` after detection - How many faces found?
6. If `len(faces) == 0` → Check image quality or model loading

### Scenario 3: "Clustering creates wrong groups"

**Debug Steps**:
1. Start Python debugger: **"🐍 Debug Python - Clustering"**
2. Set breakpoint after `labels = clustering.fit_predict()`
3. Check `labels` array
4. Check `eps` parameter (lower = stricter grouping)
5. Check `encoding_matrix` - Are embeddings normalized?

### Scenario 4: "Progress not updating"

**Debug Steps**:
1. Set backend breakpoint at `scanProcess.stdout.on('data')`
2. Check if Python is sending progress JSON
3. Check if `scanStatus` is being updated
4. Check frontend polling: breakpoint in `fetchScanStatus()`
5. Verify polling interval is running

---

## 🛠️ Troubleshooting

### Python debugger not working?

**Check Python path**:
```bash
# Verify Python executable exists
ls -la /mnt/d/Photos\ Ai/venv_onnx/Scripts/python.exe
```

If different location, update `.vscode/launch.json`:
```json
"python": "YOUR_ACTUAL_PATH_HERE"
```

### Chrome debugger not connecting?

**Start frontend manually first**:
```bash
cd client
npm run dev
```

Then: **F5** → **"🔵 Debug Frontend (Chrome)"**

### Breakpoints not hitting?

1. **Check source maps**: Make sure TypeScript/React is compiled with source maps
2. **Rebuild**: Run `npm run build` in server/client
3. **Restart debugger**: Stop (Shift+F5) and start again (F5)

---

## 📚 Quick Reference

| Shortcut | Action |
|----------|--------|
| **F5** | Start debugging / Continue |
| **Shift+F5** | Stop debugging |
| **Ctrl+Shift+F5** | Restart debugging |
| **F9** | Toggle breakpoint |
| **F10** | Step over (next line) |
| **F11** | Step into function |
| **Shift+F11** | Step out of function |
| **Ctrl+K Ctrl+I** | Show hover info |

---

## 🎓 Learning Path

**Beginner**: Start with these
1. Set backend breakpoint at `POST /scan` handler
2. Click "Scan Photos" and see it pause
3. Hover over variables to see their values
4. Press F10 to step through line by line

**Intermediate**: Try these
1. Set breakpoints in Python scripts
2. Watch variables in Debug panel
3. Use Debug Console to run commands
4. Inspect database while debugging

**Advanced**: Master these
1. Debug full stack (frontend + backend together)
2. Use conditional breakpoints
3. Use logpoints instead of console.log
4. Debug Python when called from Node.js

---

## ✅ Summary

**To debug People tab workflow**:

1. ✅ Open VS Code in project folder
2. ✅ Press F5 → Select debug configuration
3. ✅ Set breakpoints by clicking line numbers
4. ✅ Trigger action in UI (click button)
5. ✅ Code pauses at breakpoint
6. ✅ Inspect variables, step through code
7. ✅ Continue with F5

**No code modifications needed!** All debugging is done through VS Code's debugger.

Happy debugging! 🐛🔍
