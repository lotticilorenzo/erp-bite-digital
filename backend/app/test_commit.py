import sys
import os
sys.path.append(os.getcwd())

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import select, text
from app.models.models import Cliente
from app.schemas.schemas import ClienteOut, ClienteUpdate
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
import uuid
import json

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://bite:Bite_DB#Kp8mN2xQ7wR!v3@db:5432/bite_erp")

async def test_commit():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    client_id = uuid.UUID("4f42a076-c7b1-4fdc-8d1c-0c087d9e070f")
    
    result_data = {"success": False, "error": None}
    
    async with async_session() as session:
        try:
            result = await session.execute(select(Cliente).where(Cliente.id == client_id))
            c = result.scalar_one_or_none()
            if not c:
                result_data["error"] = "Client not found"
            else:
                print(f"Attempting to update client {c.ragione_sociale}...")
                c.google_drive_url = "https://drive.google.com/test_commit_" + str(uuid.uuid4())[:8]
                
                try:
                    await session.commit()
                    result_data["success"] = True
                    print("Commit successful!")
                except Exception as e:
                    result_data["error"] = str(e)
                    print(f"Commit failed: {e}")
        except Exception as ge:
            result_data["error"] = f"General error: {str(ge)}"
            
    with open("commit_result.json", "w") as f:
        json.dump(result_data, f, indent=2)
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_commit())
