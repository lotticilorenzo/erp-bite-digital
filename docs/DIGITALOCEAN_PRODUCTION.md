# Produzione DigitalOcean

## Stack reale

- Host: VPS Ubuntu su DigitalOcean.
- Deploy applicativo: `git pull` via SSH sul repository server-side.
- Backend: Docker Compose produzione in [`backend/docker-compose.prod.yml`](../backend/docker-compose.prod.yml).
- Frontend: build statico Vite servito da nginx.
- Database: PostgreSQL in container Docker.
- Migrazioni schema: `scripts/init_db.py` seguito da `scripts/run_db_migrations.py`.

## Regole operative

- Il file `backend/docker-compose.yml` e' solo per sviluppo locale.
- In produzione si usa solo `backend/docker-compose.prod.yml`.
- Il backend deve ascoltare solo su `127.0.0.1:8000`.
- Il dev server Vite non deve essere presente ne' esposto in VPS.

## Deploy standard

1. Esegui `deploy.bat` dalla root del repository.
2. Lo script avvia Docker Desktop locale se serve, esegue `pytest` backend, builda il frontend locale e riallinea lo stack `localhost`.
3. Lo script committa e pusha su `main`.
4. Sulla VPS riallinea il repository, pulisce il drift noto di `frontend/package-lock.json`, builda il frontend e rialza `db`, `backend`, `nginx`, `db_backup`.
5. Infine verifica:
   - `localhost` backend sano
   - asset React online identici alla build locale
   - API pubblica raggiungibile
   - backend produzione vincolato su `127.0.0.1:8000`
   - assenza del dev server Vite sulla VPS

Comando opzionale con sync completo DB locale -> produzione:

```powershell
.\deploy.bat -SyncDb
```

## Check rapidi sulla VPS

- `docker compose -f docker-compose.prod.yml ps`
- `ss -ltn | grep 8000`
- `ss -ltn | grep 5173`

Atteso:

- `127.0.0.1:8000` presente
- nessuna bind pubblica su `0.0.0.0:8000`
- nessun listener su `5173`
