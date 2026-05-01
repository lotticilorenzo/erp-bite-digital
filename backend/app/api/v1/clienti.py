import os
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, require_roles
from app.db.session import get_db
from app.services import audit
from app.models.models import Progetto, User, UserRole, Cliente as ClienteModel
from app.schemas.schemas import ClienteCreate, ClienteOut, ClienteUpdate
from app.services.services import (
    create_cliente,
    delete_cliente,
    get_cliente,
    get_project_stats,
    update_cliente,
)

router = APIRouter(prefix="/clienti", tags=["Clienti"])


@router.get("", response_model=List[ClienteOut])
async def get_clienti(
    attivo: Optional[bool] = Query(None),
    search: Optional[str] = Query(None, description="Ricerca per ragione sociale"),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    q = select(ClienteModel).where(ClienteModel.is_deleted == False)
    if attivo is not None:
        q = q.where(ClienteModel.attivo == attivo)
    if search:
        q = q.where(ClienteModel.ragione_sociale.ilike(f"%{search}%"))
    q = q.order_by(ClienteModel.ragione_sociale).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{cliente_id}", response_model=ClienteOut)
async def get_single_cliente(
    cliente_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    c = await get_cliente(db, cliente_id)
    if not c:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    return c


@router.get("/{cliente_id}/health-score")
async def get_cliente_health(
    cliente_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    from app.services.services import get_client_health_score

    return await get_client_health_score(db, cliente_id)


@router.post("", response_model=ClienteOut, status_code=201)
async def add_cliente(
    data: ClienteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    new_c = await create_cliente(db, data)
    await audit.emit_create(db, tabella="clienti", record_id=new_c.id, user_id=current_user.id, dati=data.model_dump())
    await db.commit()
    return new_c


@router.patch("/{cliente_id}", response_model=ClienteOut)
async def patch_cliente(
    cliente_id: uuid.UUID,
    data: ClienteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    c = await update_cliente(db, cliente_id, data, current_user.id)
    await audit.emit_update(db, tabella="clienti", record_id=cliente_id, user_id=current_user.id, dopo=data.model_dump(exclude_none=True))
    if not c:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    return c


@router.post("/{cliente_id}/logo")
async def upload_cliente_logo(
    cliente_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    # Validazione estensione
    allowed_exts = {".png", ".jpg", ".jpeg", ".webp", ".svg"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail="Formato file non supportato")

    # Validazione dimensione (2MB)
    MAX_SIZE = 2 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File troppo grande (max 2MB)")

    # Rinomina file in modo univoco
    filename = f"{cliente_id}_{uuid.uuid4().hex}{ext}"
    filepath = os.path.join("static", "logos", filename)

    # Assicurati che la directory esista
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

    # Salvataggio fisico
    with open(filepath, "wb") as f:
        f.write(content)

    # Aggiornamento DB
    from sqlalchemy import select as _sel_c

    res = await db.execute(_sel_c(ClienteModel).where(ClienteModel.id == cliente_id))
    c = res.scalar_one_or_none()
    if not c:
        if os.path.exists(filepath):
            os.remove(filepath)
        raise HTTPException(status_code=404, detail="Cliente non trovato")

    # Cancella vecchio logo se presente e se diverso
    if c.logo_url and c.logo_url.startswith("/static/logos/"):
        _logos_root = Path("static/logos").resolve()
        _old = (_logos_root / Path(c.logo_url).name).resolve()
        # Controllo anti-path-traversal
        if str(_old).startswith(str(_logos_root)) and _old.exists() and _old != Path(filepath).resolve():
            try:
                _old.unlink()
            except OSError:
                pass

    c.logo_url = f"/static/logos/{filename}"
    await db.commit()
    await db.refresh(c)
    return {"logo_url": c.logo_url}


@router.delete("/{cliente_id}/logo")
async def delete_cliente_logo(
    cliente_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    from sqlalchemy import select as _sel_c

    res = await db.execute(_sel_c(ClienteModel).where(ClienteModel.id == cliente_id))
    c = res.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Cliente non trovato")

    if c.logo_url and c.logo_url.startswith("/static/logos/"):
        _logos_root = Path("static/logos").resolve()
        _lp = (_logos_root / Path(c.logo_url).name).resolve()
        if str(_lp).startswith(str(_logos_root)) and _lp.exists():
            try:
                _lp.unlink()
            except OSError:
                pass

    c.logo_url = None
    await db.commit()
    return {"success": True}


@router.delete("/{cliente_id}", status_code=204)
async def remove_cliente(
    cliente_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    c = await get_cliente(db, cliente_id)
    if not c:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
        
    c.is_deleted = True
    c.deleted_at = datetime.now()
    # await delete_cliente(db, cliente_id, current_user.id) # Soft-delete instead
    await db.commit()


@router.get("/{cliente_id}/stats", tags=["Dashboard"])
async def get_client_dashboard_stats(
    cliente_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Progetto.id).where(Progetto.cliente_id == cliente_id))
    project_ids = result.scalars().all()

    if not project_ids:
        return {
            "kpis": {"total": 0, "today": 0, "overdue": 0, "upcoming": 0},
            "status_distribution": [],
            "team_stats": [],
            "critical_tasks": [],
        }

    all_stats = [await get_project_stats(db, pid) for pid in project_ids]

    merged_kpis = {"total": 0, "today": 0, "overdue": 0, "upcoming": 0}
    merged_status: dict = {}
    merged_team: dict = {}
    merged_critical: list = []

    for s in all_stats:
        for k in merged_kpis:
            merged_kpis[k] += s["kpis"][k]
        for item in s["status_distribution"]:
            merged_status[item["status"]] = merged_status.get(item["status"], 0) + item["count"]
        for team in s["team_stats"]:
            tid = str(team["id"])
            if tid not in merged_team:
                merged_team[tid] = team
            else:
                merged_team[tid]["total_tasks"] += team["total_tasks"]
                merged_team[tid]["overdue_tasks"] += team["overdue_tasks"]
        merged_critical.extend(s["critical_tasks"])

    merged_critical.sort(key=lambda x: x["data_scadenza"] or date.max)

    return {
        "kpis": merged_kpis,
        "status_distribution": [{"status": s, "count": c} for s, c in merged_status.items()],
        "team_stats": list(merged_team.values()),
        "critical_tasks": merged_critical[:10],
    }
