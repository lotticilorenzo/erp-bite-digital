#!/usr/bin/env python3
"""
Crea l'utente ADMIN iniziale se non esiste.

Variabili richieste:
  BOOTSTRAP_ADMIN_EMAIL
  BOOTSTRAP_ADMIN_PASSWORD

Variabili opzionali:
  BOOTSTRAP_ADMIN_NOME (default: Admin)
  BOOTSTRAP_ADMIN_COGNOME (default: ERP)
"""

from __future__ import annotations

import asyncio
import os

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.models import User, UserRole


async def main() -> None:
    email = os.getenv("BOOTSTRAP_ADMIN_EMAIL", "").strip().lower()
    password = os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "").strip()
    nome = os.getenv("BOOTSTRAP_ADMIN_NOME", "Admin").strip() or "Admin"
    cognome = os.getenv("BOOTSTRAP_ADMIN_COGNOME", "ERP").strip() or "ERP"

    if not email or not password:
        raise SystemExit("Imposta BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD")

    async with AsyncSessionLocal() as db:
        existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if existing:
            print(f"Utente già presente: {email}")
            return

        user = User(
            nome=nome,
            cognome=cognome,
            email=email,
            password_hash=hash_password(password),
            ruolo=UserRole.ADMIN,
            attivo=True,
        )
        db.add(user)
        await db.commit()
        print(f"Creato ADMIN: {email}")


if __name__ == "__main__":
    asyncio.run(main())
