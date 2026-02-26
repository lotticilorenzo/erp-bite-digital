# Deploy Cloud ERP (staging esplicito)

## Decisioni architetturali (scelte definitive)

- Provider: Render.
- Database: Render PostgreSQL gestito, istanza dedicata staging.
- Backup DB: automatici attivi sul servizio Postgres.
- Backend: Render Web Service (Docker), healthcheck su `/health`.
- Frontend: Render Static Site, servito in HTTPS.
- Strategia schema DB: `scripts/init_db.py` idempotente (no `schema.sql` "alla cieca" a ogni startup).
- Bootstrap admin: `BOOTSTRAP_ADMIN_*`, idempotente, solo staging/dev.

## File di riferimento

- Blueprint staging: [`render.staging.yaml`](/Users/aless/Documents/New project/render.staging.yaml)
- Guida cloud: [`CLOUD_DEPLOY_GUIDE.md`](/Users/aless/Documents/New project/docs/CLOUD_DEPLOY_GUIDE.md)
- Init DB idempotente: [`init_db.py`](/Users/aless/Documents/New project/backend/scripts/init_db.py)
- Bootstrap admin idempotente: [`bootstrap_admin.py`](/Users/aless/Documents/New project/backend/scripts/bootstrap_admin.py)

## Env minime backend (staging)

- `DATABASE_URL` (Render Postgres connection string)
- `SECRET_KEY` oppure `JWT_SECRET`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `CORS_ORIGINS` con origine frontend esatta
- `CORS_ALLOW_CREDENTIALS=true`
- `BOOTSTRAP_ADMIN_ENABLED=true`
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `ENV=staging`
- `LOG_LEVEL=info`

## Ordine corretto deploy staging

1. Crei DB gestito su Render.
2. Deploy backend Web Service.
3. Inizializzi schema DB (`init_db.py`) con `DATABASE_URL` di staging.
4. Esegui bootstrap admin (`bootstrap_admin.py`) con env `BOOTSTRAP_ADMIN_*`.
5. Deploy frontend statico.
6. Imposti in UI Base URL API: `https://<backend-staging>/api/v1`.

Comandi init/seed da eseguire una volta (shell del servizio backend staging):

```bash
cd /app
python scripts/init_db.py
python scripts/bootstrap_admin.py
```

## CORS: regola non negoziabile

`CORS_ORIGINS` deve contenere l'origine del frontend, non quella del backend.

Esempio corretto:
- frontend: `https://bite-erp-staging-web.onrender.com`
- backend: `https://bite-erp-staging-api.onrender.com`
- `CORS_ORIGINS=https://bite-erp-staging-web.onrender.com`

## Validazioni obbligatorie

```bash
curl -i https://<backend-staging>/health
```

```bash
curl -i https://<backend-staging>/docs
```

```bash
curl -i -X OPTIONS https://<backend-staging>/api/v1/auth/login \
  -H "Origin: https://<frontend-staging>" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
```

Atteso sul preflight:
- `Access-Control-Allow-Origin: https://<frontend-staging>`

```bash
curl -i -X POST https://<backend-staging>/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<BOOTSTRAP_ADMIN_EMAIL>","password":"<BOOTSTRAP_ADMIN_PASSWORD>"}'
```

Atteso:
- `200 OK`
- body con `access_token`

Verifica rapida automatizzata:

```bash
cd backend
./scripts/staging_smoke.sh \
  "https://<backend-staging>" \
  "https://<frontend-staging>" \
  "<BOOTSTRAP_ADMIN_EMAIL>" \
  "<BOOTSTRAP_ADMIN_PASSWORD>"
```
