#!/usr/bin/env python3
"""
Verifica in sola lettura se lo schema content pipeline e task templates e presente.

Non modifica nulla nel database.
Restituisce exit code 0 se tutto e presente, 1 se mancano elementi.

Uso:
  python scripts/check_content_pipeline_schema.py
  DATABASE_URL=... python scripts/check_content_pipeline_schema.py

Se DATABASE_URL non e gia impostata, lo script prova a leggerla da `.env`
in root repo e poi da `backend/.env`.
"""

from __future__ import annotations

import asyncio
from typing import Iterable

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


EXPECTED_ENUMS: dict[str, list[str]] = {
    "user_role": ["DEVELOPER", "COLLABORATORE"],
    "contenuto_status": [
        "BOZZA",
        "IN_REVISIONE_INTERNA",
        "MODIFICHE_RICHIESTE_INTERNE",
        "APPROVATO_INTERNAMENTE",
        "INVIATO_AL_CLIENTE",
        "MODIFICHE_RICHIESTE_CLIENTE",
        "APPROVATO_CLIENTE",
        "PUBBLICATO",
        "ARCHIVIATO",
    ],
    "contenuto_tipo": [
        "POST_SOCIAL",
        "COPY",
        "DESIGN",
        "VIDEO",
        "EMAIL",
        "ALTRO",
    ],
}

EXPECTED_TABLE_COLUMNS: dict[str, list[str]] = {
    "task_templates": [
        "id",
        "nome",
        "descrizione",
        "progetto_tipo",
        "attivo",
        "created_by",
        "created_at",
        "updated_at",
    ],
    "task_template_items": [
        "id",
        "template_id",
        "titolo",
        "descrizione",
        "servizio",
        "stima_minuti",
        "priorita",
        "giorno_scadenza",
        "assegnatario_ruolo",
        "ordine",
    ],
    "contenuti": [
        "id",
        "titolo",
        "tipo",
        "stato",
        "commessa_id",
        "progetto_id",
        "assegnatario_id",
        "data_consegna_prevista",
        "url_preview",
        "testo",
        "note_revisione",
        "approvato_da",
        "approvato_at",
        "pubblicato_at",
        "created_at",
        "updated_at",
    ],
    "contenuto_eventi": [
        "id",
        "contenuto_id",
        "autore_id",
        "stato_precedente",
        "stato_nuovo",
        "nota",
        "created_at",
    ],
}

EXPECTED_INDEXES = [
    "idx_task_template_items_template_id",
    "idx_contenuti_stato",
    "idx_contenuti_commessa_id",
    "idx_contenuti_progetto_id",
    "idx_contenuti_assegnatario_id",
    "idx_contenuti_created_at",
    "idx_contenuto_eventi_contenuto_id",
    "idx_contenuto_eventi_created_at",
]
async def fetch_enum_labels(conn: asyncpg.Connection, enum_name: str) -> list[str]:
    rows = await conn.fetch(
        """
        SELECT e.enumlabel
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = $1
        ORDER BY e.enumsortorder
        """,
        enum_name,
    )
    return [row["enumlabel"] for row in rows]


async def fetch_table_columns(conn: asyncpg.Connection, table_name: str) -> list[str]:
    rows = await conn.fetch(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
        ORDER BY ordinal_position
        """,
        table_name,
    )
    return [row["column_name"] for row in rows]


async def fetch_indexes(conn: asyncpg.Connection, table_names: Iterable[str]) -> set[str]:
    rows = await conn.fetch(
        """
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = ANY($1::text[])
        """,
        list(table_names),
    )
    return {row["indexname"] for row in rows}


async def main() -> int:
    database_url, database_url_source = load_database_url()
    async_url = normalize_async_database_url(database_url)
    if not async_url.startswith("postgresql://"):
        raise SystemExit("Questo check supporta solo PostgreSQL")

    issues: list[str] = []

    try:
        conn = await asyncpg.connect(async_url)
    except Exception as exc:
        raise SystemExit(build_database_connection_error(exc, database_url_source)) from exc
    try:
        for enum_name, expected_labels in EXPECTED_ENUMS.items():
            labels = await fetch_enum_labels(conn, enum_name)
            if not labels:
                issues.append(f"Enum mancante: {enum_name}")
                continue
            missing_labels = [label for label in expected_labels if label not in labels]
            for label in missing_labels:
                issues.append(f"Valore enum mancante: {enum_name}.{label}")

        for table_name, expected_columns in EXPECTED_TABLE_COLUMNS.items():
            columns = await fetch_table_columns(conn, table_name)
            if not columns:
                issues.append(f"Tabella mancante: {table_name}")
                continue
            missing_columns = [column for column in expected_columns if column not in columns]
            for column in missing_columns:
                issues.append(f"Colonna mancante: {table_name}.{column}")

        indexes = await fetch_indexes(conn, EXPECTED_TABLE_COLUMNS.keys())
        for index_name in EXPECTED_INDEXES:
            if index_name not in indexes:
                issues.append(f"Indice mancante: {index_name}")
    finally:
        await conn.close()

    if issues:
        print("Schema content pipeline NON completo.")
        for issue in issues:
            print(f"- {issue}")
        return 1

    print("Schema content pipeline completo.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
