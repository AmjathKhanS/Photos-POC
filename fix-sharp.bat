@echo off
REM Fix Sharp Module - Windows/WSL Version
REM Run this from Windows Command Prompt or PowerShell

echo Fixing Sharp module for WSL environment...

wsl -d Ubuntu -e bash -c "cd '/mnt/d/Photos Ai/photo-viewer' && ./fix-sharp.sh"

echo.
echo Done! You can now start the development server.
pause
