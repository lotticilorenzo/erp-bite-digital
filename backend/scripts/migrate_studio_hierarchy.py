import asyncio
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.models import Cliente, Progetto, StudioNode, StudioNodeType

async def migrate():
    async with SessionLocal() as db:
        # 1. Clear existing nodes to avoid duplicates during testing
        await db.execute(select(StudioNode))
        # (Optional: delete all if fresh start desired)
        
        # 2. Get all clients
        result = await db.execute(select(Cliente))
        clienti = result.scalars().all()
        
        print(f"Migrating {len(clienti)} clients...")
        
        for cliente in clienti:
            # Create a folder for the client (as a root node)
            client_node = StudioNode(
                nome=cliente.ragione_sociale,
                tipo=StudioNodeType.FOLDER,
                linked_progetto_id=None,
                is_private=False,
                order=0
                # We could link icon/color if clients had them
            )
            db.add(client_node)
            await db.flush() # Get client_node.id
            
            # Get all projects for this client
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
        
        await db.commit()
        print("Migration completed.")

if __name__ == "__main__":
    asyncio.run(migrate())
