@echo off
REM ============================================================
REM  BITE ERP — Deploy completo su Digital Ocean
REM
REM  Cosa fa:
REM    1. Commit + push di tutte le modifiche locali su GitHub
REM    2. Pull sul server DO + rebuild containers
REM    3. Build del frontend (dist/)
REM
REM  PREREQUISITO: eseguire setup_ssh_do.bat una volta sola prima.
REM
REM  Server: 178.128.198.11
REM  Path:   /root/mio-gestionale
REM ============================================================

set DO_HOST=bite-do
set SERVER_PATH=/root/mio-gestionale

echo.
echo  ====================================================
echo   BITE ERP ^| Deploy su Digital Ocean
echo  ====================================================
echo.

REM ── STEP 1: Commit e push modifiche locali ──────────────────
echo  [1/3] Commit e push su GitHub...
"C:\Program Files\Git\bin\bash.exe" -c "cd '/c/Users/lotti/Desktop/erp-bite-digital' && git add -A && git diff --cached --quiet || git commit -m 'deploy: aggiornamento $(date +%Y-%m-%d\ %H:%M)' && git push origin main"

if %errorlevel% neq 0 (
    echo  [WARN] Nessuna modifica da committare, o push fallito. Continuo comunque...
)

echo  [1/3] FATTO
echo.

REM ── STEP 2: Pull + rebuild sul server ──────────────────────
echo  [2/3] Aggiornamento codice sul server...
"C:\Program Files\Git\bin\bash.exe" -c "ssh %DO_HOST% 'cd %SERVER_PATH% && git pull origin main 2>&1'"

echo  [2/3] FATTO
echo.

REM ── STEP 3: Build frontend + restart containers ─────────────
echo  [3/3] Build frontend + riavvio containers...
"C:\Program Files\Git\bin\bash.exe" -c "ssh %DO_HOST% 'cd %SERVER_PATH%/frontend && npm install --legacy-peer-deps && npm run build 2>&1 | tail -5'"
"C:\Program Files\Git\bin\bash.exe" -c "ssh %DO_HOST% 'cd %SERVER_PATH%/backend && docker-compose up --build -d 2>&1 | tail -10'"

echo  [3/3] FATTO
echo.

echo  ====================================================
echo   DEPLOY COMPLETATO!
echo   Sito: http://178.128.198.11
echo  ====================================================
echo.
pause
