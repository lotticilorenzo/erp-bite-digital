import json
import logging
import os
import re
from collections import defaultdict
from datetime import date
from difflib import SequenceMatcher

import httpx
from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_current_user, require_roles
from app.db.session import get_db
from app.models.models import (
    Commessa,
    CommessaProgetto,
    Progetto,
    ProgettoTeam,
    TaskTemplate,
    Timesheet,
    User,
    UserRole,
)
from app.schemas.schemas import (
    AIChatRequest,
    AIChatResponse,
    AIEstimateHoursRequest,
    AIEstimateHoursResponse,
    AIEstimateHoursSimilarOut,
    AIGenerateTasksContextOut,
    AIGenerateTasksRequest,
    AIGenerateTasksResponse,
    AITaskSuggestionOut,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI"])

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
CLAUDE_CHAT_MODEL = os.getenv("ANTHROPIC_CHAT_MODEL", "claude-3-5-sonnet-20240620")
CLAUDE_TASK_MODEL = os.getenv("ANTHROPIC_TASK_MODEL", CLAUDE_CHAT_MODEL)


def _normalize_service(value: str | None) -> str:
    return (value or "").strip().lower()


def _priority_value(value: str | None) -> str:
    raw = (value or "").strip().lower()
    if raw in {"urgente", "urgent"}:
        return "urgente"
    if raw in {"alta", "high"}:
        return "alta"
    if raw in {"bassa", "low"}:
        return "bassa"
    return "media"


def _role_value(value: str | None) -> str | None:
    if not value:
        return None
    raw = value.strip().upper()
    mapping = {
        "PROJECT_MANAGER": "PM",
        "PROJECT MANAGER": "PM",
        "MANAGER": "PM",
        "COLLABORATOR": "COLLABORATORE",
        "FREELANCER": "COLLABORATORE",
        "EMPLOYEE": "DIPENDENTE",
    }
    return mapping.get(raw, raw)


def _matches_role(user: User, role_hint: str | None) -> bool:
    if not role_hint:
        return True

    hint = _role_value(role_hint)
    user_role = user.ruolo.value if hasattr(user.ruolo, "value") else str(user.ruolo)

    if hint == "PM":
        return user_role in {"PM", "ADMIN", "DEVELOPER"}
    if hint == "COLLABORATORE":
        return user_role in {"COLLABORATORE", "DIPENDENTE", "FREELANCER"}
    if hint == "DIPENDENTE":
        return user_role == "DIPENDENTE"
    if hint == "ADMIN":
        return user_role in {"ADMIN", "DEVELOPER"}
    if hint == "DEVELOPER":
        return user_role in {"DEVELOPER", "ADMIN"}
    return user_role == hint


def _user_label(user: User) -> str:
    return f"{user.nome} {user.cognome}".strip()


async def _call_claude(
    *,
    system_prompt: str,
    user_prompt: str,
    model: str,
    max_tokens: int = 1400,
) -> str:
    if not ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI Service not configured",
        )

    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": model,
                "max_tokens": max_tokens,
                "system": system_prompt,
                "messages": [{"role": "user", "content": user_prompt}],
            },
        )

    if response.status_code != 200:
        try:
            error_msg = response.json().get("error", {}).get("message", response.text)
        except Exception:
            error_msg = response.text
        logger.error("Claude API error %s: %s", response.status_code, error_msg)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI Service temporarily unavailable",
        )

    data = response.json()
    return data["content"][0]["text"]


def _extract_json_payload(raw_text: str):
    text = (raw_text or "").strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, flags=re.DOTALL | re.IGNORECASE)
    if fenced:
        text = fenced.group(1).strip()

    start_positions = [pos for pos in (text.find("["), text.find("{")) if pos != -1]
    if start_positions:
        start = min(start_positions)
        end = max(text.rfind("]"), text.rfind("}"))
        if end >= start:
            text = text[start:end + 1]

    payload = json.loads(text)
    if isinstance(payload, dict) and "tasks" in payload:
        return payload["tasks"]
    return payload


