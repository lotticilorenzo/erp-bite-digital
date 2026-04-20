from __future__ import annotations

import sys
import unittest
import uuid
from pathlib import Path
from types import SimpleNamespace


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.content_pipeline_rules import (  # noqa: E402
    can_assign_content_to_user,
    can_change_content_scope,
    can_link_new_content_to_scope,
    is_content_manager_role,
    is_limited_content_role,
    normalize_matching_label,
    template_matches_commessa,
)
from app.models.models import ProjectType, ServiceType, UserRole  # noqa: E402


def make_servizio(nome: str | None = None, tipo: ServiceType | None = None) -> SimpleNamespace:
    return SimpleNamespace(nome=nome, tipo=tipo)


def make_progetto(
    nome: str,
    tipo: ProjectType = ProjectType.RETAINER,
    servizi: list[SimpleNamespace] | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        nome=nome,
        tipo=tipo,
        servizi=servizi or [],
    )


def make_commessa(*progetti: SimpleNamespace) -> SimpleNamespace:
    righe = [SimpleNamespace(progetto=progetto) for progetto in progetti]
    return SimpleNamespace(righe_progetto=righe)


def make_template(
    nome: str,
    progetto_tipo: str | None = ProjectType.RETAINER.value,
    servizi: list[str | None] | None = None,
) -> SimpleNamespace:
    items = [SimpleNamespace(servizio=servizio) for servizio in (servizi or [])]
    return SimpleNamespace(nome=nome, progetto_tipo=progetto_tipo, items=items)


class TemplateMatchingRulesTest(unittest.TestCase):
    def test_normalize_matching_label_strips_accents_and_symbols(self) -> None:
        self.assertEqual(normalize_matching_label("Séo / Ads"), "SEO ADS")

    def test_single_project_commessa_accepts_template_without_service_label(self) -> None:
        commessa = make_commessa(
            make_progetto(
                "Cliente Alpha Social",
                servizi=[make_servizio(nome="Social Media", tipo=ServiceType.SOCIAL)],
            )
        )
        template = make_template("Kickoff Retainer")

        self.assertTrue(template_matches_commessa(template, commessa))

    def test_explicit_service_label_must_match_commessa_scope(self) -> None:
        commessa = make_commessa(
            make_progetto(
                "Cliente Alpha Social",
                servizi=[make_servizio(nome="Social Media", tipo=ServiceType.SOCIAL)],
            )
        )
        matching_template = make_template("Social Monthly", servizi=["Social"])
        wrong_template = make_template("Google Ads Monthly", servizi=["Google Ads"])

        self.assertTrue(template_matches_commessa(matching_template, commessa))
        self.assertFalse(template_matches_commessa(wrong_template, commessa))

    def test_multi_project_fallback_uses_template_name_to_avoid_cross_service_matches(self) -> None:
        commessa = make_commessa(
            make_progetto(
                "Cliente Alpha SEO",
                servizi=[make_servizio(nome="SEO Tecnica")],
            ),
            make_progetto(
                "Cliente Alpha Social",
                servizi=[make_servizio(nome="Social Media", tipo=ServiceType.SOCIAL)],
            ),
        )

        self.assertTrue(template_matches_commessa(make_template("SEO Monthly"), commessa))
        self.assertFalse(template_matches_commessa(make_template("Google Ads Monthly"), commessa))
        self.assertFalse(template_matches_commessa(make_template("Call mensile cliente"), commessa))


class ContentPermissionRulesTest(unittest.TestCase):
    def test_manager_and_limited_roles_are_classified_correctly(self) -> None:
        self.assertTrue(is_content_manager_role(UserRole.ADMIN))
        self.assertTrue(is_content_manager_role(UserRole.PM))
        self.assertFalse(is_content_manager_role(UserRole.COLLABORATORE))
        self.assertTrue(is_limited_content_role(UserRole.DIPENDENTE))
        self.assertTrue(is_limited_content_role(UserRole.COLLABORATORE))
        self.assertFalse(is_limited_content_role(UserRole.DEVELOPER))

    def test_non_manager_cannot_assign_content_to_other_users(self) -> None:
        current_user_id = uuid.uuid4()

        self.assertTrue(can_assign_content_to_user(False, None, current_user_id))
        self.assertTrue(can_assign_content_to_user(False, current_user_id, current_user_id))
        self.assertFalse(can_assign_content_to_user(False, uuid.uuid4(), current_user_id))
        self.assertTrue(can_assign_content_to_user(True, uuid.uuid4(), current_user_id))

    def test_non_manager_cannot_link_new_content_to_commessa_or_progetto(self) -> None:
        self.assertTrue(can_link_new_content_to_scope(False, None, None))
        self.assertFalse(can_link_new_content_to_scope(False, uuid.uuid4(), None))
        self.assertFalse(can_link_new_content_to_scope(False, None, uuid.uuid4()))
        self.assertTrue(can_link_new_content_to_scope(True, uuid.uuid4(), uuid.uuid4()))

    def test_non_manager_cannot_change_existing_scope_values(self) -> None:
        current_value = uuid.uuid4()

        self.assertTrue(can_change_content_scope(False, current_value, current_value))
        self.assertFalse(can_change_content_scope(False, current_value, None))
        self.assertFalse(can_change_content_scope(False, current_value, uuid.uuid4()))
        self.assertTrue(can_change_content_scope(True, current_value, uuid.uuid4()))


if __name__ == "__main__":
    unittest.main()
