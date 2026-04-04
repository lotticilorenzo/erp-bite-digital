import asyncio
from sqlalchemy import text
from app.db.session import engine

async def migrate():
    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);"))
        print("Migration completed: added avatar_url to users table.")

if __name__ == "__main__":
    asyncio.run(migrate())
