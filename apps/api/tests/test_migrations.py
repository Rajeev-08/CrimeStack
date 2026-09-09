import os
import subprocess
import sys
import sqlite3


def test_migration_roundtrip_and_safe_defaults(tmp_path):
    path = tmp_path / "migration.db"
    env = {**os.environ, "DATABASE_URL": f"sqlite:///{path}"}

    def migrate(*args):
        result = subprocess.run(
            [sys.executable, "-m", "alembic", *args], env=env, capture_output=True, text=True
        )
        assert result.returncode == 0, result.stderr

    migrate("upgrade", "0001")
    with sqlite3.connect(path) as db:
        db.execute(
            "INSERT INTO datasets (id,name,publisher,quality,checksum,created_at) VALUES ('legacy','Legacy','Unknown','{}','test','2026-01-01')"
        )
    migrate("upgrade", "head")
    migrate("downgrade", "-1")
    migrate("upgrade", "head")
    with sqlite3.connect(path) as db:
        assert (
            db.execute("SELECT provenance FROM datasets WHERE id='legacy'").fetchone()[0]
            == "uploaded_unverified"
        )
        db.execute("INSERT INTO audit (id,payload,previous,digest) VALUES (1,'{}','0','x')")
        import pytest

        with pytest.raises(sqlite3.IntegrityError):
            db.execute("UPDATE audit SET digest='changed'")
