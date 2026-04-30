#!/usr/bin/env python3
"""
Applica le migrazioni SQL versionate presenti in backend/migrations.

Strategia:
- advisory lock per evitare esecuzioni concorrenti;
- tabella schema_migrations per tracciare versioni e checksum applicati;
- esecuzione ordinata in base al nome file;
- stop esplicito se un file gia applicato cambia checksum.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path

import psycopg2

if __package__:
    from ._schema_tools import (
        build_database_connection_error,
        load_database_url,
        normalize_async_database_url,
    )
else:
    from _schema_tools import (
        build_database_connection_error,
        load_database_url,
        normalize_async_database_url,
    )

LOCK_KEY = "bite_erp_schema_migrations_v1"


@dataclass(frozen=True)
class MigrationFile:
    version: str
    name: str
    path: Path
    checksum: str


def _backend_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def migrations_dir() -> Path:
    return _backend_dir() / "migrations"


def compute_checksum(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def discover_migration_files(directory: Path | None = None) -> list[MigrationFile]:
    base_dir = directory or migrations_dir()
    migration_files: list[MigrationFile] = []

    if not base_dir.exists():
        return migration_files

    for path in sorted(base_dir.glob("*.sql")):
        migration_files.append(
            MigrationFile(
                version=path.stem,
                name=path.name,
                path=path,
                checksum=compute_checksum(path),
            )
        )

    return migration_files


def ensure_schema_migrations_table(cur) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            checksum VARCHAR(64) NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )


def fetch_applied_migrations(cur) -> dict[str, str]:
    cur.execute("SELECT version, checksum FROM schema_migrations")
    return {version: checksum for version, checksum in cur.fetchall()}


def validate_applied_migrations(
    applied_versions: dict[str, str],
    migration_files: list[MigrationFile],
) -> None:
    for migration in migration_files:
        applied_checksum = applied_versions.get(migration.version)
        if applied_checksum and applied_checksum != migration.checksum:
            raise SystemExit(
                "Checksum migrazione non coerente per "
                f"{migration.name}. Il file risulta modificato dopo l'applicazione."
            )


def apply_pending_migrations(cur, migration_files: list[MigrationFile]) -> int:
    applied_versions = fetch_applied_migrations(cur)
    validate_applied_migrations(applied_versions, migration_files)

    applied_count = 0
    for migration in migration_files:
        if migration.version in applied_versions:
            continue

        sql = migration.path.read_text(encoding="utf-8")
        if sql.strip():
            cur.execute(sql)

        cur.execute(
            """
            INSERT INTO schema_migrations (version, name, checksum)
            VALUES (%s, %s, %s)
            """,
            (migration.version, migration.name, migration.checksum),
        )
        applied_count += 1
        print(f"Applicata migrazione: {migration.name}")

    return applied_count


def main() -> None:
    database_url, source = load_database_url()
    migration_files = discover_migration_files()

    try:
        conn = psycopg2.connect(normalize_async_database_url(database_url))
    except Exception as exc:
        raise SystemExit(build_database_connection_error(exc, source)) from exc

    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT pg_advisory_lock(hashtext(%s))", (LOCK_KEY,))
            ensure_schema_migrations_table(cur)
            applied_count = apply_pending_migrations(cur, migration_files)
            conn.commit()
            print(
                "Migrazioni completate. "
                f"Nuove applicazioni: {applied_count}. "
                f"Totale file rilevati: {len(migration_files)}."
            )
    except Exception:
        conn.rollback()
        raise
    finally:
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT pg_advisory_unlock(hashtext(%s))", (LOCK_KEY,))
            conn.commit()
        except Exception:
            conn.rollback()
        conn.close()


if __name__ == "__main__":
    main()
