# Rebuild better-sqlite3 for Windows
Write-Host "Rebuilding better-sqlite3 for Windows..." -ForegroundColor Yellow
Set-Location "D:\Photos Ai\photo-viewer\server"
npm rebuild better-sqlite3
Write-Host "Rebuild complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Now you can run: npm run dev" -ForegroundColor Cyan
