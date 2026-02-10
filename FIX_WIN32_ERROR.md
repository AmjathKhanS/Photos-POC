# Fix "not a valid Win32 application" Error

## The Error

```
Error: not a valid Win32 application
ERR_DLOPEN_FAILED
better_sqlite3.node
```

## What This Means

The `better-sqlite3` native module was compiled for **Linux** (when you ran npm install in WSL), but you're now trying to use it with **Windows Node.js**.

## The Fix (Choose One)

### Option 1: Use the Fix Script (Easiest!)

1. Open File Explorer
2. Navigate to: `D:\Photos Ai\photo-viewer\server`
3. **Double-click:** `fix-windows-modules.cmd`
4. Wait for it to complete
5. Start the server with `start-server-windows.cmd`

### Option 2: PowerShell/CMD

```powershell
cd "D:\Photos Ai\photo-viewer\server"
npm rebuild better-sqlite3
```

If rebuild fails, do a full reinstall:

```powershell
npm uninstall better-sqlite3
npm install better-sqlite3
```

### Option 3: Delete and Reinstall

```powershell
cd "D:\Photos Ai\photo-viewer\server"
Remove-Item -Recurse -Force node_modules\better-sqlite3
npm install better-sqlite3
```

## After Fixing

Once the rebuild completes:

1. **Test it works:**
   ```powershell
   node -e "const db = require('better-sqlite3')('./data/faces.db'); console.log('✅ Works!'); db.close();"
   ```

2. **Start the server:**
   ```
   start-server-windows.cmd
   ```

## Why This Happens

- **In WSL:** npm install compiles native modules for Linux
- **On Windows:** Node.js expects Windows-compiled native modules
- **Solution:** Rebuild the modules for Windows

## Prevention

**If you switch between WSL and Windows:**

- **Going to Windows:** Run `npm rebuild better-sqlite3`
- **Going to WSL:** Run `npm rebuild better-sqlite3`

Each platform needs its own compiled version of native modules.

## Still Getting Errors?

**Check your Node.js installation:**

```powershell
node --version
npm --version
```

Make sure you're using Windows Node.js (not WSL Node.js).

**Verify you're in the right directory:**

```powershell
pwd  # Should show: D:\Photos Ai\photo-viewer\server
ls package.json  # Should exist
```

**Check if modules are installed:**

```powershell
ls node_modules\better-sqlite3
```

If folder doesn't exist, run:

```powershell
npm install
```

## Summary

1. **Error:** "not a valid Win32 application"
2. **Cause:** Modules compiled for Linux, running on Windows
3. **Fix:** `npm rebuild better-sqlite3`
4. **Time:** Takes 30-60 seconds
5. **Result:** Everything works! ✅

---

**Quick Fix:** Double-click `fix-windows-modules.cmd` 🎯