def _resolve_assignee(
    *,
    role_hint: str | None,
    service_name: str | None,
    candidate_users: list[User],
    service_user_stats: dict[str, list[dict]],
):
    service_key = _normalize_service(service_name)
    stats = service_user_stats.get(service_key, [])

    filtered_candidates = [user for user in candidate_users if _matches_role(user, role_hint)]
    if not filtered_candidates:
        filtered_candidates = candidate_users

    for stat in stats:
        user = next((candidate for candidate in filtered_candidates if candidate.id == stat["user_id"]), None)
        if user:
            return user

    return filtered_candidates[0] if filtered_candidates else None


async def _load_generation_context(db: AsyncSession, commessa_id, storico_mesi: int = 6):
    commessa_stmt = (
        select(Commessa)
        .options(
            selectinload(Commessa.cliente),
            selectinload(Commessa.righe_progetto)
            .selectinload(CommessaProgetto.progetto)
            .selectinload(Progetto.team)
            .selectinload(ProgettoTeam.user),
            selectinload(Commessa.righe_progetto)
            .selectinload(CommessaProgetto.progetto)
            .selectinload(Progetto.servizi),
        )
        .where(Commessa.id == commessa_id)
    )
    commessa_res = await db.execute(commessa_stmt)
    commessa = commessa_res.scalars().unique().one_or_none()
    if not commessa:
        raise HTTPException(status_code=404, detail="Commessa non trovata")

    project_types = sorted({
        (link.progetto.tipo.value if hasattr(link.progetto.tipo, "value") else str(link.progetto.tipo))
        for link in commessa.righe_progetto
        if link.progetto and link.progetto.tipo
    })

    templates_res = await db.execute(
        select(TaskTemplate)
        .options(selectinload(TaskTemplate.items))
        .where(TaskTemplate.attivo == True)
    )
    templates = [
        template
        for template in templates_res.scalars().unique().all()
        if not template.progetto_tipo or template.progetto_tipo in project_types
    ]

    month_anchor = commessa.mese_competenza or date.today()
    cutoff = month_anchor - relativedelta(months=storico_mesi)

    history_res = await db.execute(
        select(
            Timesheet.servizio,
            func.coalesce(func.avg(Timesheet.durata_minuti), 0),
            func.count(Timesheet.id),
        )
        .join(Commessa, Timesheet.commessa_id == Commessa.id)
        .where(
            and_(
                Commessa.cliente_id == commessa.cliente_id,
                Timesheet.mese_competenza >= cutoff,
            )
        )
        .group_by(Timesheet.servizio)
        .order_by(func.count(Timesheet.id).desc())
    )
    history_by_service = []
    history_avg_map: dict[str, int] = {}
    for servizio, avg_minutes, count in history_res.all():
        item = {
            "servizio": servizio or "Generico",
            "durata_media_minuti": int(float(avg_minutes or 0)),
            "count": int(count or 0),
        }
        history_by_service.append(item)
        history_avg_map[_normalize_service(servizio)] = item["durata_media_minuti"]

    user_service_res = await db.execute(
        select(
            Timesheet.servizio,
            Timesheet.user_id,
            User.nome,
            User.cognome,
            func.count(Timesheet.id),
            func.coalesce(func.avg(Timesheet.durata_minuti), 0),
        )
        .join(Commessa, Timesheet.commessa_id == Commessa.id)
        .join(User, Timesheet.user_id == User.id)
        .where(
            and_(
                Commessa.cliente_id == commessa.cliente_id,
                Timesheet.mese_competenza >= cutoff,
            )
        )
        .group_by(Timesheet.servizio, Timesheet.user_id, User.nome, User.cognome)
        .order_by(func.count(Timesheet.id).desc())
    )
    service_user_stats: dict[str, list[dict]] = defaultdict(list)
    for servizio, user_id, nome, cognome, count, avg_minutes in user_service_res.all():
        service_user_stats[_normalize_service(servizio)].append({
            "user_id": user_id,
            "nome": nome,
            "cognome": cognome,
            "count": int(count or 0),
            "avg_minutes": int(float(avg_minutes or 0)),
        })

    candidate_users_map: dict[str, User] = {}
    for link in commessa.righe_progetto:
        if not link.progetto:
            continue
        for team_link in link.progetto.team:
            if team_link.user and team_link.user.attivo:
                candidate_users_map[str(team_link.user.id)] = team_link.user

    if not candidate_users_map:
        users_res = await db.execute(
            select(User).where(
                User.attivo == True,
                User.ruolo.in_([
                    UserRole.ADMIN,
                    UserRole.DEVELOPER,
                    UserRole.COLLABORATORE,
                    UserRole.DIPENDENTE,
                    UserRole.PM,
                    UserRole.FREELANCER,
                ]),
            )
        )
        for user in users_res.scalars().all():
            candidate_users_map[str(user.id)] = user

    candidate_users = list(candidate_users_map.values())

    return {
        "commessa": commessa,
        "project_types": project_types,
        "templates": templates,
        "history_by_service": history_by_service,
        "history_avg_map": history_avg_map,
        "service_user_stats": service_user_stats,
        "candidate_users": candidate_users,
        "storico_mesi": storico_mesi,
    }


