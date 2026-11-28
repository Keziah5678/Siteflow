"""Robot de bout en bout sur la base Supabase locale réelle et des avis BOAMP réels."""
from datetime import date, datetime, timedelta, timezone

import pytest

from robot import boamp, run
from robot.emails import links
from robot.mailer import LogTransport, Mailer
from tests.conftest import FIXTURE

DAY = date(2026, 11, 27)
NOW = datetime(2026, 11, 28, 6, 5, tzinfo=timezone.utc)
CFG = {"site_url": "https://exemple.test", "functions_url": "https://fn.test/functions/v1", "payment_link": "https://buy.stripe.com/test_abc", "footer_legal": "Éditeur — contact@exemple.test"}


@pytest.fixture()
def clean(db):
    for t in ("outbox", "sent_notices", "notices", "runs", "subscribers"):
        db._req("DELETE", f"/{t}", params={"created_at" if t in ("outbox", "subscribers") else ("sent_at" if t == "sent_notices" else ("fetched_at" if t == "notices" else "started_at")): "lt.2100-01-01"})
    run.ingest(db, [DAY], str(FIXTURE))
    return db


def add(db, email, trades, depts, status="trial", confirmed=DAY - timedelta(days=1), trial_end=NOW + timedelta(days=10), **extra):
    return db.insert("subscribers", {"email": email, "trades": trades, "departments": depts, "status": status,
                                     "confirmed_at": confirmed.isoformat() if confirmed else None,
                                     "trial_ends_at": trial_end.isoformat() if trial_end else None, **extra}, returning=True)


def mailer(limit=290):
    return Mailer(LogTransport(), limit)


def test_alert_sent_once_and_only_matching_notices(clean):
    db = clean
    s = add(db, "plombier@test.fr", ["plomberie", "chauffage"], ["94", "75"])
    m = mailer()
    st = run.send_alerts(db, m, CFG, NOW, NOW.date())
    assert st["emails"] == 1
    mail = m.t.sent[0]
    assert mail.subject.endswith("pour vous") and mail.to == "plombier@test.fr"
    assert "Créteil (94)" in mail.html and "Schiltigheim" not in mail.html  # chantier en Alsace exclu
    assert "Modifier mes préférences" in mail.html and "Se désinscrire" in mail.html
    assert "client_reference_id=" + s["id"] in mail.html.replace("&amp;", "&")
    assert mail.unsubscribe_url == f"https://fn.test/functions/v1/unsubscribe?t={s['token']}"
    # Relance le même jour : aucun doublon.
    m2 = mailer()
    assert run.send_alerts(db, m2, CFG, NOW, NOW.date())["emails"] == 0 and not m2.t.sent


def test_no_email_when_nothing_matches(clean):
    add(clean, "rien@test.fr", ["etancheite"], ["976"])
    m = mailer()
    assert run.send_alerts(clean, m, CFG, NOW, NOW.date())["emails"] == 0 and not m.t.sent


def test_pending_expired_and_unsubscribed_get_nothing(clean):
    for st in ("pending", "expired", "unsubscribed"):
        add(clean, f"{st}@test.fr", ["plomberie"], ["94"], status=st)
    m = mailer()
    assert run.send_alerts(clean, m, CFG, NOW, NOW.date())["emails"] == 0


def test_backlog_before_signup_not_sent(clean):
    add(clean, "tardif@test.fr", ["plomberie"], ["94"], confirmed=DAY + timedelta(days=5))
    assert run.send_alerts(clean, mailer(), CFG, NOW + timedelta(days=5), (NOW + timedelta(days=5)).date())["emails"] == 0


def test_expired_deadlines_not_sent(clean):
    add(clean, "plombier@test.fr", ["plomberie"], ["94"])
    later = datetime(2027, 6, 1, tzinfo=timezone.utc)
    assert run.send_alerts(clean, mailer(), CFG, later, DAY)["emails"] == 0


def test_daily_quota_serves_paying_customers_first(clean):
    add(clean, "essai@test.fr", ["plomberie"], ["94"])
    add(clean, "payant@test.fr", ["plomberie"], ["94"], status="active", trial_end=None, paid_at=NOW.isoformat())
    m = mailer(limit=1)
    st = run.send_alerts(clean, m, CFG, NOW, NOW.date())
    assert [x.to for x in m.t.sent] == ["payant@test.fr"] and st["skipped_quota"] == 1
    # Le lendemain, l'abonné en essai reçoit bien ses avis (rien n'est perdu).
    m2 = mailer()
    assert run.send_alerts(clean, m2, CFG, NOW + timedelta(days=1), NOW.date() + timedelta(days=1))["emails"] == 1


