# How to Start the Server

## ⚠️ First Time Setup (Windows)

**If switching from WSL, rebuild native modules first:**

Double-click: `fix-windows-modules.cmd`

OR run in PowerShell/CMD:
```powershell
npm rebuild better-sqlite3
```

This fixes the "not a valid Win32 application" error.

## Windows (Recommended) ✅

**Easiest way:**
```
Double-click: start-server-windows.cmd
```

**Or in PowerShell/CMD:**
```powershell
cd "D:\Photos Ai\photo-viewer\server"
start-server-windows.cmd
```

**Or direct NPM:**
```
npm run dev
```

✅ **Everything works on Windows!**
- Smart Albums generation ✅
- Memories generation ✅
- Face detection ✅
- All Python features ✅

## WSL (Limited Support) ⚠️

```bash
./start-server-wsl.sh
```

⚠️ **Limited functionality:**
- Viewing features work ✅
- Python features don't work ❌
- Album/Memory generation fails ❌

## After Starting

Server runs at: **http://localhost:3002**

Frontend (if running): **http://localhost:5173**

To stop: **Press Ctrl+C**

## Need Help?

See: **WINDOWS_VS_WSL.md** for detailed comparison

---

**🎯 Bottom Line: Use Windows for full functionality!**
