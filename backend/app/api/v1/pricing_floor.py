"""Pricing Floor calculator (Prompt 5, brief §4.3) — STATELESS.

Dato un progetto in offerta (stima ore per ruolo + costi diretti), calcola il prezzo minimo
che rispetta un margine target. Nessuna persistenza, nessuna nuova logica di costo:
riusa il costo orario fully-loaded della FONTE UNICA (risorse.costo_orario_override
or costo_orario_calcolato — lo stesso `costo_orario_effettivo` usato altrove).
"""
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_finance_access
from app.db.session import get_db
from app.models.models import Risorsa, User
from app.schemas.schemas import PricingFloorRequest

router = APIRouter(tags=["PricingFloor"])

_CENT = Decimal("0.01")


@router.post("/pricing-floor/calcola")
async def calcola_pricing_floor(
    payload: PricingFloorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    # Validazione input: niente divisione per zero / valori negativi.
    target = payload.margine_target
    if target < 0 or target >= 1:
        raise HTTPException(
            status_code=400,
            detail="margine_target deve essere 0 <= target < 1 (es. 0.30 per 30%).",
        )

    voci = payload.voci_manodopera
    ids = [v.risorsa_id for v in voci]
    risorse: dict = {}
    if ids:
        res = await db.execute(select(Risorsa).where(Risorsa.id.in_(ids)))
        risorse = {r.id: r for r in res.scalars().all()}

    costo_manodopera = Decimal("0")
    breakdown = []
    warning: list[str] = []
    for v in voci:
        ore = Decimal(str(v.ore))
        r = risorse.get(v.risorsa_id)
        if r is None:
            warning.append(f"Risorsa {v.risorsa_id} non trovata: esclusa dal costo.")
            breakdown.append({
                "risorsa_id": str(v.risorsa_id), "nome": None,
                "ore": float(ore), "costo_orario_fl": 0.0, "costo": 0.0,
            })
            continue
        # FONTE UNICA: costo orario fully-loaded effettivo (override o calcolato).
        fl = r.costo_orario_override or r.costo_orario_calcolato or Decimal("0")
        nome = f"{r.nome} {r.cognome}".strip()
        if not fl or fl == 0:
            warning.append(f"{nome}: costo orario fully-loaded non configurato (0) — costo manodopera sottostimato.")
        costo = (ore * Decimal(fl)).quantize(_CENT, rounding=ROUND_HALF_UP)
        costo_manodopera += costo
        breakdown.append({
            "risorsa_id": str(v.risorsa_id), "nome": nome,
            "ore": float(ore), "costo_orario_fl": float(fl), "costo": float(costo),
        })

    costo_manodopera = costo_manodopera.quantize(_CENT, rounding=ROUND_HALF_UP)
    costo_diretto_stimato = (
        costo_manodopera + payload.costi_diretti_extra + payload.quota_luca_stimata
    ).quantize(_CENT, rounding=ROUND_HALF_UP)
    pricing_floor = (costo_diretto_stimato / (Decimal("1") - target)).quantize(_CENT, rounding=ROUND_HALF_UP)

    return {
        "costo_manodopera": float(costo_manodopera),
        "costo_diretto_stimato": float(costo_diretto_stimato),
        "margine_target": float(target),
        "pricing_floor": float(pricing_floor),
        "breakdown_per_risorsa": breakdown,
        "warning": warning,
    }
