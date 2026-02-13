@echo off
echo ========================================
echo COMPLETE RESET - Fresh Start
echo ========================================
echo.

echo [1/5] Stopping any running servers...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo [2/5] Clearing server thumbnail cache...
rd /s /q "%TEMP%\photo-viewer-cache" 2>nul
echo     Cache cleared!

echo [3/5] Clearing Node.js cache...
rd /s /q "server\node_modules\.cache" 2>nul
rd /s /q "server\.tsx" 2>nul
echo     Node cache cleared!

echo [4/5] Clearing browser cache instructions...
echo.
echo     IMPORTANT: After server starts, do this in your browser:
echo     - Press Ctrl + Shift + Delete
echo     - Select "Cached images and files"
echo     - Click "Clear data"
echo     OR simply press Ctrl + Shift + R (hard refresh)
echo.

echo [5/5] Starting fresh server...
echo.
echo ========================================
echo Server will start in 3 seconds...
echo ========================================
timeout /t 3 /nobreak >nul

npm run dev

pause
