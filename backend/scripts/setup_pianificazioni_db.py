import asyncio
import uuid
from sqlalchemy import text
from app.db.session import engine

async def setup_db():
    async with engine.begin() as conn:
        # Create Enums if they don't exist
        await conn.execute(text("""
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_start_day_type') THEN
                    CREATE TYPE client_start_day_type AS ENUM ('STANDARD_1', 'CROSS_15');
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pianificazione_status') THEN
                    CREATE TYPE pianificazione_status AS ENUM ('PENDING', 'ACCEPTED', 'CONVERTED');
                END IF;
            END $$;
        """))

        # Add columns to existing tables
        await conn.execute(text("""
            ALTER TABLE clienti 
            ADD COLUMN IF NOT EXISTS start_day_type client_start_day_type DEFAULT 'STANDARD_1';
        """))
        
        await conn.execute(text("""
            ALTER TABLE commesse 
            ADD COLUMN IF NOT EXISTS pianificazione_id UUID;
        """))

        # Create new tables
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS pianificazioni (
                id UUID PRIMARY KEY,
                cliente_id UUID NOT NULL REFERENCES clienti(id),
                budget NUMERIC(10, 2) DEFAULT 0,
                stato pianificazione_status DEFAULT 'PENDING',
                note TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """))

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS pianificazione_lavorazioni (
                id UUID PRIMARY KEY,
                pianificazione_id UUID NOT NULL REFERENCES pianificazioni(id) ON DELETE CASCADE,
                tipo_lavorazione VARCHAR(255) NOT NULL,
                user_id UUID NOT NULL REFERENCES users(id),
                ore_previste NUMERIC(12, 2) DEFAULT 0,
                costo_orario_snapshot NUMERIC(10, 2) DEFAULT 0
            );
        """))

        # Add foreign key constraint to commesse if not exists
        await conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'fk_commesse_pianificazione'
                ) THEN
                    ALTER TABLE commesse 
                    ADD CONSTRAINT fk_commesse_pianificazione 
                    FOREIGN KEY (pianificazione_id) REFERENCES pianificazioni(id);
                END IF;
            END $$;
        """))

        print("Schema update completed successfully.")

if __name__ == "__main__":
    asyncio.run(setup_db())
