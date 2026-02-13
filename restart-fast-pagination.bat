@echo off
echo ========================================
echo ULTRA-FAST PAGINATION OPTIMIZATIONS
echo ========================================
echo.
echo Applied optimizations:
echo.
echo CLIENT-SIDE:
echo   - Aggressive preloading (2000px ahead)
echo   - Removed native lazy loading
echo   - Shimmer placeholder during load
echo   - Smooth fade-in transition
echo.
echo SERVER-SIDE:
echo   - 100 concurrent thumbnail generations
echo   - 2000 thumbnails in RAM cache
echo   - 30-minute memory cache TTL
echo   - Instant delivery from cache
echo.
echo RESULT:
echo   - Images load BEFORE you scroll to them
echo   - No empty layouts
echo   - Smooth, instant pagination
echo.

echo [1/3] Stopping server...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo [2/3] Clearing cache for fresh start...
rd /s /q "%TEMP%\photo-viewer-cache" 2>nul

echo [3/3] Starting ultra-fast server...
echo.
echo Wait for: "Thumbnail pre-generation complete!"
echo Then hard refresh browser: Ctrl+Shift+R
echo.
timeout /t 1 /nobreak >nul

npm run dev
