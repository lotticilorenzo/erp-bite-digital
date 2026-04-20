from __future__ import annotations

import re
import unicodedata
from typing import Any

from app.models.models import UserRole


CONTENT_MANAGER_ROLES = frozenset({UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM})
LIMITED_CONTENT_ROLES = frozenset({UserRole.DIPENDENTE, UserRole.FREELANCER, UserRole.COLLABORATORE})
GENERIC_TEMPLATE_TOKENS = frozenset(
    {
        "BOZZA",
        "CALL",
        "CAMPAGNA",
        "CLIENTE",
        "CONTENT",
        "CONTENUTO",
        "GESTIONE",
        "KICKOFF",
        "MANAGEMENT",
        "MENSILE",
        "MONTHLY",
        "OPERATIVO",
        "PIANO",
        "PROGETTO",
        "REPORT",
        "RETAINER",
        "REVIEW",
        "REVISIONE",
        "SERVIZIO",
        "TASK",
        "WEEKLY",
    }
)


def normalize_matching_label(value: Any) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", str(value))
    without_accents = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    cleaned = re.sub(r"[^A-Z0-9]+", " ", without_accents.upper())
    return re.sub(r"\s+", " ", cleaned).strip()


def _tokenize_label(value: Any) -> set[str]:
    normalized = normalize_matching_label(value)
    if not normalized:
        return set()
    return {token for token in normalized.split(" ") if len(token) >= 3}


def _commessa_project_types(commessa: Any) -> set[str]:
    project_types: set[str] = set()
    for riga in getattr(commessa, "righe_progetto", []) or []:
        progetto = getattr(riga, "progetto", None)
        tipo = getattr(progetto, "tipo", None) if progetto else None
        if tipo is None:
            continue
        project_types.add(tipo.value if hasattr(tipo, "value") else str(tipo))
    return project_types


def _commessa_project_count(commessa: Any) -> int:
    project_ids: set[str] = set()
    for riga in getattr(commessa, "righe_progetto", []) or []:
        progetto = getattr(riga, "progetto", None)
        if progetto and getattr(progetto, "id", None):
            project_ids.add(str(progetto.id))
    return len(project_ids)


def _commessa_scope_labels(commessa: Any) -> set[str]:
    labels: set[str] = set()
    for riga in getattr(commessa, "righe_progetto", []) or []:
        progetto = getattr(riga, "progetto", None)
        if not progetto:
            continue
        normalized_project_name = normalize_matching_label(getattr(progetto, "nome", None))
        if normalized_project_name:
            labels.add(normalized_project_name)
        for servizio in getattr(progetto, "servizi", []) or []:
            raw_values = [getattr(servizio, "nome", None)]
            servizio_tipo = getattr(servizio, "tipo", None)
            if servizio_tipo:
                raw_values.append(servizio_tipo.value if hasattr(servizio_tipo, "value") else str(servizio_tipo))
            for raw_value in raw_values:
                normalized = normalize_matching_label(raw_value)
                if normalized:
                    labels.add(normalized)
    return labels


def _commessa_service_labels(commessa: Any) -> set[str]:
    labels: set[str] = set()
    for riga in getattr(commessa, "righe_progetto", []) or []:
        progetto = getattr(riga, "progetto", None)
        if not progetto:
            continue
        for servizio in getattr(progetto, "servizi", []) or []:
            raw_values = [getattr(servizio, "nome", None)]
            servizio_tipo = getattr(servizio, "tipo", None)
            if servizio_tipo:
                raw_values.append(servizio_tipo.value if hasattr(servizio_tipo, "value") else str(servizio_tipo))
            for raw_value in raw_values:
                normalized = normalize_matching_label(raw_value)
                if normalized:
                    labels.add(normalized)
    return labels


def _service_label_matches(candidate: Any, available_labels: set[str]) -> bool:
    normalized_candidate = normalize_matching_label(candidate)
    if not normalized_candidate:
        return False
    for label in available_labels:
        if normalized_candidate == label or normalized_candidate in label or label in normalized_candidate:
            return True
    return False


def _template_service_labels(template: Any) -> set[str]:
    labels: set[str] = set()
    for item in getattr(template, "items", []) or []:
        normalized = normalize_matching_label(getattr(item, "servizio", None))
        if normalized:
            labels.add(normalized)
    return labels


def _template_name_matches_service_scope(template_name: Any, service_labels: set[str]) -> bool:
    if _service_label_matches(template_name, service_labels):
        return True

    candidate_tokens = _tokenize_label(template_name) - GENERIC_TEMPLATE_TOKENS
    if not candidate_tokens:
        return False

    for label in service_labels:
        if candidate_tokens.intersection(_tokenize_label(label) - GENERIC_TEMPLATE_TOKENS):
            return True
    return False


def template_matches_commessa(template: Any, commessa: Any) -> bool:
    if not getattr(template, "progetto_tipo", None):
        project_type_ok = True
    else:
        project_type_ok = getattr(template, "progetto_tipo") in _commessa_project_types(commessa)
    if not project_type_ok:
        return False

    explicit_service_labels = _template_service_labels(template)
    commessa_labels = _commessa_scope_labels(commessa)

    if explicit_service_labels:
        return any(_service_label_matches(label, commessa_labels) for label in explicit_service_labels)

    if _commessa_project_count(commessa) <= 1:
        return True

    return _template_name_matches_service_scope(
        getattr(template, "nome", None),
        _commessa_service_labels(commessa),
    )


def is_content_manager_role(role: UserRole | str | None) -> bool:
    return role in CONTENT_MANAGER_ROLES


def is_limited_content_role(role: UserRole | str | None) -> bool:
    return role in LIMITED_CONTENT_ROLES


def can_assign_content_to_user(
    can_manage_content: bool,
    requested_assignee_id: Any,
    current_user_id: Any,
) -> bool:
    return can_manage_content or requested_assignee_id in (None, current_user_id)


def can_link_new_content_to_scope(
    can_manage_content: bool,
    commessa_id: Any,
    progetto_id: Any,
) -> bool:
    return can_manage_content or (commessa_id is None and progetto_id is None)


def can_change_content_scope(
    can_manage_content: bool,
    current_value: Any,
    requested_value: Any,
) -> bool:
    return can_manage_content or requested_value == current_value
