import asyncio
import os
import sys

# Aggiungi la root del progetto al path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import AsyncSessionLocal
from app.models.models import User
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as db:
        try:
            res = await db.execute(select(User))
            users = res.scalars().all()
            print(f"\n--- DATABASE CHECK ---")
            print(f"TOTAL USERS: {len(users)}")
            for u in users:
                print(f"ID: {u.id} | Email: {u.email} | Nome: {u.nome} {u.cognome} | Ruolo: {u.ruolo} | Attivo: {u.attivo}")
            print("--------------------\n")
        except Exception as e:
            print(f"ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(check())
