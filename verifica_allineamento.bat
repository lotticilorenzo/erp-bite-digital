@echo off
setlocal

echo.
echo  ====================================================
echo   BITE ERP ^| Verifica allineamento locale-online
echo  ====================================================
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0verifica_allineamento.ps1"
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
    echo.
    echo  Verifica fallita. Controlla il log sopra.
    pause
    exit /b %EXIT_CODE%
)

echo.
echo  Verifica completata correttamente.
pause