def test_trial_reminder_on_day_12_then_end_of_trial(clean):
    db = clean
    s = add(db, "essai@test.fr", ["plomberie"], ["94"], trial_end=NOW + timedelta(days=2) - timedelta(minutes=5))
    m = mailer()
    assert run.trial_lifecycle(db, m, CFG, NOW)["reminders"] == 1
    assert m.t.sent[0].subject == "Votre essai se termine bientôt"
    assert run.trial_lifecycle(db, m, CFG, NOW)["reminders"] == 0  # une seule fois
    st = run.trial_lifecycle(db, m, CFG, NOW + timedelta(days=3))
    assert st["trials_ended"] == 1 and m.t.sent[-1].subject == "Votre essai gratuit est terminé"
    row = db.select("subscribers", {"id": f"eq.{s['id']}", "select": "status"})[0]
    assert row["status"] == "expired"
    assert run.send_alerts(db, mailer(), CFG, NOW + timedelta(days=3), NOW.date())["emails"] == 0


def test_payment_link_carries_subscriber_id():
    lk = links("https://site.test/", None, {"token": "tok", "email": "a@b.fr", "id": "123"}, "https://buy.stripe.com/x")
    assert lk["pay_url"] == "https://buy.stripe.com/x?prefilled_email=a%40b.fr&client_reference_id=123"
    assert lk["unsub_url"] == "https://site.test/desinscription.html?t=tok"
    assert links("https://site.test", None, {"token": "t", "email": "e", "id": "1"}, None)["pay_url"] == "https://site.test/abonnement.html"


def test_ingest_is_idempotent(clean):
    before = len(clean.select("notices", {"select": "idweb"}))
    run.ingest(clean, [DAY], str(FIXTURE))
    assert len(clean.select("notices", {"select": "idweb"})) == before > 0


def test_boamp_down_partial_run_still_sends_known_notices(clean, monkeypatch):
    add(clean, "plombier@test.fr", ["plomberie"], ["94"])
    monkeypatch.setenv("MAIL_MODE", "outbox")
    monkeypatch.setenv("SITE_URL", "https://exemple.test")

    def down(*a, **k):
        raise boamp.BoampUnavailable("API BOAMP indisponible (test)")
    monkeypatch.setattr(boamp, "fetch_day", down)
    assert run.main(["--force"]) == 0
    last = clean.select("runs", {"select": "status,stats", "order": "id.desc", "limit": "1"})[0]
    assert last["status"] == "partial" and "boamp_error" in last["stats"]
    assert last["stats"]["alerts"]["emails"] == 1


def test_fetch_day_retries_then_raises(monkeypatch):
    calls = {"n": 0}

    class S:
        def get(self, *a, **k):
            calls["n"] += 1
            raise boamp.requests.ConnectionError("coupure")
    with pytest.raises(boamp.BoampUnavailable):
        boamp.fetch_day(DAY, session=S(), attempts=3, backoff=0)
    assert calls["n"] == 3


def test_runs_once_per_day_after_6am(clean, monkeypatch):
    monkeypatch.setenv("MAIL_MODE", "log")
    monkeypatch.setattr(boamp, "fetch_day", lambda d, **k: [])

    class FakeDT(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(2026, 11, 28, 4, 30, tzinfo=timezone.utc)  # 5 h 30 à Paris
    monkeypatch.setattr(run, "datetime", FakeDT)
    assert run.main([]) == 0
    assert clean.select("runs", {"select": "id"}) == []  # trop tôt : rien n'a tourné
    FakeDT.now = classmethod(lambda cls, tz=None: datetime(2026, 11, 28, 5, 10, tzinfo=timezone.utc))  # 6 h 10
    assert run.main([]) == 0
    assert len(clean.select("runs", {"select": "id"})) == 1
    assert run.main([]) == 0
    assert len(clean.select("runs", {"select": "id"})) == 1  # déjà fait aujourd'hui
