# Running from Windows PowerShell - Setup Guide

## The Issue
When running from Windows PowerShell, you need:
1. ✅ Windows-format paths in `.env` (D:/Photos Ai/mobile)
2. ✅ better-sqlite3 compiled for Windows (not Linux/WSL)

## Fix Steps

### Step 1: Rebuild better-sqlite3 for Windows
Open PowerShell and run:

```powershell
cd "D:\Photos Ai\photo-viewer\server"
npm rebuild better-sqlite3
```

This compiles the native module for Windows.

### Step 2: Restart the server
From the project root:

```powershell
cd "D:\Photos Ai\photo-viewer"
npm run dev
```

### Step 3: Verify it works
You should see:
```
[SERVER] ✅ Server running on http://localhost:3002
[SERVER] Reading photos from: D:/Photos Ai/mobile
[SERVER] Found files: 629
[SERVER] Supported image files: 403
```

## Common Errors

### Error 1: "invalid Win32 application"
**Cause**: better-sqlite3 was compiled for Linux/WSL
**Fix**: Run `npm rebuild better-sqlite3` in server directory

### Error 2: "ENOENT: no such file or directory, scandir 'D:\mnt\d\...'"
**Cause**: .env has WSL paths (/mnt/d/) but running from Windows
**Fix**: Already fixed! .env now uses Windows paths (D:/)

### Error 3: "invalid ELF header"
**Cause**: better-sqlite3 was compiled for Windows but running in WSL
**Fix**: Either:
- Run from Windows PowerShell (and rebuild for Windows)
- OR run from WSL terminal (and rebuild for Linux)

## Running from VS Code

If you're using VS Code:
- **VS Code terminal** → Usually uses WSL (need WSL paths)
- **External PowerShell** → Uses Windows (need Windows paths)

To check which one you're using:
```bash
echo $SHELL  # If this works, you're in WSL/Linux
```

```powershell
$PSVersionTable  # If this works, you're in PowerShell
```

## Current Configuration

✅ `.env` is configured for **Windows PowerShell**
✅ Paths use forward slashes (D:/Photos Ai/mobile)
❌ better-sqlite3 needs to be rebuilt for Windows

## Next: Rebuild better-sqlite3

Run this command in PowerShell:
```powershell
cd "D:\Photos Ai\photo-viewer\server"
npm rebuild better-sqlite3
cd ..
npm run dev
```
