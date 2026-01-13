=============================================
NFC Secure Reader - Windows & Mac
=============================================

Instructions for Use:
---------------------

1. Windows Secure Executable:
   - Navigate to the "backend/nfc-reader-windows/dist" folder.
   - You will find "NFC-Reader.exe" (or nfc-secure-launcher.exe).
   - IMPORTANT: Make sure "terminal-config.json" is in the SAME folder as the .exe file.
   - Run the .exe file directly. No need for Node.js or .env files.
   
2. Configuration:
   - Edit "terminal-config.json" to set your Terminal ID, Branch ID, and Secret.
   - Do NOT share this EXE publicly as it contains your Supabase Keys encrypted inside.

=============================================
Technical Details (For Developer):
=============================================
- The source code (bundle.js) is ENCRYPTED into 'bundle.enc' and embedded inside the EXE.
- The 'launcher.js' decrypts it in memory and executes it.
- This prevents casual users from seeing the source code or extracting keys easily.
- Dependencies (nfc-pcsc, supabase, etc.) are bundled inside the EXE.

Troubleshooting:
----------------
- If you see "Smart Card Resource Manager is not running", ensure your NFC reader driver is installed.
- If it opens and closes immediately, run it from CMD/PowerShell to see errors.

Enjoy!
