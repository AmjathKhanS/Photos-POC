@echo off
echo Killing Node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo Clearing cache...
rd /s /q "%TEMP%\photo-viewer-cache" 2>nul

echo.
echo ========================================
echo .env file updated to:
echo   MAX_THUMBNAIL_SIZE=800
echo   THUMBNAIL_QUALITY=95
echo ========================================
echo.
echo Starting server with NEW settings...
echo.

npm run dev
