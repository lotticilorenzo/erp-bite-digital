#!/usr/bin/env python3
"""
Inizializza lo schema PostgreSQL eseguendo backend/schema.sql in modo idempotente.

Strategia:
- prende un advisory lock per evitare race condition;
- se lo schema e gia completo, esce senza modifiche;
- se non ci sono tabelle core, applica schema.sql;
- se rileva schema parziale, fallisce esplicitamente.

Uso:
  DATABASE_URL=... python scripts/init_db.py
"""

from __future__ import annotations

import os
from pathlib import Path

import psycopg2

LOCK_KEY = "bite_erp_init_schema_v1"
CORE_TABLES = (
    "users",
    "clienti",
    "progetti",
    "commesse",
    "commessa_progetti",
    "tasks",
    "timesheet",
    "costi",
    "fatture",
    "fornitori",
    "fatture_attive",
    "fatture_passive",
    "fic_sync_runs",
    "audit_log",
)


def to_sync_postgres_url(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql://", 1)
    if url.startswith("postgres+asyncpg://"):
        return url.replace("postgres+asyncpg://", "postgres://", 1)
    return url


def fetch_existing_core_tables(cur) -> set[str]:
    cur.execute(
        """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY(%s)
        """,
        (list(CORE_TABLES),),
    )
    return {row[0] for row in cur.fetchall()}


def main() -> None:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise SystemExit("DATABASE_URL non impostata")

    schema_path = Path(__file__).resolve().parents[1] / "schema.sql"
    schema_sql = schema_path.read_text(encoding="utf-8")

    conn = psycopg2.connect(to_sync_postgres_url(database_url))
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT pg_advisory_lock(hashtext(%s))", (LOCK_KEY,))
            existing = fetch_existing_core_tables(cur)

            if not existing:
                cur.execute(schema_sql)
                print("Schema inizializzato con successo.")
                return

            missing = [table for table in CORE_TABLES if table not in existing]
            if missing:
                raise SystemExit(
                    "Schema parziale rilevato. Tabelle mancanti: "
                    + ", ".join(missing)
                    + ". Interrompo per sicurezza."
                )

            print("Schema gia presente, nessuna modifica.")
    finally:
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT pg_advisory_unlock(hashtext(%s))", (LOCK_KEY,))
        except Exception:
            pass
        conn.close()


if __name__ == "__main__":
    main()
