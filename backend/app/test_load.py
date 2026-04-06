
import asyncio
import uuid
import sys
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

# Aggiungi il path per trovare app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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
                print(f"Task found: {task.id} - {task.titolo}")
                print(f"Loading timer sessions...")
                # L'accesso a un attributo selectin carichera automaticamente se la sessione e aperta
                print(f"Timer sessions count: {len(task.timer_sessions)}")
                print(f"Tempo trascorso property: {task.tempo_trascorso_minuti}")
            else:
                print("No tasks found")
        except Exception as e:
            print(f"Task Error: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()

        print("\n--- Testing Progetto Load ---")
        try:
            result = await session.execute(select(Progetto).limit(1))
            proj = result.scalar_one_or_none()
            if proj:
                print(f"Progetto found: {proj.id} - {proj.nome}")
                print(f"Team count: {len(proj.team)}")
            else:
                print("No progetti found")
        except Exception as e:
            print(f"Progetto Error: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test())
