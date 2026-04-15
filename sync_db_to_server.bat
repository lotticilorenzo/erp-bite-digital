@echo off
REM ============================================================
REM  BITE ERP — Sincronizza DB locale → Digital Ocean
REM
REM  ATTENZIONE: sovrascrive COMPLETAMENTE il database sul server.
REM  Usare solo quando vuoi spostare i dati locali (clienti,
REM  collaboratori, movimenti, ecc.) sul server.
REM
REM  PREREQUISITO: setup_ssh_do.bat eseguito almeno una volta.
REM ============================================================

set DO_HOST=bite-do
set SERVER_PATH=/mio-gestionale

echo.
echo  ====================================================
echo   BITE ERP ^| Sync DB Locale -^> Digital Ocean
echo  ====================================================
echo.
echo  ATTENZIONE: i dati sul server verranno SOSTITUITI
echo  con quelli del tuo database locale.
echo.
set /p CONFIRM=  Sei sicuro? Digita SI e premi Invio:
if /i not "%CONFIRM%"=="SI" (
    echo  Operazione annullata.
    pause
    exit /b
)
echo.

REM ── STEP 1: Dump DB locale ─────────────────────────────────
echo  [1/4] Esporto database locale...
"C:\Program Files\Git\bin\bash.exe" -c "docker exec bite_erp_db pg_dump -U bite --no-owner --no-privileges bite_erp > /tmp/bite_erp_dump.sql && echo 'Dump OK'"

echo  [1/4] FATTO
echo.

REM ── STEP 2: Copia dump sul server ─────────────────────────
echo  [2/4] Trasferisco dump sul server...
"C:\Program Files\Git\bin\bash.exe" -c "scp -i ~/.ssh/bite_erp_do /tmp/bite_erp_dump.sql root@178.128.198.11:/tmp/bite_erp_dump.sql && echo 'SCP OK'"

echo  [2/4] FATTO
echo.

REM ── STEP 3: Ripristino DB sul server ───────────────────────
echo  [3/4] Ripristino database sul server...
"C:\Program Files\Git\bin\bash.exe" -c "ssh %DO_HOST% 'cd %SERVER_PATH%/backend && docker exec -i bite_erp_db psql -U bite -c \"DROP SCHEMA public CASCADE; CREATE SCHEMA public;\" bite_erp && docker exec -i bite_erp_db psql -U bite bite_erp < /tmp/bite_erp_dump.sql && echo \"DB Restore OK\"'"

echo  [3/4] FATTO
echo.

REM ── STEP 4: Pulizia ────────────────────────────────────────
echo  [4/4] Pulizia file temporanei...
"C:\Program Files\Git\bin\bash.exe" -c "ssh %DO_HOST% 'rm -f /tmp/bite_erp_dump.sql'"
del /f /q "%TEMP%\bite_erp_dump.sql" 2>nul

echo  [4/4] FATTO
echo.

echo  ====================================================
echo   SYNC DB COMPLETATO!
echo   I tuoi dati locali sono ora sul server.
echo  ====================================================
echo.
pause
