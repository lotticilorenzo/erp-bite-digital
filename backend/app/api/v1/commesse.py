import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_erp_access
from app.db.session import get_db
from app.models.models import Commessa as CommessaModel, CommessaStatus, FatturaAttiva, User
from app.schemas.schemas import CommessaCreate, CommessaOut, CommessaUpdate
from app.services.services import (
    calcola_metriche_commessa,
    create_commessa,
    get_commessa,
    get_costi_dettaglio_commessa,
    list_commesse,
    update_commessa,
)

router = APIRouter(prefix="/commesse", tags=["Commesse"])


async def _enrich_commessa(db: AsyncSession, c, coeff_cache: Optional[dict[date, Decimal]] = None) -> dict:
    """Aggiunge i campi calcolati alla commessa prima della serializzazione."""
    minuti_totali = 0
    costo_manodopera_calc = Decimal("0")
    if hasattr(c, "timesheet"):
        for t in c.timesheet:
            minuti_totali += (t.durata_minuti or 0)
            costo_manodopera_calc += (t.costo_lavoro or Decimal("0"))

    ore_reali = minuti_totali / 60.0
    d = CommessaOut.model_validate(c, from_attributes=True, strict=False).model_dump(warnings=False)
    d["ore_reali"] = float(ore_reali)
    d["costo_manodopera"] = float(costo_manodopera_calc)

    try:
        fattCalc = sum(r.valore_fatturabile_calc for r in c.righe_progetto)
        for ag in (c.aggiustamenti or []):
            from decimal import Decimal as _D
            fattCalc += _D(str(ag.get("importo", 0)))
        d["margine_euro"] = float(fattCalc - costo_manodopera_calc - (c.costi_diretti or Decimal("0")))
        d["margine_percentuale"] = round(d["margine_euro"] / float(fattCalc) * 100, 1) if fattCalc > 0 else None
    except Exception:
        d["margine_euro"] = None
        d["margine_percentuale"] = None

    metriche = await calcola_metriche_commessa(db, c, coeff_cache)
    d.update(metriche)

    d["aggiustamenti"] = c.aggiustamenti or []
    d["data_inizio"] = str(c.data_inizio) if c.data_inizio else None
    d["data_fine"] = str(c.data_fine) if c.data_fine else None

    if hasattr(c, "fattura") and c.fattura:
        d["fattura_id"] = c.fattura.id
        d["fattura_numero"] = c.fattura.numero
        d["fattura_data"] = str(c.fattura.data_emissione) if c.fattura.data_emissione else None
        d["fattura_importo"] = (
            float(c.fattura.importo_netto)
            if hasattr(c.fattura, "importo_netto") and c.fattura.importo_netto
            else None
        )
        d["fattura_stato"] = (
            c.fattura.stato_pagamento if hasattr(c.fattura, "stato_pagamento") else None
        )

    return d


@router.get("")
async def get_commesse(
    mese: Optional[date] = Query(None, description="Formato YYYY-MM-01"),
    stato: Optional[CommessaStatus] = Query(None),
    cliente_id: Optional[uuid.UUID] = Query(None),
    progetto_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_erp_access),
):
    commesse = await list_commesse(db, mese, stato, cliente_id, progetto_id)
    coeff_cache: dict[date, Decimal] = {}
    enriched = []
    for c in commesse:
        enriched.append(await _enrich_commessa(db, c, coeff_cache))
    return enriched


@router.get("/{commessa_id}")
async def get_single_commessa(
    commessa_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_erp_access),
):
    c = await get_commessa(db, commessa_id)
    if not c:
        raise HTTPException(status_code=404, detail="Commessa non trovata")
    return await _enrich_commessa(db, c)


@router.get("/{commessa_id}/profitability")
async def get_commessa_profitability(
    commessa_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_erp_access),
):
    c = await get_commessa(db, commessa_id)
    if not c:
        raise HTTPException(status_code=404, detail="Commessa non trovata")

    minuti_totali = sum(t.durata_minuti or 0 for t in c.timesheet)
    costo_manodopera = float(sum(t.costo_lavoro or Decimal("0") for t in c.timesheet))
    ore_consumate = minuti_totali / 60.0
    ore_budget = float(c.ore_contratto or 0)

    try:
        valore_fatturabile = float(sum(r.valore_fatturabile_calc for r in c.righe_progetto))
        for ag in (c.aggiustamenti or []):
            valore_fatturabile += float(ag.get("importo", 0))
    except Exception:
        valore_fatturabile = 0.0

    costi_diretti = float(c.costi_diretti or 0)
    margine_euro = valore_fatturabile - costo_manodopera - costi_diretti
    margine_percentuale = (
        round(margine_euro / valore_fatturabile * 100, 1) if valore_fatturabile > 0 else None
    )

    perc_ore = round(ore_consumate / ore_budget * 100, 1) if ore_budget > 0 else None

    if margine_percentuale is None:
        alert_level = "NO_DATA"
    elif margine_percentuale < 15:
        alert_level = "CRITICAL"
    elif margine_percentuale < 30:
        alert_level = "WARNING"
    else:
        alert_level = "OK"

    return {
        "commessa_id": str(commessa_id),
        "ore_budget": ore_budget,
        "ore_consumate": round(ore_consumate, 2),
        "perc_ore_consumate": perc_ore,
        "valore_fatturabile": valore_fatturabile,
        "costo_manodopera": round(costo_manodopera, 2),
        "costi_diretti": costi_diretti,
        "margine_euro": round(margine_euro, 2),
        "margine_percentuale": margine_percentuale,
        "alert_level": alert_level,
    }


@router.post("", status_code=201)
async def add_commessa(
    data: CommessaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_erp_access),
):
    c = await create_commessa(db, data)
    c = await get_commessa(db, c.id)
    return await _enrich_commessa(db, c)


@router.patch("/{commessa_id}")
async def patch_commessa(
    commessa_id: uuid.UUID,
    data: CommessaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_erp_access),
):
    c = await update_commessa(db, commessa_id, data, current_user)
    if not c:
        raise HTTPException(status_code=404, detail="Commessa non trovata")
    return await _enrich_commessa(db, c)


@router.patch("/{commessa_id}/fattura", response_model=CommessaOut)
async def collega_fattura_commessa(
    commessa_id: uuid.UUID,
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_erp_access),
):
    """Collega o scollega una fattura da una commessa. body: {fattura_id: uuid | null}"""
    c = await get_commessa(db, commessa_id)
    if not c:
        raise HTTPException(status_code=404, detail="Commessa non trovata")
    fattura_id = body.get("fattura_id")
    if fattura_id:
        fa_res = await db.execute(select(FatturaAttiva).where(FatturaAttiva.id == uuid.UUID(str(fattura_id))))
        fa = fa_res.scalar_one_or_none()
        if not fa:
            raise HTTPException(status_code=404, detail="Fattura non trovata")
        c.fattura_id = fa.id
    else:
        c.fattura_id = None
    await db.commit()
    await db.refresh(c)
    return await _enrich_commessa(db, c)


@router.get("/{commessa_id}/costi-dettaglio")
async def get_commessa_costi_dettaglio(
    commessa_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_erp_access),
):
    return await get_costi_dettaglio_commessa(db, commessa_id)


@router.delete("/{commessa_id}", status_code=204)
async def delete_commessa(
    commessa_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_erp_access),
):
    result = await db.execute(select(CommessaModel).where(CommessaModel.id == commessa_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Commessa non trovata")
    
    c.is_deleted = True
    c.deleted_at = datetime.now()
    # await db.delete(c) # Soft-delete instead
    await db.commit()
