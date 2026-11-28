"""Vérification quotidienne des paiements Stripe (sans webhook).

Le lien de paiement Stripe (Payment Link) est ouvert avec
`client_reference_id=<id abonné>` et `prefilled_email=<email>`. Chaque matin :
  1. les sessions de paiement terminées des 7 derniers jours activent les abonnés ;
  2. les abonnements résiliés ou impayés repassent l'abonné en « expired ».
Idempotent : relancer le robot ne change rien de plus.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Iterator

import requests

log = logging.getLogger(__name__)
API = "https://api.stripe.com/v1"
ACTIVE = {"active", "trialing", "past_due"}
ENDED = {"canceled", "unpaid", "incomplete_expired"}


class Stripe:
    def __init__(self, secret_key: str, session: requests.Session | None = None):
        if secret_key.startswith("sk_live_"):
            log.info("Stripe : clé LIVE utilisée")
        self.s = session or requests.Session()
        self.s.auth = (secret_key, "")

    def list(self, path: str, params: dict[str, Any]) -> Iterator[dict[str, Any]]:
        params = {**params, "limit": 100}
        while True:
            for attempt in range(1, 4):
                r = self.s.get(f"{API}{path}", params=params, timeout=30)
                if r.status_code == 429 or r.status_code >= 500:
                    time.sleep(3 * attempt)
                    continue
                break
            if r.status_code != 200:
                raise RuntimeError(f"Stripe {path} → {r.status_code}: {r.text[:200]}")
            data = r.json()
            yield from data["data"]
            if not data.get("has_more"):
                return
            params["starting_after"] = data["data"][-1]["id"]


def sync(db, stripe: Stripe, now: datetime | None = None) -> dict[str, int]:
    now = now or datetime.now(timezone.utc)
    stats = {"activated": 0, "ended": 0}
    subs = db.select("subscribers", {"select": "id,email,status,stripe_subscription_id"})
    by_id = {s["id"]: s for s in subs}
    by_email = {s["email"].lower(): s for s in subs}

    # 1. Paiements terminés → statut payant
    since = int((now - timedelta(days=7)).timestamp())
    for cs in stripe.list("/checkout/sessions", {"status": "complete", "created[gte]": since}):
        if cs.get("mode") != "subscription" or cs.get("payment_status") not in ("paid", "no_payment_required"):
            continue
        sub = by_id.get(cs.get("client_reference_id") or "") or by_email.get(((cs.get("customer_details") or {}).get("email") or "").lower())
        if not sub or sub.get("stripe_subscription_id") == cs.get("subscription"):
            continue
        db.update("subscribers", {"id": f"eq.{sub['id']}"}, {
            "status": "active" if sub["status"] != "unsubscribed" else "unsubscribed",
            "stripe_customer_id": cs.get("customer"), "stripe_subscription_id": cs.get("subscription"),
            "paid_at": now.isoformat(),
        })
        sub["stripe_subscription_id"] = cs.get("subscription")
        stats["activated"] += 1
        log.info("Stripe : abonné %s activé", sub["id"])

    # 2. Abonnements résiliés / impayés → fin de l'accès
    paying = {s["stripe_subscription_id"]: s for s in subs if s.get("stripe_subscription_id")}
    if paying:
        for st in stripe.list("/subscriptions", {"status": "all"}):
            sub = paying.get(st["id"])
            if not sub:
                continue
            if st["status"] in ENDED and sub["status"] == "active":
                db.update("subscribers", {"id": f"eq.{sub['id']}"}, {"status": "expired"})
                stats["ended"] += 1
            elif st["status"] in ACTIVE and sub["status"] == "expired":
                db.update("subscribers", {"id": f"eq.{sub['id']}"}, {"status": "active"})
                stats["activated"] += 1
    return stats
