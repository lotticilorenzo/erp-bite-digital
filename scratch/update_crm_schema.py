import asyncio
import os
import sys
from sqlalchemy import text

# Add backend to path
backend_path = os.path.join(os.getcwd(), "backend")
sys.path.append(backend_path)

from app.db.session import async_session

async def add_missing_columns():
    async with async_session() as session:
        try:
            # Add columns to crm_lead
            print("Adding columns to crm_lead...")
            await session.execute(text("ALTER TABLE crm_lead ADD COLUMN IF NOT EXISTS sito_web VARCHAR(255)"))
            await session.execute(text("ALTER TABLE crm_lead ADD COLUMN IF NOT EXISTS settore VARCHAR(100)"))
            await session.execute(text("ALTER TABLE crm_lead ADD COLUMN IF NOT EXISTS dimensione_azienda VARCHAR(50)"))
            await session.execute(text("ALTER TABLE crm_lead ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0"))
            
            # Add columns to crm_attivita
            print("Adding columns to crm_attivita...")
            await session.execute(text("ALTER TABLE crm_attivita ADD COLUMN IF NOT EXISTS metadata JSONB"))
            
            await session.commit()
            print("Database columns added successfully.")
        except Exception as e:
            await session.rollback()
            print(f"Error updating database: {e}")

if __name__ == "__main__":
    asyncio.run(add_missing_columns())
