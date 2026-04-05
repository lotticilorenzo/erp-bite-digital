import asyncio
import uuid
from sqlalchemy import text
from app.db.session import SessionLocal

async def main():
    db = SessionLocal()
    try:
        print("Creazione tabelle budget...")
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS budget_categorie (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                nome VARCHAR(100) UNIQUE NOT NULL,
                colore VARCHAR(20) DEFAULT '#7c3aed',
                created_at TIMESTAMP DEFAULT NOW()
            );
        """))
        
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS budget_mensile (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                categoria_id UUID REFERENCES budget_categorie(id) ON DELETE CASCADE,
                mese_competenza DATE NOT NULL,
                importo_budget NUMERIC(10,2) NOT NULL,
                note TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(categoria_id, mese_competenza)
            );
        """))
        
        # Seed default categories
        categories = [
            ("Marketing", "#ec4899"),
            ("Software", "#3b82f6"),
            ("Struttura", "#64748b"),
            ("Consulenza", "#8b5cf6"),
            ("Freelancer", "#f59e0b"),
            ("Altro", "#94a3b8")
        ]
        
        for nome, colore in categories:
            await db.execute(text("""
                INSERT INTO budget_categorie (nome, colore)
                VALUES (:nome, :colore)
                ON CONFLICT (nome) DO NOTHING
            """), {"nome": nome, "colore": colore})
            
        await db.commit()
        print("Tabelle create e categorie popolate con successo!")
    except Exception as e:
        print(f"Errore durante la creazione delle tabelle: {e}")
        await db.rollback()
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(main())
