# Photo Viewer - Startup Guide

## Quick Start (After Computer Restart)

### Option 1: Running from Windows (Recommended for your setup)

1. **Open PowerShell or Command Prompt**
   - Press `Win + X` and select "Windows PowerShell" or "Terminal"

2. **Navigate to project directory**
   ```powershell
   cd "D:\Photos Ai\photo-viewer"
   ```

3. **Start the application**
   ```powershell
   npm run dev
   ```

4. **Access the application**
   - Open your browser and go to: `http://localhost:5173`
   - The server will be running on: `http://localhost:3002`

---

### Option 2: Running from WSL

If you prefer to run from WSL:

1. **Switch to WSL .env configuration**
   - Rename `.env` to `.env.windows`
   - Rename `.env.wsl` to `.env` (or copy the WSL paths back)

2. **Open WSL Terminal**
   ```bash
   cd /mnt/d/Photos\ Ai/photo-viewer
   ```

3. **Start the application**
   ```bash
   npm run dev
   ```

---

## Troubleshooting

### Error: "tsx is not recognized"
- Make sure you're in the correct directory
- Run `npm install` in both root and server directories:
  ```powershell
  npm install
  cd server
  npm install
  cd ..
  ```

### Error: "ENOENT: no such file or directory, scandir 'D:\mnt\d\...'"
- This means you're running from Windows but using WSL paths
- Solution: Use the `.env` file with Windows paths (already configured)
- The paths should start with `D:/` not `/mnt/d/`

### Port Already in Use
- Kill the existing process:
  ```powershell
  # Find the process using port 3002
  netstat -ano | findstr :3002

  # Kill it (replace PID with the number from above)
  taskkill /PID <PID> /F
  ```

### Client Can't Connect to Server
- Check that the server started successfully (look for "Server running on port 3002")
- Verify no firewall is blocking port 3002
- Check that `.env` file has correct paths for your OS

---

## Environment Configuration

### Current Setup (Windows Paths)
```
PHOTOS_DIR=D:/Photos Ai/mobile
SQLITE_DB_PATH=D:/Photos Ai/photo-viewer/server/data/faces.db
CACHE_DIR=D:/Photos Ai/photo-viewer/server/cache
PYTHON_EXECUTABLE=D:/Photos Ai/photo-viewer/venv_onnx/Scripts/python.exe
```

### WSL Paths (if you want to switch)
```
PHOTOS_DIR=/mnt/d/Photos Ai/mobile
SQLITE_DB_PATH=/mnt/d/Photos Ai/photo-viewer/server/data/faces.db
CACHE_DIR=/mnt/d/Photos Ai/photo-viewer/server/cache
```

---

## One-Time Setup (only if starting fresh)

If you've just cloned the repo or reinstalled:

```powershell
# From project root
npm install
cd server
npm install
cd ../client
npm install
cd ..
```

---

## What Runs When You Start

1. **Server** (Node.js/Express)
   - Runs on port 3002
   - Serves API endpoints
   - Handles photo indexing and face detection

2. **Client** (Vite/React)
   - Runs on port 5173
   - Development server with hot reload
   - Proxies API requests to server

Both run concurrently when you use `npm run dev` from the root directory.
