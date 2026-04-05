import asyncio
from sqlalchemy import text
from app.db.session import engine

async def create_tables():
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS preventivi (
              id UUID PRIMARY KEY,
              cliente_id UUID REFERENCES clienti(id),
              numero VARCHAR(50) NOT NULL,
              titolo VARCHAR(255) NOT NULL,
              descrizione TEXT,
              stato VARCHAR(20) DEFAULT 'BOZZA',
              data_creazione DATE DEFAULT CURRENT_DATE,
              data_scadenza DATE,
              data_accettazione DATE,
              importo_totale NUMERIC(10,2) DEFAULT 0,
              note TEXT,
              created_by UUID REFERENCES users(id),
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            );
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS preventivo_voci (
              id UUID PRIMARY KEY,
              preventivo_id UUID REFERENCES preventivi(id) 
                ON DELETE CASCADE,
              descrizione VARCHAR(500) NOT NULL,
              quantita NUMERIC(8,2) DEFAULT 1,
              prezzo_unitario NUMERIC(10,2) DEFAULT 0,
              totale NUMERIC(10,2) DEFAULT 0,
              ordine INTEGER DEFAULT 0
            );
        """))
        print("Tabelle preventivi create con successo.")

if __name__ == "__main__":
    asyncio.run(create_tables())
