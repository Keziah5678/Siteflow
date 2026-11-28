"""Accès à Supabase via son API REST (PostgREST), avec la clé service_role.

Utilisé uniquement côté serveur (robot GitHub Actions). La clé n'est jamais
exposée au navigateur.
"""
from __future__ import annotations

import logging
import time
from typing import Any, Iterable

import requests

log = logging.getLogger(__name__)


class DB:
    def __init__(self, url: str, service_key: str, session: requests.Session | None = None):
        self.base = url.rstrip("/") + "/rest/v1"
        self.s = session or requests.Session()
        self.s.headers.update({"apikey": service_key, "Authorization": f"Bearer {service_key}", "Content-Type": "application/json"})

    def _req(self, method: str, path: str, attempts: int = 4, **kw: Any) -> requests.Response:
        for i in range(1, attempts + 1):
            try:
                r = self.s.request(method, self.base + path, timeout=60, **kw)
                if r.status_code >= 500:
                    raise requests.HTTPError(f"{r.status_code} {r.text[:200]}", response=r)
                if r.status_code >= 400:
                    raise RuntimeError(f"Supabase {method} {path} → {r.status_code}: {r.text[:300]}")
                return r
            except (requests.ConnectionError, requests.Timeout, requests.HTTPError) as e:
                if i == attempts:
                    raise
                log.warning("Supabase indisponible (%s), nouvel essai…", e)
                time.sleep(3 * i)
        raise AssertionError("unreachable")

    # -- génériques -----------------------------------------------------------
    def select(self, table: str, params: dict[str, str] | None = None) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        offset, page = 0, 1000
        while True:
            r = self._req("GET", f"/{table}", params=params or {}, headers={"Range": f"{offset}-{offset + page - 1}"})
            batch = r.json()
            rows.extend(batch)
            if len(batch) < page:
                return rows
            offset += page

    def upsert(self, table: str, rows: list[dict[str, Any]], on_conflict: str, ignore_duplicates: bool = False) -> None:
        for i in range(0, len(rows), 500):
            pref = "resolution=ignore-duplicates" if ignore_duplicates else "resolution=merge-duplicates"
            self._req("POST", f"/{table}", params={"on_conflict": on_conflict}, json=rows[i : i + 500], headers={"Prefer": f"{pref},return=minimal"})

    def update(self, table: str, match: dict[str, str], values: dict[str, Any]) -> None:
        self._req("PATCH", f"/{table}", params=match, json=values, headers={"Prefer": "return=minimal"})

    def insert(self, table: str, row: dict[str, Any], returning: bool = False) -> dict[str, Any] | None:
        r = self._req("POST", f"/{table}", json=row, headers={"Prefer": "return=representation" if returning else "return=minimal"})
        return r.json()[0] if returning else None

    def rpc(self, fn: str, args: dict[str, Any]) -> Any:
        return self._req("POST", f"/rpc/{fn}", json=args).json()

    # -- métier ---------------------------------------------------------------
    def recipients(self) -> list[dict[str, Any]]:
        """Abonnés à servir : essai confirmé ou payant."""
        return self.select("subscribers", {"status": "in.(trial,active)", "select": "*", "order": "status.desc,created_at.asc"})

    def already_sent(self, subscriber_id: str, idwebs: Iterable[str]) -> set[str]:
        ids = list(idwebs)
        if not ids:
            return set()
        rows = self.select("sent_notices", {"subscriber_id": f"eq.{subscriber_id}", "idweb": f"in.({','.join(ids)})", "select": "idweb"})
        return {r["idweb"] for r in rows}
