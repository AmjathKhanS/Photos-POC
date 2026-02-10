# Start Photo Viewer Server on Windows
# This script starts the server using Windows Node.js and Python

Write-Host "🚀 Starting Photo Viewer Server on Windows..." -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ERROR: Node.js is not installed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Node.js from: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ ERROR: package.json not found!" -ForegroundColor Red
    Write-Host "Please run this script from the server directory" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

# Display configuration
Write-Host "📊 Configuration:" -ForegroundColor Green
Write-Host "   Node.js: $(node --version)"
Write-Host "   NPM: $(npm --version)"
Write-Host "   Directory: $PWD"
Write-Host ""

# Start the server
Write-Host "▶️  Starting server..." -ForegroundColor Cyan
Write-Host "   Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

npm run dev
