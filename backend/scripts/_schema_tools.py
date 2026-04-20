from __future__ import annotations

import os
from pathlib import Path


def normalize_async_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql://", 1)
    return url


def load_database_url() -> tuple[str, str]:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url:
        return database_url, "variabile d'ambiente"

    for env_path in _candidate_env_files():
        database_url = _read_database_url_from_env_file(env_path)
        if database_url:
            return database_url, str(env_path)

    checked_paths = ", ".join(str(path) for path in _candidate_env_files())
    raise SystemExit(
        "DATABASE_URL non impostata. "
        f"Nessun valore trovato in ambiente o nei file: {checked_paths}"
    )


def build_database_connection_error(exc: Exception, source: str) -> str:
    return (
        "Impossibile connettersi al database. "
        f"Fonte DATABASE_URL: {source}. "
        "Verifica che PostgreSQL o Docker siano avviati e che l'host indicato sia raggiungibile. "
        f"Dettaglio: {type(exc).__name__}: {exc}"
    )


def _candidate_env_files() -> tuple[Path, Path]:
    scripts_dir = Path(__file__).resolve().parent
    backend_dir = scripts_dir.parent
    repo_dir = backend_dir.parent
    return (
        repo_dir / ".env",
        backend_dir / ".env",
    )


def _read_database_url_from_env_file(env_path: Path) -> str:
    if not env_path.exists():
        return ""

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.strip() != "DATABASE_URL":
            continue
        cleaned = value.strip()
        if len(cleaned) >= 2 and cleaned[0] == cleaned[-1] and cleaned[0] in {'"', "'"}:
            cleaned = cleaned[1:-1]
        return cleaned.strip()

    return ""
