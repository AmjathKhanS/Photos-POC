@echo off
REM Fix native modules for Windows

echo.
echo ========================================
echo   Rebuilding Native Modules for Windows
echo ========================================
echo.

echo [INFO] This will rebuild better-sqlite3 for Windows...
echo [INFO] This may take 1-2 minutes...
echo.

REM First try rebuild
echo [STEP 1/2] Attempting rebuild...
call npm rebuild better-sqlite3

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Rebuild completed!
    goto :test
)

echo.
echo [STEP 2/2] Rebuild failed, trying full reinstall...
call npm uninstall better-sqlite3
call npm install better-sqlite3

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Reinstall completed!
    goto :test
)

echo.
echo [ERROR] Failed to fix modules. Please run manually:
echo   npm rebuild better-sqlite3
echo.
pause
exit /b 1

:test
echo.
echo [INFO] Testing database connection...
node -e "const Database = require('better-sqlite3'); const db = new Database('./data/faces.db'); console.log('✅ Database connection successful!'); db.close();"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   ✅ SUCCESS! Modules fixed for Windows
    echo ========================================
    echo.
    echo You can now start the server with:
    echo   start-server-windows.cmd
    echo.
) else (
    echo.
    echo [ERROR] Database test failed. Please check the error above.
    echo.
)

pause
