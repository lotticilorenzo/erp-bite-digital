import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://bite:Bite_DB#Kp8mN2xQ7wR!v3@db:5432/bite_erp")

async def migrate():
    print(f"Connecting to database...")
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        print("Adding columns to progetti...")
        await conn.execute(text("ALTER TABLE progetti ADD COLUMN IF NOT EXISTS data_inizio DATE"))
        await conn.execute(text("ALTER TABLE progetti ADD COLUMN IF NOT EXISTS data_fine DATE"))
        
        print("Adding columns to progetto_team...")
        await conn.execute(text("ALTER TABLE progetto_team ADD COLUMN IF NOT EXISTS ore_previste FLOAT DEFAULT 0"))
        
        print("Migration completed!")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
