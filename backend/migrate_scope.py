import asyncio
import os
import sys

# Aggiungi il percorso del backend al sys.path per importare l'app
sys.path.append(os.getcwd())

from app.db.session import engine
from sqlalchemy import text

async def migrate():
    async with engine.begin() as conn:
        print("Iniziando migrazione...")
        await conn.execute(text("ALTER TABLE commesse ADD COLUMN IF NOT EXISTS ore_contratto NUMERIC(8,2) DEFAULT 0;"))
        print("Colonna ore_contratto aggiunta con successo.")

if __name__ == "__main__":
    asyncio.run(migrate())
