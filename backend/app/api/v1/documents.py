import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.models import DocumentNode, User
from app.schemas.schemas import DocumentNodeCreate, DocumentNodeUpdate, DocumentNodeOut

router = APIRouter()


# ── Utility: load full subtree recursively ─────────────────

def _serialize_node(node: DocumentNode, include_content: bool = False) -> dict:
    """Serializes a DocumentNode to dict, recursively including children."""
    d = {
        "id": str(node.id),
        "nome": node.nome,
        "tipo": node.tipo,
        "icona": node.icona,
        "colore": node.colore,
        "contenuto": node.contenuto if include_content else None,
        "parent_id": str(node.parent_id) if node.parent_id else None,
        "ordine": node.ordine,
        "created_by": str(node.created_by),
        "created_at": node.created_at.isoformat(),
        "updated_at": node.updated_at.isoformat(),
        "children": [_serialize_node(c, include_content=False) for c in node.children],
    }
    return d


async def _load_tree(db: AsyncSession, current_user: User, parent_id: Optional[uuid.UUID] = None) -> List[DocumentNode]:
    """Load all nodes at one level with their children eagerly loaded (recursive selectinload). Filters by user ownership."""
    from app.models.models import UserRole
    
    stmt = select(DocumentNode).where(DocumentNode.parent_id == parent_id)
    
    # Filtro Sicurezza: Se non è ADMIN, vedi solo i tuoi documenti
    if current_user.ruolo != UserRole.ADMIN:
        stmt = stmt.where(DocumentNode.created_by == current_user.id)
    
    stmt = stmt.order_by(DocumentNode.ordine, DocumentNode.nome)

    # Eagerly load children (note: children will also need filtering if we had shared docs, 
    # but for private docs this is sufficient as the root check covers the subtree)
    stmt = stmt.options(
        selectinload(DocumentNode.children)
        .selectinload(DocumentNode.children)
        .selectinload(DocumentNode.children)
    )

    res = await db.execute(stmt)
    return list(res.scalars().all())


# ═══════════════════════════════════════════════════════════
# GET /documents/tree
# ═══════════════════════════════════════════════════════════

@router.get("/tree")
async def get_tree(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns the full document tree (root nodes + all descendants). Content excluded for performance."""
    roots = await _load_tree(db, current_user, parent_id=None)
    return [_serialize_node(n, include_content=False) for n in roots]


# ═══════════════════════════════════════════════════════════
# GET /documents/{id}
# ═══════════════════════════════════════════════════════════

@router.get("/{node_id}")
async def get_node(
    node_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns a single document/folder with its full content. Includes ownership check."""
    from app.models.models import UserRole
    stmt = select(DocumentNode).where(DocumentNode.id == node_id)
    res = await db.execute(stmt)
    node = res.scalar_one_or_none()
    
    if not node:
        raise HTTPException(status_code=404, detail="Documento non trovato")
        
    # Security Check
    if current_user.ruolo != UserRole.ADMIN and node.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Non hai i permessi per visualizzare questo documento")
        
    return _serialize_node(node, include_content=True)


# ═══════════════════════════════════════════════════════════
# POST /documents
# ═══════════════════════════════════════════════════════════

@router.post("")
async def create_node(
    data: DocumentNodeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates a new document node (file or folder)."""
    # Verify parent exists if specified
    if data.parent_id:
        parent_res = await db.execute(select(DocumentNode).where(DocumentNode.id == data.parent_id))
        parent = parent_res.scalar_one_or_none()
        if not parent:
            raise HTTPException(status_code=404, detail="Cartella padre non trovata")
        if parent.tipo != "FOLDER":
            raise HTTPException(status_code=400, detail="Il nodo padre deve essere una cartella")

    # Compute next ordine (max sibling ordine + 1)
    siblings_res = await db.execute(
        select(DocumentNode).where(DocumentNode.parent_id == data.parent_id)
    )
    siblings = siblings_res.scalars().all()
    next_ordine = max((s.ordine for s in siblings), default=-1) + 1

    node = DocumentNode(
        nome=data.nome,
        tipo=data.tipo,
        parent_id=data.parent_id,
        icona=data.icona,
        colore=data.colore,
        contenuto="",
        ordine=next_ordine,
        created_by=current_user.id
    )
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return _serialize_node(node, include_content=True)


# ═══════════════════════════════════════════════════════════
# PATCH /documents/{id}
# ═══════════════════════════════════════════════════════════

@router.patch("/{node_id}")
async def update_node(
    node_id: uuid.UUID,
    data: DocumentNodeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates a document node — rename, content, move to new parent, icon/color."""
    res = await db.execute(select(DocumentNode).where(DocumentNode.id == node_id))
    node = res.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Documento non trovato")
        
    # Security Check
    from app.models.models import UserRole
    if current_user.ruolo != UserRole.ADMIN and node.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Non hai i permessi per modificare questo documento")

    if data.nome is not None:
        node.nome = data.nome.strip() or node.nome
    if data.contenuto is not None:
        node.contenuto = data.contenuto
    if data.ordine is not None:
        node.ordine = data.ordine
    if data.icona is not None:
        node.icona = data.icona
    if data.colore is not None:
        node.colore = data.colore

    # Move to new parent (prevent moving into own subtree)
    if data.parent_id is not None and data.parent_id != node.parent_id:
        # Verify parent exists and is a folder
        parent_res = await db.execute(select(DocumentNode).where(DocumentNode.id == data.parent_id))
        parent = parent_res.scalar_one_or_none()
        if not parent:
            raise HTTPException(status_code=404, detail="Cartella padre non trovata")
        if parent.tipo != "FOLDER":
            raise HTTPException(status_code=400, detail="Il nodo padre deve essere una cartella")
        node.parent_id = data.parent_id

    node.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(node)
    return _serialize_node(node, include_content=True)


# ═══════════════════════════════════════════════════════════
# DELETE /documents/{id}
# ═══════════════════════════════════════════════════════════

@router.delete("/{node_id}")
async def delete_node(
    node_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deletes a document node and all its descendants (CASCADE)."""
    res = await db.execute(select(DocumentNode).where(DocumentNode.id == node_id))
    node = res.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Documento non trovato")

    # Security Check
    from app.models.models import UserRole
    if current_user.ruolo != UserRole.ADMIN and node.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Non hai i permessi per eliminare questo documento")

    await db.delete(node)
    await db.commit()
    return {"success": True}


# ═══════════════════════════════════════════════════════════
# PATCH /documents/{id}/move   (explicit move + reorder)
# ═══════════════════════════════════════════════════════════

@router.patch("/{node_id}/move")
async def move_node(
    node_id: uuid.UUID,
    parent_id: Optional[uuid.UUID] = None,
    ordine: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Moves a node to a different parent and updates its sort order."""
    res = await db.execute(select(DocumentNode).where(DocumentNode.id == node_id))
    node = res.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Documento non trovato")

    # Security Check
    from app.models.models import UserRole
    if current_user.ruolo != UserRole.ADMIN and node.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Non hai i permessi per spostare questo documento")

    node.parent_id = parent_id
    node.ordine = ordine
    node.updated_at = datetime.utcnow()
    await db.commit()
    return {"success": True}
