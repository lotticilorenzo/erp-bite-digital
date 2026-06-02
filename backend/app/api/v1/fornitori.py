import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func as sqlfunc
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_finance_access
from app.db.session import get_db
from app.models.models import FatturaPassiva, Fornitore, User
from app.schemas.schemas import (
    CategoriaFornitoreCreate,
    CategoriaFornitoreOut,
    CategoriaFornitoreUpdate,
    FornitoreCreate,
    FornitoreOut,
    FornitoreUpdate,
)
from app.services.services import (
    create_categoria_fornitore,
    create_fornitore,
    delete_categoria_fornitore,
    list_categorie_fornitori,
    list_fornitori,
    list_fornitori_full,
    update_categoria_fornitore,
    update_fornitore,
)

router = APIRouter(prefix="", tags=["Fornitori"])


# ── CATEGORIE FORNITORI ───────────────────────────────────


@router.get("/categorie-fornitori", response_model=List[CategoriaFornitoreOut])
async def get_categorie_fornitori(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    return await list_categorie_fornitori(db)


@router.post("/categorie-fornitori", response_model=CategoriaFornitoreOut, status_code=201)
async def add_categoria_fornitore(
    data: CategoriaFornitoreCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    try:
        cat = await create_categoria_fornitore(db, data)
        await db.commit()
        await db.refresh(cat)
        return cat
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/categorie-fornitori/{cat_id}", response_model=CategoriaFornitoreOut)
async def patch_categoria_fornitore(
    cat_id: uuid.UUID,
    data: CategoriaFornitoreUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    cat = await update_categoria_fornitore(db, cat_id, data)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria non trovata")
    await db.commit()
    await db.refresh(cat)
    return cat


@router.delete("/categorie-fornitori/{cat_id}", status_code=204)
async def remove_categoria_fornitore(
    cat_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    ok = await delete_categoria_fornitore(db, cat_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Categoria non trovata")
    await db.commit()


# ── FORNITORI ─────────────────────────────────────────────


@router.get("/fornitori-full")
async def get_fornitori_full(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    return await list_fornitori_full(db)


@router.post("/fornitori", response_model=FornitoreOut, status_code=201)
async def add_fornitore(
    data: FornitoreCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    try:
        forn = await create_fornitore(db, data)
        await db.commit()
        return forn
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/fornitori/{fornitore_id}", response_model=FornitoreOut)
async def patch_fornitore(
    fornitore_id: uuid.UUID,
    body: FornitoreUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    # exclude_unset (non exclude_none): il FE invia uno snapshot completo del record con i null
    # voluti, quindi un campo passato a null deve poter essere azzerato (B-04).
    forn = await update_fornitore(db, fornitore_id, body.model_dump(exclude_unset=True))
    if not forn:
        raise HTTPException(status_code=404, detail="Fornitore non trovato")
    await db.commit()
    # updated_at ha onupdate DB-side: dopo il flush e' espirata -> ricarico in ctx async per
    # evitare il lazy-load sync (MissingGreenlet) durante la serializzazione di FornitoreOut.
    await db.refresh(forn, attribute_names=["updated_at"])
    return forn


@router.get("/fornitori", response_model=List[FornitoreOut], tags=["FIC"])
async def get_fornitori(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    return await list_fornitori(db)


@router.delete("/fornitori/{fornitore_id}")
async def delete_fornitore_endpoint(
    fornitore_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    # Verifica fatture collegate
    fp_count = await db.execute(
        select(sqlfunc.count()).select_from(FatturaPassiva).where(FatturaPassiva.fornitore_id == fornitore_id)
    )
    count = fp_count.scalar()
    if count > 0:
        raise HTTPException(
            status_code=400, detail=f"Impossibile eliminare: fornitore ha {count} fatture passive collegate"
        )
    result = await db.execute(select(Fornitore).where(Fornitore.id == fornitore_id))
    forn = result.scalar_one_or_none()
    if not forn:
        raise HTTPException(status_code=404, detail="Fornitore non trovato")
    await db.delete(forn)
    await db.commit()
    return {"deleted": True}
