@echo off
title Enable Cloud Storage Support
color 0E

echo ============================================================
echo PhotoViewer - Enable Cloud Storage Support
echo ============================================================
echo.
echo This script will update your code to support cloud storage
echo while keeping local filesystem mode working.
echo.
echo What will happen:
echo   1. Backup current files
echo   2. Replace with cloud-aware versions
echo   3. Keep backups for safety
echo.
echo ============================================================
echo.

pause

echo.
echo [1/3] Backing up current files...
echo.

REM Create backups directory
if not exist "server\src\services\backups" mkdir "server\src\services\backups"
if not exist "server\src\routes\backups" mkdir "server\src\routes\backups"

REM Backup photo service
copy /Y "server\src\services\photoService.ts" "server\src\services\backups\photoService.local.backup.ts" >nul
echo     ✓ Backed up photoService.ts

REM Backup photo routes
copy /Y "server\src\routes\photos.ts" "server\src\routes\backups\photos.local.backup.ts" >nul
echo     ✓ Backed up photos.ts

echo.
echo [2/3] Applying cloud-aware versions...
echo.

REM Replace photo service
copy /Y "server\src\services\photoServiceCloud.ts" "server\src\services\photoService.ts" >nul
echo     ✓ Updated photoService.ts (cloud-aware)

REM Replace photo routes
copy /Y "server\src\routes\photosCloud.ts" "server\src\routes\photos.ts" >nul
echo     ✓ Updated photos.ts (cloud-aware)

echo.
echo [3/3] Verification...
echo.

REM Check files exist
if exist "server\src\services\photoService.ts" (
    echo     ✓ photoService.ts updated
) else (
    echo     ✗ Error: photoService.ts not found
)

if exist "server\src\routes\photos.ts" (
    echo     ✓ photos.ts updated
) else (
    echo     ✗ Error: photos.ts not found
)

echo.
echo ============================================================
echo Cloud Storage Support Enabled!
echo ============================================================
echo.
echo Backups saved to:
echo   server/src/services/backups/
echo   server/src/routes/backups/
echo.
echo Your app now supports:
echo   ✓ Local mode:  PHOTOS_DIR=/path/to/photos
echo   ✓ Cloud mode:  PHOTOS_DIR=cloudinary
echo.
echo Next steps:
echo   1. Test local mode still works (npm run dev)
echo   2. Upload photos to Cloudinary
echo   3. Deploy with PHOTOS_DIR=cloudinary
echo.
echo To rollback: Run restore-local-storage.bat
echo.
echo ============================================================
echo.

pause
