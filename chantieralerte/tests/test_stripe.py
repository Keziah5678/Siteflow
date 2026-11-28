"""Vérification quotidienne des paiements Stripe (sans webhook)."""
import os
from datetime import datetime, timezone

import pytest

from robot.stripe_sync import Stripe, sync

NOW = datetime(2026, 11, 28, 6, tzinfo=timezone.utc)


class FakeStripe:
    def __init__(self, sessions=(), subscriptions=()):
        self.data = {"/checkout/sessions": list(sessions), "/subscriptions": list(subscriptions)}

    def list(self, path, params):
        yield from self.data[path]


@pytest.fixture()
def subs(db):
    db._req("DELETE", "/subscribers", params={"created_at": "lt.2100-01-01"})
    a = db.insert("subscribers", {"email": "paie@test.fr", "trades": ["plomberie"], "departments": ["33"], "status": "trial"}, returning=True)
    b = db.insert("subscribers", {"email": "parmail@test.fr", "trades": ["peinture"], "departments": ["33"], "status": "expired"}, returning=True)
    return db, a, b


def status(db, s):
    return db.select("subscribers", {"id": f"eq.{s['id']}", "select": "status,stripe_subscription_id,paid_at"})[0]


def test_completed_checkout_activates_by_reference_or_email(subs):
    db, a, b = subs
    fake = FakeStripe(sessions=[
        {"mode": "subscription", "payment_status": "paid", "client_reference_id": a["id"], "customer": "cus_1", "subscription": "sub_1", "customer_details": {"email": "paie@test.fr"}},
        {"mode": "subscription", "payment_status": "paid", "client_reference_id": None, "customer": "cus_2", "subscription": "sub_2", "customer_details": {"email": "ParMail@test.fr"}},
        {"mode": "payment", "payment_status": "paid", "client_reference_id": a["id"]},  # paiement ponctuel : ignoré
        {"mode": "subscription", "payment_status": "unpaid", "client_reference_id": b["id"], "subscription": "sub_x"},  # non payé : ignoré
    ])
    assert sync(db, fake, NOW) == {"activated": 2, "ended": 0}
    assert status(db, a)["status"] == "active" and status(db, a)["stripe_subscription_id"] == "sub_1"
    assert status(db, b)["status"] == "active"
    assert sync(db, fake, NOW) == {"activated": 0, "ended": 0}  # idempotent


def test_canceled_subscription_ends_access_and_reactivation_restores_it(subs):
    db, a, _ = subs
    sync(db, FakeStripe(sessions=[{"mode": "subscription", "payment_status": "paid", "client_reference_id": a["id"], "customer": "c", "subscription": "sub_9"}]), NOW)
    assert sync(db, FakeStripe(subscriptions=[{"id": "sub_9", "status": "canceled"}]), NOW)["ended"] == 1
    assert status(db, a)["status"] == "expired"
    assert sync(db, FakeStripe(subscriptions=[{"id": "sub_9", "status": "active"}]), NOW)["activated"] == 1
    assert status(db, a)["status"] == "active"


def test_unsubscribed_user_who_pays_stays_unsubscribed(subs):
    db, a, _ = subs
    db.update("subscribers", {"id": f"eq.{a['id']}"}, {"status": "unsubscribed"})
    sync(db, FakeStripe(sessions=[{"mode": "subscription", "payment_status": "paid", "client_reference_id": a["id"], "customer": "c", "subscription": "sub_u"}]), NOW)
    assert status(db, a)["status"] == "unsubscribed" and status(db, a)["stripe_subscription_id"] == "sub_u"


@pytest.mark.skipif(not os.environ.get("STRIPE_LIVE_TEST"), reason="STRIPE_LIVE_TEST=1 pour interroger l'API Stripe réelle (mode test)")
def test_real_stripe_api_is_readable():
    s = Stripe(os.environ.get("STRIPE_SECRET_KEY", "sk_test_proxy_injected"))
    list(s.list("/checkout/sessions", {"status": "complete", "created[gte]": 1}))
    list(s.list("/subscriptions", {"status": "all"}))
