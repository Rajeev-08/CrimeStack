"""Start an isolated disposable database for Playwright; never touches user data."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[1]
folder = tempfile.mkdtemp(prefix="crimestack-e2e-")
os.chdir(root / "apps/api")
os.environ.update(DATABASE_URL=f"sqlite:///{folder}/test.db", BOOTSTRAP_SECRET="e2e-bootstrap-secret", SCHEDULER_ENABLED="false", LLM_API_KEY="")
subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True)
os.execv(sys.executable, [sys.executable, "-m", "uvicorn", "crimestack.main:app", "--host", "127.0.0.1", "--port", "8000"])
