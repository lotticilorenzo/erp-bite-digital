import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Credenziali tratte dal backend/.env
DATABASE_URL = "postgresql+asyncpg://bite:Bite_DB#Kp8mN2xQ7wR!v3@db:5432/bite_erp"

async def migrate():
    print("Connecting to database...")
    engine = create_async_engine(DATABASE_URL)
    
    async with engine.begin() as conn:
        print("Adding note column to progetto_team...")
        await conn.execute(text("ALTER TABLE progetto_team ADD COLUMN IF NOT EXISTS note TEXT;"))
        print("Migration completed!")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
