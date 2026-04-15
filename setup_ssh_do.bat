@echo off
REM ============================================================
REM  BITE ERP — Setup chiave SSH su Digital Ocean (UNA SOLA VOLTA)
REM  Esegui questo script UNA volta sola.
REM  Ti chiederà la password root del server: BiteDigitalStudio05837/!
REM ============================================================

echo.
echo  [SETUP SSH] Copio la chiave pubblica su Digital Ocean...
echo  Ti verra' chiesta la password: BiteDigitalStudio05837/!
echo.

REM Usa ssh-copy-id tramite Git Bash
"C:\Program Files\Git\bin\bash.exe" -c "ssh-copy-id -i ~/.ssh/bite_erp_do.pub -o StrictHostKeyChecking=no root@178.128.198.11"

echo.
echo  [OK] Chiave SSH installata. D'ora in poi i deploy non richiedono password.
echo.
pause
