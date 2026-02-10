# Server Startup Guide

## Current Issue
The backend server is not running, which is why:
- Screenshots aren't showing in the Screenshots & Snips tab
- API calls are failing
- Frontend can't fetch photo data

## How to Start the Server

### Option 1: From VS Code Terminal (Recommended)
1. Open VS Code
2. Open terminal in VS Code (Ctrl + `)
3. Make sure you're in the project root: `/mnt/d/Photos Ai/photo-viewer`
4. Run: `npm run dev`

This will start both the backend (port 3002) and frontend (port 5173) servers.

### Option 2: From Windows PowerShell
If you need to run from Windows PowerShell:

```powershell
cd "D:\Photos Ai\photo-viewer"

# First, rebuild better-sqlite3 for Windows
cd server
npm rebuild better-sqlite3
cd ..

# Then start both servers
npm run dev
```

### Option 3: Backend Only (for testing)
```bash
cd /mnt/d/Photos Ai/photo-viewer/server
npm run dev
```

## Verifying the Server is Running

After starting, you should see:
```
[SERVER] > photo-viewer-server@1.0.0 dev
[SERVER] > tsx watch src/index.ts
[SERVER] Server running on http://localhost:3002
[CLIENT] VITE v5.x.x ready in xxx ms
[CLIENT] ➜ Local: http://localhost:5173/
```

## Testing Screenshot Detection

Once the server is running:

1. Open your browser to http://localhost:5173
2. Open browser console (F12)
3. Navigate to "Screenshots & Snips" tab
4. You should see console logs like:
   ```
   [ScreenshotsView] Total photos: 123
   [ScreenshotsView] Screenshot found: Screenshot 2026-01-19 121209.png isScreenshot: true
   [ScreenshotsView] Filtered screenshots: 1
   ```

## Current Screenshot Detection Status

✅ Pattern matching works correctly - "Screenshot 2026-01-19 121209.png" is detected
✅ Backend code has the correct logic
✅ Frontend filtering is properly implemented
❌ Server is not running (this is why it's not working)

## Next Steps After Starting Server

1. **Verify screenshots show up** - Check the Screenshots & Snips tab
2. **Run database migration** (for AI-based detection later):
   ```bash
   cd /mnt/d/Photos Ai/photo-viewer/server
   node run-screenshot-migration.js
   ```
3. **Start indexing** - This will enable AI-based detection for better accuracy

## Environment Notes

- Photos directory: `D:/Photos Ai/mobile`
- Database directory: `D:/Photos Ai/photo-viewer/server/data`
- Current environment: WSL (Linux)
- VS Code terminal uses WSL by default
- PowerShell requires rebuilding better-sqlite3 for Windows
