
import asyncio
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.models import Timesheet, TimesheetStatus
from app.db.session import AsyncSessionLocal
from app.services.services import elimina_timesheet_bulk
from app.models.models import User, UserRole

async def test_delete():
    async with AsyncSessionLocal() as db:
        # Get a timesheet to delete
        from sqlalchemy import select
        res = await db.execute(select(Timesheet).limit(1))
        ts = res.scalar_one_or_none()
        if not ts:
            print("No timesheet found")
            return
        
        print(f"Found timesheet {ts.id} with status {ts.stato}")
        
        # Mock an admin user
        admin = User(ruolo=UserRole.ADMIN)
        
        # Test bulk delete
        try:
            result = await elimina_timesheet_bulk(db, [ts.id], admin)
            print(f"Delete result: {result}")
        except Exception as e:
            print(f"Delete failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_delete())
