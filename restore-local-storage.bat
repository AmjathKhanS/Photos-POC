@echo off
title Restore Local Storage Mode
color 0C

echo ============================================================
echo PhotoViewer - Restore Local Storage Mode
echo ============================================================
echo.
echo This will restore the original local-only versions.
echo.
echo ============================================================
echo.

pause

echo.
echo Restoring original files...
echo.

REM Restore from backups
if exist "server\src\services\backups\photoService.local.backup.ts" (
    copy /Y "server\src\services\backups\photoService.local.backup.ts" "server\src\services\photoService.ts" >nul
    echo ✓ Restored photoService.ts
) else (
    echo ✗ Backup not found: photoService.local.backup.ts
)

if exist "server\src\routes\backups\photos.local.backup.ts" (
    copy /Y "server\src\routes\backups\photos.local.backup.ts" "server\src\routes\photos.ts" >nul
    echo ✓ Restored photos.ts
) else (
    echo ✗ Backup not found: photos.local.backup.ts
)

echo.
echo ============================================================
echo Restored to local-only mode!
echo ============================================================
echo.

pause