def _build_fallback_suggestions(context: dict, max_ore: int) -> list[AITaskSuggestionOut]:
    templates = context["templates"]
    history_avg_map = context["history_avg_map"]
    service_user_stats = context["service_user_stats"]
    candidate_users = context["candidate_users"]
    minute_budget = max(max_ore, 1) * 60

    suggestions: list[AITaskSuggestionOut] = []
    accumulated = 0

    for template in templates:
        for item in template.items:
            estimate = int(item.stima_minuti or history_avg_map.get(_normalize_service(item.servizio), 90) or 90)
            if accumulated >= minute_budget * 1.2:
                break

            assignee = _resolve_assignee(
                role_hint=item.assegnatario_ruolo,
                service_name=item.servizio,
                candidate_users=candidate_users,
                service_user_stats=service_user_stats,
            )
            suggestions.append(AITaskSuggestionOut(
                titolo=item.titolo,
                servizio=item.servizio or "Generico",
                stima_minuti=max(estimate, 30),
                priorita=_priority_value(item.priorita),
                ruolo_suggerito=_role_value(item.assegnatario_ruolo),
                assegnatario_id=assignee.id if assignee else None,
                assegnatario_nome=_user_label(assignee) if assignee else None,
                rationale="Suggerimento euristico basato su template attivi e storico del cliente.",
            ))
            accumulated += max(estimate, 30)

    if suggestions:
        return suggestions

    for index, history in enumerate(context["history_by_service"][:8]):
        assignee = _resolve_assignee(
            role_hint=None,
            service_name=history["servizio"],
            candidate_users=candidate_users,
            service_user_stats=service_user_stats,
        )
        suggestions.append(AITaskSuggestionOut(
            titolo=f"Operatività {history['servizio']}",
            servizio=history["servizio"],
            stima_minuti=max(int(history["durata_media_minuti"] or 90), 30),
            priorita="media" if index else "alta",
            ruolo_suggerito=assignee.ruolo.value if assignee else None,
            assegnatario_id=assignee.id if assignee else None,
            assegnatario_nome=_user_label(assignee) if assignee else None,
            rationale="Suggerimento euristico basato sui servizi più frequenti nello storico cliente.",
        ))

    return suggestions


