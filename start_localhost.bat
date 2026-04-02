@echo off
echo Avvio di Bite ERP in corso...
cd backend
docker-compose up -d
echo.
echo Il sito sara' disponibile a breve su http://localhost
echo Assicurati che Docker Desktop sia aperto!
pause
