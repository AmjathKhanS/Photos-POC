# 🚀 Quick Start - VS Code Debugging

**Current Status**: ✅ Ready to debug!
- ✅ Backend stopped (port 3002 free)
- ✅ Frontend running (http://localhost:5173)
- ✅ Debug configuration ready

---

## 🎯 Start Debugging NOW (3 Steps)

### Step 1: Open VS Code in Project Folder

```bash
cd "/mnt/d/Photos Ai/photo-viewer"
code .
```

Or: **File → Open Folder** → Select `/mnt/d/Photos Ai/photo-viewer`

---

### Step 2: Start Backend in Debug Mode

1. **Click** the **Run and Debug** icon in left sidebar (or press `Ctrl+Shift+D`)

2. **Select** from dropdown at top: **"🟢 Debug Backend (Node.js Server)"**

3. **Press F5** (or click green play button)

4. **Wait** for terminal to show:
   ```
   Server running on http://localhost:3002
   ```

✅ Backend is now running in DEBUG mode!

---

### Step 3: Set Your First Breakpoint

1. **Open file**: `server/src/services/faceService.ts`

2. **Find line 94** (the line with `scanProcess = spawn(PYTHON_CMD, [`)

3. **Click** on the left side of line number 94
   - A **red dot** appears = breakpoint is set! ✅

---

## 🎉 You're Ready!

Now try it:

1. **Open browser**: http://localhost:5173

2. **Go to People tab**

3. **Click "Scan Photos" button**

4. **VS Code pauses at your breakpoint!** 🎉

---

## 🔍 What to Do When Paused

When VS Code pauses at breakpoint:

### Left Panel - Variables
- Expand to see all variable values
- Look for:
  - `PYTHON_CMD` - Path to Python
  - `pythonScript` - Path to face processor
  - `PHOTOS_DIR` - Your photos folder
  - `scanStatus` - Current scan state

### Bottom Panel - Debug Console
Type these commands to inspect:
```javascript
PYTHON_CMD
PHOTOS_DIR
scanStatus
```

### Control Buttons (Top)
- **Continue (F5)** - Resume execution
- **Step Over (F10)** - Next line
- **Step Into (F11)** - Enter function
- **Step Out (Shift+F11)** - Exit function
- **Restart (Ctrl+Shift+F5)** - Restart debugger
- **Stop (Shift+F5)** - Stop debugging

---

## 📍 More Breakpoint Locations

### For "Scan Photos" Flow

**File**: `server/src/services/faceService.ts`
- **Line 94** - Python spawn (you already set this!)
- **Line 101** - Progress updates from Python
- **Line 127** - Python process completed

**File**: `server/src/routes/faces.ts`
- **~Line 20-30** - API endpoint handler

### For "Auto Group Photos" Flow

**File**: `server/src/services/faceClusterService.ts`
- **Line 30** - Python clustering spawn
- **Line 45** - Clustering completed

---

## 🐍 Debug Python Scripts

To debug the Python face detection script:

1. **Stop current debug session** (Shift+F5)

2. **Select**: **"🐍 Debug Python - Face Detection (Scan)"**

3. **Press F5**

4. **Set breakpoints** in:
   - `server/face-service/face_processor_onnx.py`
   - Around line 145 (where faces are detected)

5. **Python runs** and pauses at your breakpoint!

---

## 💡 Quick Tips

### Tip 1: Watch Variables
In Debug panel → **Watch** section:
- Click **+**
- Add: `scanStatus.processed`
- See it update in real-time!

### Tip 2: Conditional Breakpoints
Right-click breakpoint → **Edit Breakpoint**
- Condition: `scanStatus.processed > 5`
- Only pauses after 5 photos processed!

### Tip 3: Logpoints (No Code Changes!)
Right-click line number → **Add Logpoint**
- Message: `"Processing:", scanStatus.currentPhoto`
- Logs to console without modifying code!

### Tip 4: Debug Console
While paused, run code:
```javascript
// See all status
scanStatus

// Check photos directory
fs.readdirSync(PHOTOS_DIR).length

// Manually update status
scanStatus.status = 'idle'
```

---

## 🎯 Common Workflows

### Debug Complete "Scan Photos" Flow

1. Set breakpoints:
   - `faceService.ts` line 94 (Python spawn)
   - `faceService.ts` line 101 (Progress)

2. Click "Scan Photos" in browser

3. Pauses at line 94:
   - Check `PYTHON_CMD`, `PHOTOS_DIR`
   - Press F5 to continue

4. Pauses at line 101 (multiple times):
   - See progress updates from Python
   - Check `scanStatus.processed`
   - Press F5 to continue

### Debug "Auto Group Photos" Flow

1. Set breakpoint:
   - `faceClusterService.ts` line 30

2. Click "Auto Group Photos" in browser

3. When paused:
   - Check `eps` (should be 0.3)
   - Check `minSamples` (should be 2)
   - See Python clustering command

### Debug Python Face Detection

1. Select: **"🐍 Debug Python - Face Detection"**

2. Set breakpoint: `face_processor_onnx.py` ~line 145

3. When paused:
   - Check `len(faces)` - How many faces detected
   - Check `faces[0].bbox` - First face location
   - Check `embedding.shape` - Should be (512,)

---

## 🔧 Troubleshooting

### Breakpoint is Gray (Not Red)?
- **Cause**: Source maps not loaded yet
- **Fix**: Trigger the code once, then it turns red

### Breakpoint Not Hitting?
- **Check**: Is debugger running? (Should see toolbar at top)
- **Check**: Is code actually executing? (Add console.log temporarily)
- **Fix**: Stop and restart debugger (Shift+F5 then F5)

### Backend Won't Start?
- **Check**: Port 3002 already in use?
- **Fix**:
  ```bash
  kill $(lsof -ti:3002)
  ```
  Then restart debugger

### Frontend Not Connecting to Backend?
- **Check**: Is backend running in VS Code debug mode?
- **Check**: Backend shows "Server running on http://localhost:3002"?
- **Fix**: Restart both frontend and backend

---

## 📚 Full Documentation

For detailed debugging info, see:
- **DEBUG_GUIDE.md** - Complete debugging guide
- **BREAKPOINT_LOCATIONS.md** - All breakpoint locations
- **.vscode/launch.json** - Debug configurations

---

## ✅ Current Setup Summary

**Frontend**: Running on http://localhost:5173 ✅
**Backend**: Stopped, ready for VS Code debugging ✅
**Debug Config**: Ready in `.vscode/launch.json` ✅
**Breakpoint Suggestion**: `faceService.ts` line 94 ✅

---

## 🎯 Your Next Step

1. Open VS Code in project folder
2. Press F5
3. Select "🟢 Debug Backend (Node.js Server)"
4. Set breakpoint at `faceService.ts` line 94
5. Click "Scan Photos" in browser

**You're ready to debug!** 🐛🔍
