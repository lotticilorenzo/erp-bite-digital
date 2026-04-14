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

# Crea directory uploads con permessi world-writable per compatibilità
# con volumi Docker (i named volumes vengono montati come root)
RUN mkdir -p /app/static/uploads \
    && chmod 777 /app/static/uploads \
    && chown -R appuser:appgroup /app

USER appuser

# In produzione: senza --reload, con workers configurabili via env
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WORKERS:-2}"]
