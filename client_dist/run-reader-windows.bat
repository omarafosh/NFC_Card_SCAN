@echo off
title NFC Reader Service
color 0A

echo ==========================================
echo      NFC Discount System Middleware
echo ==========================================
echo.

:: 1. Check if Node.js is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo Error: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit
)

:: 2. Install dependencies if not exists (checked by node_modules folder)
if not exist "node_modules" (
    echo [Setup] Installing dependencies for the first time...
    echo This might take a minute...
    call npm install
    call npm install nfc-pcsc --save
    echo.
    echo [Setup] Complete!
)

:: 3. Run the Reader
echo [System] Starting NFC Reader Service...
echo [System] Do not close this window while working.
echo.

:loop
call npm run reader
echo.
echo [Warning] Reader script stopped. Restarting in 3 seconds...
timeout /t 3 >nul
goto loop
