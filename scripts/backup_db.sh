#!/bin/bash
# -----------------------------------------------------------------------------
# Script per il backup automatizzato del database PostgreSQL (Bite ERP)
# -----------------------------------------------------------------------------
# Questo script crea un dump compresso del database e mantiene gli ultimi 7 backup.
# Da eseguire tramite Cron, es. ogni notte alle 03:00.
# 
# Installazione (Crontab):
# 0 3 * * * /path/to/erp-bite-digital/scripts/backup_db.sh >> /var/log/bite_backup.log 2>&1
# -----------------------------------------------------------------------------

set -e

# Configurazione
DB_CONTAINER_NAME="bite-db"  # Nome del container docker di postgres
DB_USER="postgres"
DB_NAME="bite_erp"
BACKUP_DIR="/var/backups/bite_erp"
RETENTION_DAYS=7

DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="${BACKUP_DIR}/bite_db_${DATE}.sql.gz"

echo "[$(date)] Inizio backup del database ${DB_NAME}..."

# Crea la directory se non esiste
mkdir -p "${BACKUP_DIR}"

# Esegui il dump dal container Docker e comprimi al volo
docker exec -t "${DB_CONTAINER_NAME}" pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_FILE}"

echo "[$(date)] Backup completato: ${BACKUP_FILE}"

# Pulisci i backup vecchi
echo "[$(date)] Rimozione dei backup antecedenti a ${RETENTION_DAYS} giorni..."
find "${BACKUP_DIR}" -type f -name "bite_db_*.sql.gz" -mtime +${RETENTION_DAYS} -exec rm -f {} \;

echo "[$(date)] Operazione terminata con successo."
