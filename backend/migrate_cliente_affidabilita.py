import asyncio

from sqlalchemy import text

from app.db.session import engine


async def migrate():
    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                ALTER TABLE clienti
                ADD COLUMN IF NOT EXISTS affidabilita VARCHAR(10);
                """
            )
        )
        await conn.execute(
            text(
                """
                UPDATE clienti
                SET affidabilita = 'MEDIA'
                WHERE affidabilita IS NULL;
                """
            )
        )
        await conn.execute(
            text(
                """
                ALTER TABLE clienti
                ALTER COLUMN affidabilita SET DEFAULT 'MEDIA';
                """
            )
        )
        print("Migration completed: added affidabilita to clienti table.")


if __name__ == "__main__":
    asyncio.run(migrate())