def _normalize_generated_suggestions(context: dict, raw_items) -> list[AITaskSuggestionOut]:
    history_avg_map = context["history_avg_map"]
    service_user_stats = context["service_user_stats"]
    candidate_users = context["candidate_users"]

    if not isinstance(raw_items, list):
        return []

    suggestions: list[AITaskSuggestionOut] = []
    for raw in raw_items:
        if not isinstance(raw, dict):
            continue

        title = str(raw.get("titolo") or raw.get("title") or "").strip()
        if not title:
            continue

        service_name = str(raw.get("servizio") or raw.get("service") or "").strip() or "Generico"
        estimate = int(raw.get("stima_minuti") or 0)
        if estimate <= 0:
            estimate = history_avg_map.get(_normalize_service(service_name), 90) or 90

        role_hint = _role_value(raw.get("ruolo_suggerito") or raw.get("role") or raw.get("assegnatario_ruolo"))
        assignee = _resolve_assignee(
            role_hint=role_hint,
            service_name=service_name,
            candidate_users=candidate_users,
            service_user_stats=service_user_stats,
        )

        suggestions.append(AITaskSuggestionOut(
            titolo=title,
            servizio=service_name,
            stima_minuti=max(estimate, 30),
            priorita=_priority_value(raw.get("priorita") or raw.get("priority")),
            ruolo_suggerito=role_hint,
            assegnatario_id=assignee.id if assignee else None,
            assegnatario_nome=_user_label(assignee) if assignee else None,
            rationale=str(raw.get("rationale") or raw.get("ragionamento") or "").strip() or None,
        ))

    return suggestions


@router.post("/chat", response_model=AIChatResponse)
async def ai_chat(
    request: AIChatRequest,
    current_user: User = Depends(get_current_user),
):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI Service not configured",
        )

    system_prompt = """
    Sei l'Assistente AI di Bite Digital, un'agenzia di performance marketing.
    Il tuo compito è aiutare i membri del team a navigare nei dati gestionali.
    Ti verranno forniti dati di contesto in formato JSON su KPI, clienti e commesse.
    Non inventare mai dati mancanti. Rispondi sempre in italiano, in modo conciso e utile.
    """.strip()

    context_str = json.dumps(request.context, indent=2) if request.context else "Nessun contesto fornito."

    try:
        ai_text = await _call_claude(
            system_prompt=system_prompt,
            user_prompt=f"Dati di contesto:\n{context_str}\n\nDomanda: {request.message}",
            model=CLAUDE_CHAT_MODEL,
            max_tokens=1024,
        )
        return AIChatResponse(response=ai_text)
    except httpx.ConnectError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI Service temporarily unavailable",
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unhandled error in AI chat endpoint")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI Service temporarily unavailable",
        )


