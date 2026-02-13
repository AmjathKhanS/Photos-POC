@echo off
echo Clearing thumbnail cache...
rd /s /q "%TEMP%\photo-viewer-cache" 2>nul
echo Cache cleared!
echo.
echo Now refresh your browser with Ctrl+Shift+R to see new thumbnails.
pause
