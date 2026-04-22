@echo off
setlocal

echo.
echo  ====================================================
echo   BITE ERP ^| Allineamento completo con Sync DB
echo  ====================================================
echo.
echo  Questo flusso:
echo   - pusha il codice su GitHub
echo   - aggiorna il server
echo   - rebuilda il backend/frontend
echo   - sincronizza il DB locale sul server
echo   - riesegue le verifiche finali
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0allinea_online.ps1" -SyncDb
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
    echo.
    echo  Sync DB terminato con errori. Controlla il log sopra.
    pause
    exit /b %EXIT_CODE%
)

echo.
echo  Sync DB completato correttamente.
pause
