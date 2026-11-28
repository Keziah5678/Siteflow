import json
import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
FIXTURE = ROOT / "tests" / "fixtures" / "boamp_2026-11-27.json"


@pytest.fixture(scope="session")
def raw_records():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def _load_env():
    f = ROOT / ".env.local"
    if f.exists():
        for line in f.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k, v)


@pytest.fixture(scope="session")
def db():
    """Base Supabase locale réelle (npx supabase start). Ignoré si indisponible."""
    _load_env()
    from robot.db import DB
    import requests
    url = os.environ.get("SUPABASE_URL")
    try:
        requests.get(url + "/rest/v1/", timeout=3)
    except Exception:
        pytest.skip("Supabase local indisponible")
    return DB(url, os.environ["SUPABASE_SERVICE_ROLE_KEY"])
