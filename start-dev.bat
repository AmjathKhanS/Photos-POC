@echo off
REM Start Development Environment - Windows/WSL Version
REM Run this from Windows Command Prompt or PowerShell

echo Starting Photo Viewer Development Environment...

wsl -d Ubuntu -e bash -c "cd '/mnt/d/Photos Ai/photo-viewer' && ./start-dev.sh"

pause
