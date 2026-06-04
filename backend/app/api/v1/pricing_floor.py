"""Pricing Floor calculator (Prompt 5, brief §4.3) — STATELESS.

Dato un progetto in offerta (stima ore per ruolo + costi diretti), calcola il prezzo minimo
che rispetta un margine target. Nessuna persistenza, nessuna nuova logica di costo:
riusa il costo orario fully-loaded della FONTE UNICA (risorse.costo_orario_override
or costo_orario_calcolato — lo stesso `costo_orario_effettivo` usato altrove).
"""
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_finance_access
from app.db.session import get_db
from app.models.models import Risorsa, User
from app.schemas.schemas import PricingFloorRequest
from app.services.services import _RUOLI_FULLY_LOADED, calcola_tasso_overhead

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

    # Tasso overhead di struttura EUR/h (brief §3.3): allocato ai dipendenti, NON ai freelancer
    # (tariffe gia' fully-loaded). Mese di default = mese corrente.
    mese_overhead = (payload.mese or date.today()).replace(day=1)
    ov = await calcola_tasso_overhead(db, mese_overhead)
    tasso_overhead = ov["tasso_overhead"]

    voci = payload.voci_manodopera
    ids = [v.risorsa_id for v in voci]
    risorse: dict = {}
    if ids:
        res = await db.execute(select(Risorsa).where(Risorsa.id.in_(ids)))
        risorse = {r.id: r for r in res.scalars().all()}

    costo_manodopera = Decimal("0")
    overhead_totale = Decimal("0")
    breakdown = []
    warning: list[str] = []
    if ov.get("warning"):
        warning.append(ov["warning"])
    for v in voci:
        ore = Decimal(str(v.ore))
        r = risorse.get(v.risorsa_id)
        if r is None:
            warning.append(f"Risorsa {v.risorsa_id} non trovata: esclusa dal costo.")
            breakdown.append({
                "risorsa_id": str(v.risorsa_id), "nome": None, "ore": float(ore),
                "costo_orario_diretto": 0.0, "overhead_orario": 0.0,
                "quota_overhead": 0.0, "costo": 0.0,
            })
            continue
        # Costo DIRETTO per ora (override o calcolato): senza overhead di struttura.
        diretto = r.costo_orario_override or r.costo_orario_calcolato or Decimal("0")
        nome = f"{r.nome} {r.cognome}".strip()
        if not diretto or diretto == 0:
            warning.append(f"{nome}: costo orario diretto non configurato (0) — costo manodopera sottostimato.")
        # Overhead di struttura SOLO per i ruoli non fully-loaded (dipendenti). §3.3
        is_fully_loaded = (r.tipo_contratto or "").upper() in _RUOLI_FULLY_LOADED
        overhead_orario = Decimal("0") if is_fully_loaded else tasso_overhead
        quota_diretta = (ore * Decimal(diretto)).quantize(_CENT, rounding=ROUND_HALF_UP)
        quota_overhead = (ore * overhead_orario).quantize(_CENT, rounding=ROUND_HALF_UP)
        costo = (quota_diretta + quota_overhead).quantize(_CENT, rounding=ROUND_HALF_UP)
        costo_manodopera += costo
        overhead_totale += quota_overhead
        breakdown.append({
            "risorsa_id": str(v.risorsa_id), "nome": nome, "ore": float(ore),
            "costo_orario_diretto": float(diretto),
            "overhead_orario": float(overhead_orario),
            "quota_overhead": float(quota_overhead),
            "costo": float(costo),
        })

    costo_manodopera = costo_manodopera.quantize(_CENT, rounding=ROUND_HALF_UP)
    overhead_totale = overhead_totale.quantize(_CENT, rounding=ROUND_HALF_UP)
    costo_diretto_stimato = (
        costo_manodopera + payload.costi_diretti_extra + payload.quota_luca_stimata
    ).quantize(_CENT, rounding=ROUND_HALF_UP)
    pricing_floor = (costo_diretto_stimato / (Decimal("1") - target)).quantize(_CENT, rounding=ROUND_HALF_UP)

    return {
        "costo_manodopera": float(costo_manodopera),
        "overhead_totale": float(overhead_totale),
        "tasso_overhead": float(tasso_overhead),
        "overhead_base": {
            "mese": str(mese_overhead),
            "costi_fissi_mensili": float(ov["costi_fissi_mensili"]),
            "ore_produttive_team_mese": float(ov["ore_produttive_team_mese"]),
            "n_dipendenti": ov["n_dipendenti"],
        },
        "costo_diretto_stimato": float(costo_diretto_stimato),
        "margine_target": float(target),
        "pricing_floor": float(pricing_floor),
        "breakdown_per_risorsa": breakdown,
        "warning": warning,
    }
