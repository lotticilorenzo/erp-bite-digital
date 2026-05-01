FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Dipendenze di sistema (solo il minimo indispensabile)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Installa dipendenze Python prima del codice (sfrutta layer cache Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Crea utente non-root
RUN groupadd -r appgroup && useradd -r -g appgroup -u 1001 appuser

# Copia codice sorgente
COPY app/ ./app/
COPY scripts/ ./scripts/
COPY migrations/ ./migrations/
COPY tests/ ./tests/
COPY schema.sql ./schema.sql

# Crea directory necessarie con permessi corretti
RUN mkdir -p /app/static/uploads /app/static/logos /app/static/avatars \
    && chown -R appuser:appgroup /app \
    && chmod 755 /app /app/static \
    && chmod 700 /app/static/uploads /app/static/logos /app/static/avatars

USER appuser

# Init schema + migrazioni versionate prima dell'avvio API.
CMD ["sh", "-c", "python scripts/init_db.py && python scripts/run_db_migrations.py && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WORKERS:-2}"]
