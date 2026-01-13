@echo off
REM Simple NFC Reader Launcher for Windows
REM Double-click this file to start the reader

cd /d "%~dp0"

echo ╔════════════════════════════════════════╗
echo ║   NFC Reader Setup                     ║
echo ╚════════════════════════════════════════╝
echo.

REM Check if .env exists
if not exist ".env" (
    echo ⚠️  Configuration file not found!
    echo.
    echo Please create a .env file with:
    echo   WEBSITE_URL=https://your-site.vercel.app
    echo   TERMINAL_ID=10
    echo.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
    echo.
)

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org
    echo.
    pause
    exit /b 1
)

REM Start the reader
echo 🚀 Starting NFC Reader...
echo.
call npm start

pause
