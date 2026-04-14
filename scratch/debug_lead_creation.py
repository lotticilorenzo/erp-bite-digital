import asyncio
import uuid
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.db.base import get_db
from app.models.models import CRMLead, CRMStage
from sqlalchemy import select

async def test_create_lead():
    async for db in get_db():
        # Get first stage
        res = await db.execute(select(CRMStage))
        stage = res.scalars().first()
        if not stage:
            print("No stages found")
            return
        
        try:
            lead = CRMLead(nome_azienda="Test Lead", stadio_id=stage.id)
            db.add(lead)
            await db.commit()
            print("Lead created successfully")
        except Exception as e:
            print(f"Error creating lead: {e}")
        break

if __name__ == "__main__":
    asyncio.run(test_create_lead())
