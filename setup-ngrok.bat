@echo off
echo ========================================
echo PhotoViewer Ngrok Setup Guide
echo ========================================
echo.

echo This script will help you set up Ngrok for your PhotoViewer app.
echo.
echo STEP 1: Download Ngrok
echo ========================================
echo 1. Open your browser and go to: https://ngrok.com/download
echo 2. Click "Download for Windows"
echo 3. Extract the downloaded ZIP file
echo 4. Move ngrok.exe to: C:\ngrok\ngrok.exe
echo.
echo Press any key when you've completed this step...
pause > nul

echo.
echo STEP 2: Sign Up for Ngrok (Free)
echo ========================================
echo 1. Go to: https://dashboard.ngrok.com/signup
echo 2. Sign up with your email (or use GitHub/Google)
echo 3. You'll get a FREE account
echo.
echo Press any key when you've signed up...
pause > nul

echo.
echo STEP 3: Get Your Auth Token
echo ========================================
echo 1. After signing up, you'll see your auth token
echo 2. It looks like: 2abc...def123 (long string)
echo 3. Copy this token
echo.
echo Press any key when you have your token copied...
pause > nul

echo.
echo STEP 4: Configure Ngrok
echo ========================================
set /p NGROK_TOKEN="39sNMQytS6n4Ldji9q8n4XIinIQ_3NEhh952HWG1rQcbT14NJ"

echo.
echo Configuring Ngrok with your token...
C:\ngrok\ngrok.exe config add-authtoken %NGROK_TOKEN%

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✓ Ngrok configured successfully!
) else (
    echo.
    echo × Error configuring Ngrok
    echo   Make sure ngrok.exe is at C:\ngrok\ngrok.exe
    echo   If not, update the path in this script
    pause
    exit /b 1
)

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Run start-demo.bat to start your app
echo 2. Your manager will be able to access it via the Ngrok URL
echo.
echo Press any key to exit...
pause > nul
