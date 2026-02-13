@echo off
echo ========================================
echo PAGINATION PERFORMANCE OPTIMIZATIONS
echo ========================================
echo.
echo Optimizations applied:
echo   1. Thumbnail size: 600px (great quality, faster loading)
echo   2. Quality: 90%% (optimal balance)
echo   3. Page size: 40 -^> 60 photos per page
echo   4. Prefetch distance: 8 screens ahead
echo   5. Caching re-enabled (instant delivery)
echo   6. HTTP Keep-Alive enabled
echo.

echo [1/3] Stopping server...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo [2/3] Clearing old 800px cache...
rd /s /q "%TEMP%\photo-viewer-cache" 2>nul
echo     Cache cleared - will regenerate 600px thumbnails

echo [3/3] Starting optimized server...
echo.
timeout /t 1 /nobreak >nul

npm run dev
