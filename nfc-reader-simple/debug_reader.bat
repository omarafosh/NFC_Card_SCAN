@echo off
echo Launching NFC Reader in Debug Mode...
echo -------------------------------------

REM Try running the compiled executable
dist\reader-build-win.exe

echo.
echo -------------------------------------
echo If the program closed above, read the error message clearly.
echo Common causes:
echo 1. Missing .node files (Native modules)
echo 2. Missing DLLs (driver issues)
echo.
pause
