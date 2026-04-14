import asyncio
import uuid
from sqlalchemy import select, delete
from app.db.session import AsyncSessionLocal
from app.models.models import Cliente, Progetto, Task, StudioNode, StudioNodeType

async def run_migration():
    async with AsyncSessionLocal() as db:
        print("--- Avvio Migrazione Interna ---")
        
        # 1. Pulizia nodi esistenti
        await db.execute(delete(StudioNode))
        print("Nodi esistenti rimossi.")
        
        # 2. Migrazione Clienti
        result = await db.execute(select(Cliente))
        clienti = result.scalars().all()
        print(f"Migrazione di {len(clienti)} clienti...")
        
        for cliente in clienti:
            client_node = StudioNode(
                nome=cliente.ragione_sociale,
                tipo=StudioNodeType.FOLDER,
                is_private=False,
                order=0
            )
            db.add(client_node)
            await db.flush()
            
            # 3. Migrazione Progetti
            res_p = await db.execute(select(Progetto).where(Progetto.cliente_id == cliente.id))
            progetti = res_p.scalars().all()
            
            for p in progetti:
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
                
                # 4. Migrazione Task
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
        print("--- Migrazione Completata con Successo ---")

if __name__ == "__main__":
    asyncio.run(run_migration())