@router.post(
    "/generate-tasks",
    response_model=AIGenerateTasksResponse,
)
async def generate_tasks_with_ai(
    request: AIGenerateTasksRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    context = await _load_generation_context(db, request.commessa_id, storico_mesi=6)
    commessa = context["commessa"]
    templates = context["templates"]

    response_context = AIGenerateTasksContextOut(
        cliente_nome=commessa.cliente.ragione_sociale if commessa.cliente else "Cliente",
        project_types=context["project_types"],
        storico_mesi=context["storico_mesi"],
        budget_ore=float(request.max_ore),
        template_count=len(templates),
        mese_commessa=commessa.mese_competenza,
    )

    template_payload = [
        {
            "titolo": item.titolo,
            "servizio": item.servizio,
            "stima_minuti": item.stima_minuti,
            "priorita": item.priorita,
            "assegnatario_ruolo": item.assegnatario_ruolo,
        }
        for template in templates
        for item in template.items
    ]

    prompt_payload = {
        "cliente": response_context.cliente_nome,
        "project_types": response_context.project_types,
        "mese_commessa": commessa.mese_competenza.isoformat() if commessa.mese_competenza else None,
        "servizi_storici": context["history_by_service"],
        "templates": template_payload,
        "max_ore": request.max_ore,
        "prompt_extra": request.prompt_extra or "",
    }

    source = "fallback"
    suggestions: list[AITaskSuggestionOut] = []
    if ANTHROPIC_API_KEY:
        system_prompt = (
            "Sei un PM senior di un'agenzia digital. "
            "Genera task realistici per una commessa mensile. "
            "Rispondi solo con JSON puro: un array di oggetti con chiavi "
            "titolo, servizio, stima_minuti, priorita, ruolo_suggerito, rationale. "
            "Mantieni il totale vicino al budget ore indicato e non duplicare task inutilmente."
        )
        try:
            raw_text = await _call_claude(
                system_prompt=system_prompt,
                user_prompt=json.dumps(prompt_payload, ensure_ascii=False, indent=2),
                model=CLAUDE_TASK_MODEL,
                max_tokens=1500,
            )
            parsed = _extract_json_payload(raw_text)
            suggestions = _normalize_generated_suggestions(context, parsed)
            source = "ai"
        except Exception:
            logger.exception("AI task generation failed, fallback to heuristic suggestions")

    if not suggestions:
        suggestions = _build_fallback_suggestions(context, request.max_ore)
        source = "fallback"

    return AIGenerateTasksResponse(
        context=response_context,
        suggestions=suggestions,
        source=source,
    )


@router.post(
    "/estimate-hours",
    response_model=AIEstimateHoursResponse,
)
async def estimate_task_hours(
    request: AIEstimateHoursRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    cutoff = date.today() - relativedelta(months=request.mesi_storico)
    ts_res = await db.execute(
        select(Timesheet.task_display_name, Timesheet.durata_minuti)
        .join(Commessa, Timesheet.commessa_id == Commessa.id)
        .where(
            and_(
                Commessa.cliente_id == request.cliente_id,
                Timesheet.mese_competenza >= cutoff,
                Timesheet.task_display_name.is_not(None),
            )
        )
    )
    rows = ts_res.all()

    scored = []
    for title, minutes in rows:
        label = (title or "").strip()
        if not label:
            continue
        score = SequenceMatcher(None, request.titolo_task.lower(), label.lower()).ratio()
        if request.titolo_task.lower() in label.lower():
            score += 0.25
        if score >= 0.45:
            scored.append({
                "titolo": label,
                "durata": int(minutes or 0),
                "score": score,
            })

    scored.sort(key=lambda item: item["score"], reverse=True)
    similar_items = scored[:5]

    if similar_items:
        avg_minutes = int(sum(item["durata"] for item in similar_items) / max(len(similar_items), 1))
        confidenza = min(0.95, 0.45 + (len(similar_items) * 0.1))
        grouped: dict[str, list[int]] = defaultdict(list)
        for item in similar_items:
            grouped[item["titolo"]].append(item["durata"])

        return AIEstimateHoursResponse(
            stima_minuti=max(avg_minutes, 30),
            confidenza=round(confidenza, 2),
            simili=[
                AIEstimateHoursSimilarOut(
                    titolo=title,
                    durata_avg=int(sum(values) / len(values)),
                    count=len(values),
                )
                for title, values in list(grouped.items())[:5]
            ],
            ragionamento="Stima calcolata sullo storico dei timesheet simili del cliente.",
            source="history",
        )

    if ANTHROPIC_API_KEY:
        try:
            raw_text = await _call_claude(
                system_prompt=(
                    "Sei un PM di agenzia digital. "
                    "Stima in minuti un task singolo e rispondi solo con JSON puro "
                    "con chiavi stima_minuti, confidenza, ragionamento."
                ),
                user_prompt=json.dumps(
                    {
                        "titolo_task": request.titolo_task,
                        "mesi_storico": request.mesi_storico,
                        "cliente_id": str(request.cliente_id),
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
                model=CLAUDE_TASK_MODEL,
                max_tokens=300,
            )
            parsed = _extract_json_payload(raw_text)
            if isinstance(parsed, dict):
                return AIEstimateHoursResponse(
                    stima_minuti=max(int(parsed.get("stima_minuti") or 120), 30),
                    confidenza=round(float(parsed.get("confidenza") or 0.45), 2),
                    ragionamento=str(parsed.get("ragionamento") or "Stima generata dall'AI in assenza di storico sufficiente."),
                    source="ai",
                )
        except Exception:
            logger.exception("AI hour estimate failed, fallback to default estimate")

    return AIEstimateHoursResponse(
        stima_minuti=120,
        confidenza=0.25,
        ragionamento="Storico insufficiente: applicata stima prudenziale di fallback.",
        source="fallback",
    )
