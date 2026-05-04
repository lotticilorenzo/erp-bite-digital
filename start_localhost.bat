@echo off
setlocal

echo Verifica Docker Desktop...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$dockerReady = $false; try { docker info *> $null; $dockerReady = ($LASTEXITCODE -eq 0) } catch {}; if (-not $dockerReady) { $dockerExe = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'; if (-not (Test-Path $dockerExe)) { Write-Error 'Docker Desktop non trovato.'; exit 1 }; Start-Process -FilePath $dockerExe -WindowStyle Hidden; $deadline = (Get-Date).AddMinutes(3); do { Start-Sleep -Seconds 5; try { docker info *> $null; $dockerReady = ($LASTEXITCODE -eq 0) } catch {} } while (-not $dockerReady -and (Get-Date) -lt $deadline); if (-not $dockerReady) { Write-Error 'Docker Desktop non pronto entro 3 minuti.'; exit 1 } }"
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
    echo.
    echo Avvio non riuscito. Docker Desktop non e' disponibile.
    pause
    exit /b %EXIT_CODE%
)

echo Avvio stack locale Bite ERP...
pushd "%~dp0backend"
docker compose -f docker-compose.yml up -d --build
set EXIT_CODE=%ERRORLEVEL%
popd

if not "%EXIT_CODE%"=="0" (
    echo.
    echo Avvio non riuscito. Controlla lo stato di Docker Desktop e dei container.
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
