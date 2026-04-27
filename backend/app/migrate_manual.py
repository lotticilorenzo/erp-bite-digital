import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://bite:Bite_DB#Kp8mN2xQ7wR!v3@db:5432/bite_erp")

async def migrate():
    print(f"Connecting to database...")
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        print("Checking/Adding columns to clienti...")
        # Google Drive URL
        await conn.execute(text("ALTER TABLE clienti ADD COLUMN IF NOT EXISTS google_drive_url VARCHAR(500)"))
        
        # Start Day Type (per la pianificazione)
        try:
            # PostgreSQL Enum check/creation is complex, but we can just use VARCHAR for the column
            await conn.execute(text("ALTER TABLE clienti ADD COLUMN IF NOT EXISTS start_day_type VARCHAR(50)"))
        except Exception as e:
            print(f"Warning adding start_day_type: {e}")

        # Logo URL (caso mai mancasse)
        await conn.execute(text("ALTER TABLE clienti ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500)"))
        
        # Affidabilita (caso mai mancasse)
        await conn.execute(text("ALTER TABLE clienti ADD COLUMN IF NOT EXISTS affidabilita VARCHAR(20)"))

        print("Done!")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
