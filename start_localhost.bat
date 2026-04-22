@echo off
setlocal

echo Avvio stack locale Bite ERP...
pushd "%~dp0backend"
docker compose up -d
set EXIT_CODE=%ERRORLEVEL%
popd

if not "%EXIT_CODE%"=="0" (
    echo.
    echo Avvio non riuscito. Verifica che Docker Desktop sia aperto.
    pause
    exit /b %EXIT_CODE%
)

echo.
echo Frontend React in sviluppo: http://localhost:5173
echo Backend API: http://localhost:8000/health
echo Build React servita da nginx: https://localhost/
echo.
echo Se e' il primo avvio, il container frontend potrebbe impiegare un po' per npm install.
pause
