@echo off
echo Avvio di Bite ERP in corso...
cd backend
docker-compose up -d
echo.
echo Il sito LIVE (sviluppo) sara' disponibile su: http://localhost:5173
echo La versione statica (nginx) sara' su: http://localhost
echo.
echo Attendere il completamento di 'npm install' nel container frontend...
echo Assicurati che Docker Desktop sia aperto!
pause
