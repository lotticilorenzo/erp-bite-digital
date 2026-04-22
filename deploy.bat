@echo off
setlocal

echo.
echo  ====================================================
echo   BITE ERP ^| Deploy semplificato su Digital Ocean
echo  ====================================================
echo.
echo  Flusso consigliato:
echo   - deploy.bat           ^> codice + build + verifiche
echo   - deploy.bat -SyncDb   ^> codice + build + DB + verifiche
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0allinea_online.ps1" %*
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
    echo.
    echo  Deploy terminato con errori. Controlla il log sopra.
    pause
    exit /b %EXIT_CODE%
)

echo.
echo  Deploy completato correttamente.
pause
