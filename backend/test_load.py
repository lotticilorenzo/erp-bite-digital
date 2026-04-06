
import asyncio
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.models import Task, User, Progetto, Commessa
from app.core.config import settings

async def test():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        print("--- Testing Task Load ---")
        try:
            result = await session.execute(select(Task).limit(1))
            task = result.scalar_one_or_none()
            if task:
                print(f"Task: {task.id} - {task.titolo}")
                print(f"Timer sessions count: {len(task.timer_sessions)}")
                print(f"Tempo trascorso: {task.tempo_trascorso_minuti}")
            else:
                print("No tasks found")
        except Exception as e:
            print(f"Task Error: {e}")
            import traceback
            traceback.print_exc()

        print("\n--- Testing Progetto Load ---")
        try:
            result = await session.execute(select(Progetto).limit(1))
            proj = result.scalar_one_or_none()
            if proj:
                print(f"Progetto: {proj.id} - {proj.nome}")
            else:
                print("No progetti found")
        except Exception as e:
            print(f"Progetto Error: {e}")
            import traceback
            traceback.print_exc()

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test())
