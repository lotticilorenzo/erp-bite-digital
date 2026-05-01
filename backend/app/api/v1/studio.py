from fastapi import APIRouter, Depends, HTTPException, status, Body, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional
import uuid
import os
import aiofiles

from app.db.session import get_db
from app.core.security import get_current_user, is_studio_only_role
from app.core.permissions import get_user_access_scope
from app.services import audit
from app.models.models import (
    User,
    StudioNode,
    StudioNodeType,
    UserRole,
    Cliente,
    Progetto,
    ProgettoTeam,
    Task,
    TaskComment,
    TaskAttachment,
)
from app.schemas.schemas import (
    StudioNodeCreate, StudioNodeUpdate, StudioNodeOut,
    TaskAttachmentOut
)
from datetime import datetime
import uuid as _uuid

router = APIRouter(prefix="/studio", tags=["Studio Workspace"])


def _node_to_dict(node: "StudioNode") -> dict:
    return {
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
        "children": [],
    }


async def _list_siblings(
    db: AsyncSession,
    parent_id: Optional[uuid.UUID],
    *,
    exclude_id: Optional[uuid.UUID] = None,
) -> List[StudioNode]:
    stmt = select(StudioNode)
    if parent_id is None:
        stmt = stmt.where(StudioNode.parent_id.is_(None))
    else:
        stmt = stmt.where(StudioNode.parent_id == parent_id)

    if exclude_id is not None:
        stmt = stmt.where(StudioNode.id != exclude_id)

    stmt = stmt.order_by(StudioNode.order.asc(), StudioNode.created_at.asc(), StudioNode.id.asc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def _normalize_sibling_orders(
    db: AsyncSession,
    parent_id: Optional[uuid.UUID],
    *,
    exclude_id: Optional[uuid.UUID] = None,
) -> None:
    siblings = await _list_siblings(db, parent_id, exclude_id=exclude_id)
    for index, sibling in enumerate(siblings):
        sibling.order = index


async def _place_node(
    db: AsyncSession,
    node: StudioNode,
    *,
    parent_id: Optional[uuid.UUID],
    requested_order: Optional[int],
) -> None:
    siblings = await _list_siblings(db, parent_id, exclude_id=node.id)

    if requested_order is None:
        target_order = len(siblings)
    else:
        target_order = max(0, min(requested_order, len(siblings)))

    for index, sibling in enumerate(siblings):
        sibling.order = index if index < target_order else index + 1

    node.parent_id = parent_id
    node.order = target_order


async def _studio_access_scope(
    db: AsyncSession,
    current_user: User,
) -> tuple[set[uuid.UUID], set[uuid.UUID], set[uuid.UUID]]:
    return await get_user_access_scope(db, current_user)


def _node_is_directly_visible(
    node: dict,
    current_user: User,
    accessible_project_ids: set[uuid.UUID],
    accessible_task_ids: set[uuid.UUID],
    accessible_client_ids: set[uuid.UUID],
) -> bool:
    if current_user.ruolo == UserRole.ADMIN:
        return True

    if node["user_id"] == current_user.id:
        return True

    if node["is_private"]:
        return False

    if not is_studio_only_role(current_user.ruolo):
        return True

    linked_task_id = node.get("linked_task_id")
    if linked_task_id and linked_task_id in accessible_task_ids:
        return True

    linked_project_id = node.get("linked_progetto_id")
    if linked_project_id and linked_project_id in accessible_project_ids:
        return True

    linked_client_id = node.get("linked_cliente_id")
    if linked_client_id and linked_client_id in accessible_client_ids:
        return True

    return False


def _prune_visible_tree(
    node: dict,
    current_user: User,
    accessible_project_ids: set[uuid.UUID],
    accessible_task_ids: set[uuid.UUID],
    accessible_client_ids: set[uuid.UUID],
) -> bool:
    visible_children: list[dict] = []
    for child in node["children"]:
        if _prune_visible_tree(
            child,
            current_user,
            accessible_project_ids,
            accessible_task_ids,
            accessible_client_ids,
        ):
            visible_children.append(child)
    node["children"] = visible_children

    return _node_is_directly_visible(
        node,
        current_user,
        accessible_project_ids,
        accessible_task_ids,
        accessible_client_ids,
    ) or bool(visible_children)


async def _get_task_or_404(
    db: AsyncSession,
    task_id: _uuid.UUID,
) -> Task:
    task_result = await db.execute(select(Task).where(Task.id == task_id))
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task non trovato")
    return task


async def _ensure_task_access(
    db: AsyncSession,
    current_user: User,
    task: Task,
) -> None:
    if current_user.ruolo == UserRole.ADMIN or not is_studio_only_role(current_user.ruolo):
        return

    if task.assegnatario_id == current_user.id or task.revisore_id == current_user.id:
        return

    if task.progetto_id:
        membership_result = await db.execute(
            select(ProgettoTeam.id).where(
                ProgettoTeam.progetto_id == task.progetto_id,
                ProgettoTeam.user_id == current_user.id,
            )
        )
        if membership_result.scalar_one_or_none():
            return

    raise HTTPException(
        status_code=403,
        detail="Non hai accesso a questo task di Studio OS",
    )


async def _get_node_or_404(
    db: AsyncSession,
    node_id: uuid.UUID,
) -> StudioNode:
    result = await db.execute(select(StudioNode).where(StudioNode.id == node_id))
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Nodo non trovato")
    return node


async def _ensure_node_visible(
    db: AsyncSession,
    current_user: User,
    node: StudioNode,
) -> None:
    if current_user.ruolo == UserRole.ADMIN:
        return

    if node.user_id == current_user.id:
        return

    if node.is_private:
        raise HTTPException(status_code=403, detail="Non hai accesso a questo nodo")

    if not is_studio_only_role(current_user.ruolo):
        return

    accessible_project_ids, accessible_task_ids, accessible_client_ids = await _studio_access_scope(
        db,
        current_user,
    )
    node_payload = {
        "user_id": node.user_id,
        "is_private": node.is_private,
        "linked_progetto_id": node.linked_progetto_id,
        "linked_task_id": node.linked_task_id,
        "linked_cliente_id": node.linked_cliente_id,
    }
    if _node_is_directly_visible(
        node_payload,
        current_user,
        accessible_project_ids,
        accessible_task_ids,
        accessible_client_ids,
    ):
        return

    pending_parent_ids = [node.id]
    while pending_parent_ids:
        descendants_result = await db.execute(
            select(StudioNode).where(StudioNode.parent_id.in_(pending_parent_ids))
        )
        descendants = descendants_result.scalars().all()
        pending_parent_ids = [descendant.id for descendant in descendants]

        for descendant in descendants:
            descendant_payload = {
                "user_id": descendant.user_id,
                "is_private": descendant.is_private,
                "linked_progetto_id": descendant.linked_progetto_id,
                "linked_task_id": descendant.linked_task_id,
                "linked_cliente_id": descendant.linked_cliente_id,
            }
            if _node_is_directly_visible(
                descendant_payload,
                current_user,
                accessible_project_ids,
                accessible_task_ids,
                accessible_client_ids,
            ):
                return

    raise HTTPException(status_code=403, detail="Non hai accesso a questo nodo")


async def _ensure_link_targets_allowed(
    db: AsyncSession,
    current_user: User,
    *,
    linked_progetto_id: Optional[uuid.UUID],
    linked_task_id: Optional[uuid.UUID],
    linked_cliente_id: Optional[uuid.UUID],
) -> None:
    if current_user.ruolo == UserRole.ADMIN or not is_studio_only_role(current_user.ruolo):
        return

    accessible_project_ids, accessible_task_ids, accessible_client_ids = await _studio_access_scope(
        db,
        current_user,
    )

    if linked_progetto_id and linked_progetto_id not in accessible_project_ids:
        raise HTTPException(status_code=403, detail="Non puoi collegare nodi a progetti non assegnati")
    if linked_task_id and linked_task_id not in accessible_task_ids:
        raise HTTPException(status_code=403, detail="Non puoi collegare nodi a task non assegnati")
    if linked_cliente_id and linked_cliente_id not in accessible_client_ids:
        raise HTTPException(status_code=403, detail="Non puoi collegare nodi a clienti fuori perimetro")

# ═══════════════════════════════════════
# TASK COMMENTS
# ═══════════════════════════════════════

@router.get("/tasks/{task_id}/comments")
async def get_task_comments(
    task_id: _uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = await _get_task_or_404(db, task_id)
    await _ensure_task_access(db, current_user, task)

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
    task = await _get_task_or_404(db, task_id)
    await _ensure_task_access(db, current_user, task)

    comment = TaskComment(
        task_id=task_id,
        autore_id=current_user.id,
        contenuto=contenuto,
    )
    db.add(comment)
    await db.flush()
    await audit.emit(
        db,
        tabella="task_comments",
        azione="CREATE",
        record_id=comment.id,
        user_id=current_user.id,
        dati_dopo={"task_id": str(task_id), "contenuto": contenuto}
    )
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
    task = await _get_task_or_404(db, task_id)
    await _ensure_task_access(db, current_user, task)

    res = await db.execute(select(TaskComment).where(TaskComment.id == comment_id, TaskComment.task_id == task_id))
    c = res.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Commento non trovato")
    if c.autore_id != current_user.id and current_user.ruolo != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Non autorizzato")
    await audit.emit_delete(
        db,
        tabella="task_comments",
        record_id=comment_id,
        user_id=current_user.id,
        dati={"task_id": str(task_id), "contenuto": c.contenuto}
    )
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
            ((StudioNode.is_private == False) | (StudioNode.user_id == current_user.id)) &
            (StudioNode.is_deleted == False)
        )
        .order_by(StudioNode.order.asc(), StudioNode.created_at.asc(), StudioNode.id.asc())
    )
    all_nodes = result.scalars().all()

    accessible_project_ids, accessible_task_ids, accessible_client_ids = await _studio_access_scope(
        db,
        current_user,
    )
    
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

    visible_roots = [
        root
        for root in roots
        if _prune_visible_tree(
            root,
            current_user,
            accessible_project_ids,
            accessible_task_ids,
            accessible_client_ids,
        )
    ]

    # 4. Final validation of the root dictionaries against the Pydantic model
    # Since they are dicts, Pydantic won't try to read any ORM attributes.
    return [StudioNodeOut.model_validate(r) for r in visible_roots]

