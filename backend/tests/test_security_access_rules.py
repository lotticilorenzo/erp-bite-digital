from __future__ import annotations

import sys
import types
import unittest
import uuid
from pathlib import Path
from types import SimpleNamespace


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

if "aiofiles" not in sys.modules:
    aiofiles_stub = types.ModuleType("aiofiles")
    aiofiles_stub.open = None
    sys.modules["aiofiles"] = aiofiles_stub

from app.api.v1.uploads import ALLOWED_EXTENSIONS  # noqa: E402
from app.api.v1.studio import _node_is_directly_visible, _prune_visible_tree  # noqa: E402
from jose import jwt  # noqa: E402

from app.core.config import Settings, settings  # noqa: E402
from app.core.security import (  # noqa: E402
    CHAT_WS_TOKEN_SCOPE,
    ACCESS_TOKEN_SCOPE,
    create_access_token,
    create_chat_ws_ticket,
    has_finance_access,
    hash_opaque_token,
    is_studio_only_role,
)
from app.models.models import UserRole  # noqa: E402


class SecurityAccessRulesTest(unittest.TestCase):
    def test_finance_access_is_admin_only(self) -> None:
        # DEVELOPER is admin-equivalent (ERP developer account) — full finance access
        self.assertTrue(has_finance_access(UserRole.ADMIN))
        self.assertTrue(has_finance_access(UserRole.DEVELOPER))
        self.assertFalse(has_finance_access(UserRole.PM))
        self.assertFalse(has_finance_access(UserRole.DIPENDENTE))

    def test_studio_only_roles_match_expected_matrix(self) -> None:
        self.assertTrue(is_studio_only_role(UserRole.DIPENDENTE))
        self.assertTrue(is_studio_only_role(UserRole.COLLABORATORE))
        self.assertTrue(is_studio_only_role(UserRole.FREELANCER))
        self.assertFalse(is_studio_only_role(UserRole.ADMIN))
        self.assertFalse(is_studio_only_role(UserRole.DEVELOPER))

    def test_svg_is_not_an_allowed_upload_extension(self) -> None:
        self.assertNotIn(".svg", ALLOWED_EXTENSIONS)
        self.assertIn(".png", ALLOWED_EXTENSIONS)
        self.assertIn(".pdf", ALLOWED_EXTENSIONS)

    def test_scoped_tokens_keep_access_and_ws_separate(self) -> None:
        access_payload = jwt.decode(
            create_access_token({"sub": "user-1"}),
            settings.JWT_SECRET or settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        ws_payload = jwt.decode(
            create_chat_ws_ticket({"sub": "user-1"}),
            settings.JWT_SECRET or settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )

        self.assertEqual(access_payload["scope"], ACCESS_TOKEN_SCOPE)
        self.assertEqual(ws_payload["scope"], CHAT_WS_TOKEN_SCOPE)

    def test_access_tokens_preserve_session_version_claim(self) -> None:
        payload = jwt.decode(
            create_access_token({"sub": "user-1", "ver": 7}),
            settings.JWT_SECRET or settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )

        self.assertEqual(payload["ver"], 7)

    def test_reset_token_hashing_is_deterministic_and_non_plaintext(self) -> None:
        raw_token = "plain-reset-token"
        hashed_once = hash_opaque_token(raw_token)
        hashed_twice = hash_opaque_token(raw_token)

        self.assertEqual(hashed_once, hashed_twice)
        self.assertNotEqual(hashed_once, raw_token)

    def test_studio_only_user_does_not_see_unassigned_public_node(self) -> None:
        user = SimpleNamespace(id=uuid.uuid4(), ruolo=UserRole.DIPENDENTE)
        node = {
            "user_id": None,
            "is_private": False,
            "linked_progetto_id": None,
            "linked_task_id": None,
            "linked_cliente_id": None,
        }

        self.assertFalse(_node_is_directly_visible(node, user, set(), set(), set()))

    def test_visible_child_keeps_ancestor_in_studio_tree(self) -> None:
        user = SimpleNamespace(id=uuid.uuid4(), ruolo=UserRole.DIPENDENTE)
        project_id = uuid.uuid4()
        root = {
            "user_id": None,
            "is_private": False,
            "linked_progetto_id": None,
            "linked_task_id": None,
            "linked_cliente_id": None,
            "children": [
                {
                    "user_id": None,
                    "is_private": False,
                    "linked_progetto_id": project_id,
                    "linked_task_id": None,
                    "linked_cliente_id": None,
                    "children": [],
                }
            ],
        }

        self.assertTrue(_prune_visible_tree(root, user, {project_id}, set(), set()))
        self.assertEqual(len(root["children"]), 1)

    def test_settings_bool_and_host_parsing_handle_enterprise_inputs(self) -> None:
        parsed = Settings(
            DEBUG="release",
            ENABLE_HSTS="true",
            TRUSTED_HOSTS="erp.example.com, api.example.com",
        )

        self.assertFalse(parsed.DEBUG)
        self.assertTrue(parsed.ENABLE_HSTS)
        self.assertEqual(parsed.trusted_hosts_list, ["erp.example.com", "api.example.com"])


if __name__ == "__main__":
    unittest.main()
