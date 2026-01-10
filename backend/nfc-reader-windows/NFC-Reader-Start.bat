@echo off
setlocal
title NFC Reader v25 [PROFESSIONAL PORTABLE]
color 0A
cls

echo ================================================================
echo    NFC Reader - Version 25 (Professional Edition)
echo ================================================================
echo Status: Starting portable environment...
echo.

:: Get the directory of this script
set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

:: Path to portable node
set "NODE_EXE=%APP_DIR%runtime\node.exe"

:: Path to the bundled app
set "APP_JS=%APP_DIR%app\bundle.js"

if not exist "%NODE_EXE%" (
    echo [ERROR] Runtime not found! Please do not delete the 'runtime' folder.
    pause
    exit /b 1
)

echo [OK] Runtime detected.
echo [OK] Starting application...
echo ----------------------------------------------------------------
echo.

"%NODE_EXE%" "%APP_JS%"

echo.
echo ----------------------------------------------------------------
echo Reader stopped or encountered an error.
echo Press any key to close this window...
pause >nul
