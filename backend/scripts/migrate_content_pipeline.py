#!/usr/bin/env python3
"""
Applica la migrazione schema per content pipeline e task templates in modo idempotente.

Strategia:
- prende un advisory lock per evitare esecuzioni concorrenti;
- esegue un file SQL esplicito e tracciabile;
- non cancella dati e usa solo CREATE/ALTER non distruttivi.

Uso:
  python scripts/migrate_content_pipeline.py
  DATABASE_URL=... python scripts/migrate_content_pipeline.py

Se DATABASE_URL non e gia impostata, lo script prova a leggerla da `.env`
in root repo e poi da `backend/.env`.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

try:
    import asyncpg
except ModuleNotFoundError as exc:  # pragma: no cover - dipende dall'ambiente
    raise SystemExit(
        "asyncpg non disponibile nell'ambiente corrente. "
        "Esegui questo script nel venv backend corretto oppure nel container backend."
    ) from exc

from _schema_tools import (
    build_database_connection_error,
    load_database_url,
    normalize_async_database_url,
)

LOCK_KEY = "bite_erp_migrate_content_pipeline_v1"


async def main() -> None:
    database_url, database_url_source = load_database_url()
    async_url = normalize_async_database_url(database_url)
    if not async_url.startswith("postgresql://"):
        raise SystemExit("Questa migrazione supporta solo PostgreSQL")

    sql_path = Path(__file__).resolve().parents[1] / "migrations" / "20260416_content_pipeline.sql"
    migration_sql = sql_path.read_text(encoding="utf-8")

    try:
        conn = await asyncpg.connect(async_url)
    except Exception as exc:
        raise SystemExit(build_database_connection_error(exc, database_url_source)) from exc
    try:
        await conn.execute("SELECT pg_advisory_lock(hashtext($1))", LOCK_KEY)
        await conn.execute(migration_sql)
        print("Migrazione content pipeline applicata con successo.")
    finally:
        try:
            await conn.execute("SELECT pg_advisory_unlock(hashtext($1))", LOCK_KEY)
        except Exception:
            pass
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
