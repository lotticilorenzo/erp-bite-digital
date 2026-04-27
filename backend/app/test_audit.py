import sys
import os
sys.path.append(os.getcwd())

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import select, text
from app.models.models import Cliente, AuditLog
from app.schemas.schemas import ClienteOut, ClienteUpdate
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
import uuid
import json

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://bite:Bite_DB#Kp8mN2xQ7wR!v3@db:5432/bite_erp")

async def test_audit():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    user_id = uuid.UUID("30aa4d96-81e9-4490-9d50-8684658688d7") # Lorenzo
    client_id = uuid.UUID("4f42a076-c7b1-4fdc-8d1c-0c087d9e070f")
    
    result_data = {"success": False, "error": None}
    
    async with async_session() as session:
        try:
            print("Attempting to write audit log...")
            log = AuditLog(
                user_id=user_id,
                tabella="clienti",
                record_id=client_id,
                azione="UPDATE",
                dati_prima={"test": "prima"},
                dati_dopo={"test": "dopo"}
            )
            session.add(log)
            await session.commit()
            result_data["success"] = True
            print("Audit commit successful!")
        except Exception as e:
            result_data["error"] = str(e)
            print(f"Audit commit failed: {e}")
            if hasattr(e, 'orig'):
                print(f"Orig: {e.orig}")
            
    with open("audit_test_result.json", "w") as f:
        json.dump(result_data, f, indent=2)
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_audit())
