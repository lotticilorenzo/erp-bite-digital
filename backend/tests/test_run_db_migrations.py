import tempfile
import unittest
from pathlib import Path

from scripts.run_db_migrations import discover_migration_files, validate_applied_migrations


class RunDbMigrationsTests(unittest.TestCase):
    def test_discover_migration_files_returns_sorted_entries(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            (tmp_path / "20260430_b.sql").write_text("SELECT 2;", encoding="utf-8")
            (tmp_path / "20260429_a.sql").write_text("SELECT 1;", encoding="utf-8")

            migration_files = discover_migration_files(tmp_path)

            self.assertEqual(
                [migration.name for migration in migration_files],
                ["20260429_a.sql", "20260430_b.sql"],
            )
            self.assertTrue(all(migration.checksum for migration in migration_files))

    def test_validate_applied_migrations_fails_on_checksum_mismatch(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            (tmp_path / "20260430_alignment.sql").write_text("SELECT 1;", encoding="utf-8")

            migration_files = discover_migration_files(tmp_path)

            with self.assertRaises(SystemExit):
                validate_applied_migrations(
                    {migration_files[0].version: "checksum-diverso"},
                    migration_files,
                )


if __name__ == "__main__":
    unittest.main()