@router.post("/nodes", response_model=StudioNodeOut, status_code=status.HTTP_201_CREATED)
async def create_studio_node(
    data: StudioNodeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only Admin can create shared folders? 
    # For now let everyone create nodes, but marked as private if not admin?
    # User requested: "preimpostatamente le cose sarebbero totali... in alcuni casi private"
    
    if data.parent_id is not None:
        parent_node = await _get_node_or_404(db, data.parent_id)
        await _ensure_node_visible(db, current_user, parent_node)

    await _ensure_link_targets_allowed(
        db,
        current_user,
        linked_progetto_id=data.linked_progetto_id,
        linked_task_id=data.linked_task_id,
        linked_cliente_id=data.linked_cliente_id,
    )

    node = StudioNode(
        **data.model_dump(),
        user_id=current_user.id
    )
    db.add(node)
    await db.flush()
    requested_order = data.order if "order" in data.model_fields_set else None
    await _place_node(
        db,
        node,
        parent_id=data.parent_id,
        requested_order=requested_order,
    )
    await db.flush()
    await audit.emit_create(
        db,
        tabella="studio_nodes",
        record_id=node.id,
        user_id=current_user.id,
        dati=data.model_dump()
    )
    await db.commit()
    await db.refresh(node)
    
    # Re-fetch with children relationship
    result = await db.execute(
        select(StudioNode)
        .where(StudioNode.id == node.id)
        .options(selectinload(StudioNode.children))
    )
    return result.scalar_one()

@router.patch("/nodes/{node_id}")
async def update_studio_node(
    node_id: uuid.UUID,
    data: StudioNodeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    node = await _get_node_or_404(db, node_id)

    if node.user_id != current_user.id and current_user.ruolo != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Non hai i permessi per modificare questo nodo")

    update_payload = data.model_dump(exclude_none=True)
    parent_in_payload = "parent_id" in data.model_fields_set
    if parent_in_payload and data.parent_id != node.parent_id:
        if data.parent_id is not None:
            parent_node = await _get_node_or_404(db, data.parent_id)
            await _ensure_node_visible(db, current_user, parent_node)

            curr_parent_id = data.parent_id
            while curr_parent_id:
                if curr_parent_id == node.id:
                    raise HTTPException(status_code=400, detail="Non puoi spostare un nodo dentro se stesso")
                res_parent = await db.execute(select(StudioNode.parent_id).where(StudioNode.id == curr_parent_id))
                curr_parent_id = res_parent.scalar_one_or_none()

        update_payload["parent_id"] = data.parent_id

    await _ensure_link_targets_allowed(
        db,
        current_user,
        linked_progetto_id=update_payload.get("linked_progetto_id", node.linked_progetto_id),
        linked_task_id=update_payload.get("linked_task_id", node.linked_task_id),
        linked_cliente_id=update_payload.get("linked_cliente_id", node.linked_cliente_id),
    )

    prima = _node_to_dict(node)
    for field, value in update_payload.items():
        setattr(node, field, value)

    await db.flush()
    await audit.emit_update(
        db,
        tabella="studio_nodes",
        record_id=node_id,
        user_id=current_user.id,
        prima=prima,
        dopo=_node_to_dict(node)
    )
    await db.commit()
    await db.refresh(node)
    return _node_to_dict(node)

@router.delete("/nodes/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_studio_node(
    node_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    node = await _get_node_or_404(db, node_id)
    
    from app.models.models import UserRole
    if node.user_id != current_user.id and current_user.ruolo != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Non hai i permessi per eliminare questo nodo")

    old_parent_id = node.parent_id
    node.is_deleted = True
    node.deleted_at = datetime.now()
    
    await audit.emit_delete(
        db,
        tabella="studio_nodes",
        record_id=node_id,
        user_id=current_user.id,
        dati=_node_to_dict(node)
    )
    # await db.delete(node) # Soft-delete instead
    await db.flush()
    await _normalize_sibling_orders(db, old_parent_id, exclude_id=node.id)
    await db.commit()
    return None

@router.post("/nodes/move")
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

    if node.user_id != current_user.id and current_user.ruolo != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Non hai i permessi per spostare questo nodo")

    if parent_id:
        parent_node = await _get_node_or_404(db, parent_id)
        await _ensure_node_visible(db, current_user, parent_node)

        # Check if parent is descendant of node (circular dependency)
        curr_parent_id = parent_id
        while curr_parent_id:
            if curr_parent_id == node.id:
                raise HTTPException(status_code=400, detail="Non puoi spostare una cartella dentro se stessa o un suo figlio")
            res_parent = await db.execute(select(StudioNode.parent_id).where(StudioNode.id == curr_parent_id))
            curr_parent_id = res_parent.scalar_one_or_none()

    prima = _node_to_dict(node)
    await _place_node(
        db,
        node,
        parent_id=parent_id,
        requested_order=order,
    )
    
    await db.flush()
    dopo = _node_to_dict(node)
    # Arricchiamo il log con info esplicite sullo spostamento di gerarchia
    dopo_extended = {
        **dopo,
        "_meta": {
            "old_parent": str(prima["parent_id"]) if prima["parent_id"] else "ROOT",
            "new_parent": str(dopo["parent_id"]) if dopo["parent_id"] else "ROOT",
            "node_name": node.nome
        }
    }

    await audit.emit_update(
        db,
        tabella="studio_nodes",
        record_id=node_id,
        user_id=current_user.id,
        prima=prima,
        dopo=dopo_extended
    )
    await db.commit()
    await db.refresh(node)
    return _node_to_dict(node)

# ── ATTACHMENTS ───────────────────────────────────────────

UPLOAD_DIR = "app/uploads/task_attachments"

@router.post("/tasks/{task_id}/attachments", response_model=TaskAttachmentOut)
async def upload_task_attachment(
    task_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Ensure task exists
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task non trovata")
    
    await _ensure_task_access(db, current_user, task)

    # Create directory if not exists (extra safety)
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Generate unique filename
    ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    # Save file
    async with aiofiles.open(file_path, 'wb') as out_file:
        content = await file.read()
        await out_file.write(content)
        file_size = len(content)

    attachment = TaskAttachment(
        task_id=task_id,
        user_id=current_user.id,
        filename=file.filename,
        file_path=file_path,
        file_size=file_size,
        content_type=file.content_type
    )
    db.add(attachment)
    await db.flush()
    await audit.emit_create(
        db,
        tabella="task_attachments",
        record_id=attachment.id,
        user_id=current_user.id,
        dati={"filename": file.filename, "task_id": str(task_id)}
    )
    await db.commit()
    await db.refresh(attachment)
    
    # Reload with user for schema
    result = await db.execute(
        select(TaskAttachment)
        .options(selectinload(TaskAttachment.user))
        .where(TaskAttachment.id == attachment.id)
    )
    return result.scalar_one()

@router.get("/tasks/{task_id}/attachments", response_model=List[TaskAttachmentOut])
async def list_task_attachments(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = await _get_task_or_404(db, task_id)
    await _ensure_task_access(db, current_user, task)

    result = await db.execute(
        select(TaskAttachment)
        .options(selectinload(TaskAttachment.user))
        .where(TaskAttachment.task_id == task_id)
        .order_by(TaskAttachment.created_at.desc())
    )
    return result.scalars().all()

@router.delete("/tasks/{task_id}/attachments/{attachment_id}")
async def delete_task_attachment(
    task_id: uuid.UUID,
    attachment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    attachment = await db.get(TaskAttachment, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Allegato non trovato")
    
    # Permessi: Admin o proprietario
    if current_user.ruolo != UserRole.ADMIN and attachment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Non hai i permessi per eliminare questo allegato")

    # Delete physical file
    if os.path.exists(attachment.file_path):
        try:
            os.remove(attachment.file_path)
        except Exception as e:
            print(f"Errore rimozione file: {e}")

    await audit.emit_delete(
        db,
        tabella="task_attachments",
        record_id=attachment_id,
        user_id=current_user.id,
        dati={"filename": attachment.filename, "task_id": str(task_id)}
    )
    await db.delete(attachment)
    await db.commit()
    return {"status": "success"}
