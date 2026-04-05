import asyncio
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/erp_db")

async def migrate():
    engine = create_async_engine(DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        # Create wiki_categorie
        await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS wiki_categorie (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            nome VARCHAR(100) NOT NULL,
            icona VARCHAR(50),
            ordine INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """))

        # Create wiki_articoli
        await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS wiki_articoli (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            categoria_id UUID REFERENCES wiki_categorie(id) ON DELETE CASCADE,
            titolo VARCHAR(255) NOT NULL,
            contenuto TEXT,
            autore_id UUID REFERENCES users(id),
            ultimo_aggiornamento TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            pubblicato BOOLEAN DEFAULT true,
            visualizzazioni INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """))

    print("Wiki tables created successfully.")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
