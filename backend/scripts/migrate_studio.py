import asyncio
import os
import sys
import uuid
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add the app directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.models.models import Base, Cliente, Progetto, Task, StudioNode, StudioNodeType

async def run_migration():
    # Load DATABASE_URL from environment or use default
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://bite:bite_secret@localhost:5432/bite_erp")
    
    engine = create_async_engine(DATABASE_URL, echo=True)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as db:
        print("--- Starting Migration ---")
        
        # 1. Clear existing nodes
        await db.execute(delete(StudioNode))
        print("Existing StudioNodes cleared.")
        
        # 2. Get all clients
        result = await db.execute(select(Cliente))
        clienti = result.scalars().all()
        print(f"Found {len(clienti)} clients.")
        
        for cliente in clienti:
            print(f"Migrating Client: {cliente.ragione_sociale}")
            client_node = StudioNode(
                nome=cliente.ragione_sociale,
                tipo=StudioNodeType.FOLDER,
                is_private=False,
                order=0
            )
            db.add(client_node)
            await db.flush()
            
            res_p = await db.execute(select(Progetto).where(Progetto.cliente_id == cliente.id))
            progetti = res_p.scalars().all()
            
            for p in progetti:
                print(f"  Migrating Project: {p.nome}")
                project_node = StudioNode(
                    nome=p.nome,
                    parent_id=client_node.id,
                    tipo=StudioNodeType.PROJECT,
                    linked_progetto_id=p.id,
                    is_private=False,
                    order=0
                )
                db.add(project_node)
                await db.flush()
                
                # Migrate tasks
                res_t = await db.execute(select(Task).where(Task.progetto_id == p.id))
                tasks = res_t.scalars().all()
                for t in tasks:
                    task_node = StudioNode(
                        nome=t.titolo,
                        parent_id=project_node.id,
                        tipo=StudioNodeType.TASK,
                        linked_task_id=t.id,
                        is_private=False,
                        order=0
                    )
                    db.add(task_node)
        
        await db.commit()
        print("--- Migration Completed Successfully ---")

if __name__ == "__main__":
    asyncio.run(run_migration())
