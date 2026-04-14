from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from typing import List, Optional
import uuid

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.models import User, StudioNode, StudioNodeType, UserRole, Cliente, Progetto, TaskComment
from app.schemas.schemas import StudioNodeCreate, StudioNodeUpdate, StudioNodeOut
from datetime import datetime
import uuid as _uuid

router = APIRouter(prefix="/studio", tags=["Studio Workspace"])

# ═══════════════════════════════════════
# TASK COMMENTS
# ═══════════════════════════════════════

@router.get("/tasks/{task_id}/comments")
async def get_task_comments(
    task_id: _uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from sqlalchemy.orm import joinedload
    stmt = (
        select(TaskComment)
        .where(TaskComment.task_id == task_id)
        .options(joinedload(TaskComment.autore))
        .order_by(TaskComment.created_at.asc())
    )
    res = await db.execute(stmt)
    comments = res.scalars().all()
    return [
        {
            "id": str(c.id),
            "task_id": str(c.task_id),
            "contenuto": c.contenuto,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
            "autore_id": str(c.autore_id),
            "autore_nome": f"{c.autore.nome} {c.autore.cognome}" if c.autore else "Anonimo",
            "autore_avatar": c.autore.avatar_url if c.autore else None,
        }
        for c in comments
    ]

@router.post("/tasks/{task_id}/comments", status_code=201)
async def create_task_comment(
    task_id: _uuid.UUID,
    contenuto: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    comment = TaskComment(
        task_id=task_id,
        autore_id=current_user.id,
        contenuto=contenuto,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return {
        "id": str(comment.id),
        "task_id": str(comment.task_id),
        "contenuto": comment.contenuto,
        "created_at": comment.created_at.isoformat(),
        "updated_at": comment.updated_at.isoformat(),
        "autore_id": str(comment.autore_id),
        "autore_nome": f"{current_user.nome} {current_user.cognome}",
        "autore_avatar": current_user.avatar_url if hasattr(current_user, 'avatar_url') else None,
    }

@router.delete("/tasks/{task_id}/comments/{comment_id}", status_code=204)
async def delete_task_comment(
    task_id: _uuid.UUID,
    comment_id: _uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    res = await db.execute(select(TaskComment).where(TaskComment.id == comment_id, TaskComment.task_id == task_id))
    c = res.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Commento non trovato")
    if c.autore_id != current_user.id and current_user.ruolo != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Non autorizzato")
    await db.delete(c)
    await db.commit()
    return None


@router.post("/migrate")
async def migrate_hierarchy(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.ruolo != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can migrate")

    # 1. Clear existing nodes
    await db.execute(delete(StudioNode))
    
    # 2. Get all clients
    result = await db.execute(select(Cliente))
    clienti = result.scalars().all()
    
    from app.models.models import Task
    
    for cliente in clienti:
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
            
            # Migrate tasks of this project as children of the project node
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
    return {"message": "Migration completed with tasks"}

@router.get("/hierarchy", response_model=List[StudioNodeOut])
async def get_studio_hierarchy(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Ritorna l'intera gerarchia visibile all'utente.
    Includere nodi pubblici e nodi privati dell'utente.
    """
    # 1. Load ALL nodes visible to the user at once to avoid lazy-loading recursion issues
    result = await db.execute(
        select(StudioNode)
        .where(
            (StudioNode.is_private == False) | (StudioNode.user_id == current_user.id)
        )
        .order_by(StudioNode.order)
    )
    all_nodes = result.scalars().all()
    
    # 2. Build a flat list of simple dictionaries to avoid ORM lazy-loading during serialization
    # Pydantic's from_attributes=True MUST BE BYPASSED for the children relationship
    node_dicts = []
    for node in all_nodes:
        n_dict = {
            "id": node.id,
            "nome": node.nome,
            "parent_id": node.parent_id,
            "tipo": node.tipo,
            "icon": node.icon,
            "color": node.color,
            "linked_progetto_id": node.linked_progetto_id,
            "linked_cliente_id": node.linked_cliente_id,
            "linked_task_id": node.linked_task_id,
            "is_private": node.is_private,
            "order": node.order,
            "user_id": node.user_id,
            "created_at": node.created_at,
            "updated_at": node.updated_at,
            "children": [] # We will populate this next
        }
        node_dicts.append(n_dict)
    
    # 3. Reconstruct tree structure in memory using the dictionaries
    node_map = {n["id"]: n for n in node_dicts}
    roots = []
    
    for n in node_dicts:
        parent_id = n["parent_id"]
        if parent_id is None:
            roots.append(n)
        elif parent_id in node_map:
            node_map[parent_id]["children"].append(n)
            
    # 4. Final validation of the root dictionaries against the Pydantic model
    # Since they are dicts, Pydantic won't try to read any ORM attributes.
    return [StudioNodeOut.model_validate(r) for r in roots]

@router.post("/nodes", response_model=StudioNodeOut, status_code=status.HTTP_201_CREATED)
async def create_studio_node(
    data: StudioNodeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only Admin can create shared folders? 
    # For now let everyone create nodes, but marked as private if not admin?
    # User requested: "preimpostatamente le cose sarebbero totali... in alcuni casi private"
    
    node = StudioNode(
        **data.model_dump(),
        user_id=current_user.id
    )
    db.add(node)
    await db.commit()
    await db.refresh(node)
    
    # Re-fetch with children relationship
    result = await db.execute(
        select(StudioNode)
        .where(StudioNode.id == node.id)
        .options(selectinload(StudioNode.children))
    )
    return result.scalar_one()

@router.patch("/nodes/{node_id}", response_model=StudioNodeOut)
async def update_studio_node(
    node_id: uuid.UUID,
    data: StudioNodeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(StudioNode)
        .where(StudioNode.id == node_id)
        .options(selectinload(StudioNode.children))
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Nodo non trovato")
    
    # Permissions check: only owner or admin can update
    # (Simple role check for now)
    from app.models.models import UserRole
    if node.user_id != current_user.id and current_user.ruolo != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Non hai i permessi per modificare questo nodo")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(node, field, value)
    
    await db.commit()
    await db.refresh(node)
    return node

@router.delete("/nodes/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_studio_node(
    node_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(StudioNode).where(StudioNode.id == node_id))
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Nodo non trovato")
    
    from app.models.models import UserRole
    if node.user_id != current_user.id and current_user.ruolo != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Non hai i permessi per eliminare questo nodo")

    await db.delete(node)
    await db.commit()
    return None

@router.post("/nodes/move", response_model=StudioNodeOut)
async def move_studio_node(
    node_id: uuid.UUID = Body(...),
    parent_id: Optional[uuid.UUID] = Body(None),
    order: Optional[int] = Body(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Endpoint specifico per il drag & drop.
    """
    result = await db.execute(
        select(StudioNode)
        .where(StudioNode.id == node_id)
        .options(selectinload(StudioNode.children))
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Nodo non trovato")
    
    from app.models.models import UserRole
    if node.user_id != current_user.id and current_user.ruolo != UserRole.ADMIN:
        # Move might be restricted for non-admins if it's a shared node
        if not node.is_private:
             raise HTTPException(status_code=403, detail="Solo gli admin possono spostare elementi condivisi")

    if parent_id:
        # Check if parent is descendant of node (circular dependency)
        curr_parent_id = parent_id
        while curr_parent_id:
            if curr_parent_id == node.id:
                raise HTTPException(status_code=400, detail="Non puoi spostare una cartella dentro se stessa o un suo figlio")
            res_parent = await db.execute(select(StudioNode.parent_id).where(StudioNode.id == curr_parent_id))
            curr_parent_id = res_parent.scalar_one_or_none()

    node.parent_id = parent_id
    if order is not None:
        node.order = order
    
    await db.commit()
    await db.refresh(node)
    return node
