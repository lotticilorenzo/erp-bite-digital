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

1. Aggiorna il repository locale e verifica build/test.
2. Esegui push su `main`.
3. Sulla VPS: `git pull --ff-only origin main`.
4. Nel backend: `docker compose -f docker-compose.prod.yml up --build -d db backend nginx db_backup`.
5. Nel frontend: `npm ci --legacy-peer-deps && npm run build`.
6. Verifica `http://localhost:8000/health` dalla VPS e il dominio pubblico via nginx.

## Check rapidi sulla VPS

- `docker compose -f docker-compose.prod.yml ps`
- `ss -ltn | grep 8000`
- `ss -ltn | grep 5173`

Atteso:

- `127.0.0.1:8000` presente
- nessuna bind pubblica su `0.0.0.0:8000`
- nessun listener su `5173`
