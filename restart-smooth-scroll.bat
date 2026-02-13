@echo off
echo ========================================
echo SMOOTH SCROLLING - NO EMPTY GRIDS
echo ========================================
echo.
echo CRITICAL FIXES:
echo.
echo 1. MULTI-PAGE PREFETCH
echo    - OLD: Only 1 page ahead
echo    - NEW: 3 pages ahead in parallel
echo    - RESULT: No lag after page 3!
echo.
echo 2. LARGER PAGE SIZE
echo    - OLD: 60 photos per page
echo    - NEW: 80 photos per page
echo    - RESULT: Fewer pagination events
echo.
echo 3. MASSIVE CACHE
echo    - OLD: 2000 thumbnails (50MB)
echo    - NEW: 3000 thumbnails (75MB)
echo    - TTL: 60 minutes (was 30)
echo    - RESULT: Keeps more in memory
echo.
echo 4. AGGRESSIVE PRELOADING
echo    - Loads 2000px ahead
echo    - Prefetches 3 pages = 240 photos
echo    - RESULT: Always ready before you scroll
echo.

echo [1/3] Stopping server...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo [2/3] Clearing cache...
rd /s /q "%TEMP%\photo-viewer-cache" 2>nul

echo [3/3] Starting smooth-scroll server...
echo.
echo Wait for: "Thumbnail pre-generation complete!"
echo Then hard refresh: Ctrl+Shift+R
echo.
echo SCROLL TEST: Scroll down past page 10
echo   - Should be SMOOTH with no empty grids
echo   - Check browser console for prefetch logs
echo.
timeout /t 1 /nobreak >nul

npm run dev
