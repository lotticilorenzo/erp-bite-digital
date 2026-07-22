#!/usr/bin/env python3
"""
Crea le tabelle ORM-only assenti da schema.sql/migrations (debito noto: 27 tabelle + colonne
solo-ORM, es. tasks.parent_id) PRIMA delle migrazioni versionate, cosi' un virgin-build (docker
compose down -v && up) parte pulito com'era nato l'ambiente di produzione.

GATE DI SICUREZZA: gira SOLO al primo boot, cioe' se `schema_migrations` non esiste o e' vuota.
Su un DB gia' migrato (produzione, o locale gia' avviato) quella tabella ha sempre righe -> questo
script esce senza toccare nulla. Base.metadata.create_all è comunque idempotente (CREATE TABLE
IF NOT EXISTS via inspector) per un secondo strato di sicurezza.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # /app — per import di app.*

import re

import psycopg2
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.dialects import postgresql

LOCK_KEY = "bite_erp_create_orm_tables_v1"

_CREATE_TABLE_RE = re.compile(r'CREATE TABLE(?: IF NOT EXISTS)?\s+"?(\w+)"?', re.IGNORECASE)


def tabelle_gia_gestite_dalle_migration() -> set[str]:
    """Tabelle che una migration crea gia' di suo (CREATE TABLE IF NOT EXISTS con i propri
    default/constraint server-side, es. parametri.id DEFAULT uuid_generate_v4()). Vanno
    ESCLUSE da create_all: se le pre-creo io con lo schema ORM (default solo client-side),
    la CREATE TABLE IF NOT EXISTS della migration diventa un no-op e perde il suo DEFAULT,
    rompendo i seed INSERT che contano su quel default (visto con 'parametri')."""
    migrations_dir = Path(__file__).resolve().parents[1] / "migrations"
    tabelle = set()
    for f in migrations_dir.glob("*.sql"):
        tabelle.update(_CREATE_TABLE_RE.findall(f.read_text(encoding="utf-8")))
    return tabelle


def to_sync_postgres_url(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql://", 1)
    if url.startswith("postgres+asyncpg://"):
        return url.replace("postgres+asyncpg://", "postgres://", 1)
    return url


def is_first_boot(cur) -> bool:
    cur.execute(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name='schema_migrations')"
    )
    if not cur.fetchone()[0]:
        return True
    cur.execute("SELECT COUNT(*) FROM schema_migrations")
    return cur.fetchone()[0] == 0


def main() -> None:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise SystemExit("DATABASE_URL non impostata")
    sync_url = to_sync_postgres_url(database_url)

    conn = psycopg2.connect(sync_url)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT pg_advisory_lock(hashtext(%s))", (LOCK_KEY,))
            try:
                if not is_first_boot(cur):
                    print("DB gia' migrato: skip create_all (nessun rischio drift su prod/locale esistente).")
                    return

                from app.models.base import Base
                import app.models.models  # noqa: F401 — registra tutti i model sul metadata

                gestite_da_migration = tabelle_gia_gestite_dalle_migration()

                engine = create_engine(sync_url)
                inspector_before = inspect(engine)
                existing_tables_before = set(inspector_before.get_table_names())
                existing_columns_before = {
                    t: {c["name"] for c in inspector_before.get_columns(t)} for t in existing_tables_before
                }

                da_creare = [
                    t for t in Base.metadata.sorted_tables
                    if t.name not in existing_tables_before and t.name not in gestite_da_migration
                ]
                if da_creare:
                    Base.metadata.create_all(engine, checkfirst=True, tables=da_creare)
                print(f"Tabelle ORM mancanti create: {len(da_creare)} (escluse {len(gestite_da_migration)} gia' gestite dalle migration).")

                # Colonne solo-ORM su tabelle GIA' esistenti (es. tasks.parent_id): create_all
                # non altera tabelle esistenti, quindi le aggiungiamo esplicitamente. Solo tipo
                # (no FK/constraint): basta perche' le migration successive vi si appoggiano
                # (es. indice su tasks.parent_id) senza richiedere integrita' referenziale qui.
                added_cols = 0
                with engine.begin() as conn:
                    for table in Base.metadata.sorted_tables:
                        if table.name not in existing_tables_before:
                            continue  # tabella nuova: create_all l'ha gia' fatta completa
                        if table.name in gestite_da_migration:
                            continue  # la sua migration gestisce le proprie colonne/default
                        cols_db = existing_columns_before[table.name]
                        for col in table.columns:
                            if col.name in cols_db:
                                continue
                            ddl_type = col.type.compile(dialect=postgresql.dialect())
                            conn.execute(text(
                                f'ALTER TABLE "{table.name}" ADD COLUMN IF NOT EXISTS "{col.name}" {ddl_type}'
                            ))
                            added_cols += 1
                            print(f"  + colonna {table.name}.{col.name} ({ddl_type})")
                engine.dispose()
                print(f"Tabelle ORM create (virgin-build, primo boot). Colonne ORM-only aggiunte: {added_cols}.")
            finally:
                cur.execute("SELECT pg_advisory_unlock(hashtext(%s))", (LOCK_KEY,))
    finally:
        conn.close()


if __name__ == "__main__":
    main()
