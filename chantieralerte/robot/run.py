"""
Robot quotidien de ChantierAlerte.

    python -m robot.run              # exécution normale (GitHub Actions)
    python -m robot.run --force      # ignore la garde « une fois par jour, après 6 h »
    python -m robot.run --dry-run    # ne rien envoyer ni écrire côté emails (MAIL_MODE=log)
    python -m robot.run --fixture f.json --day 2026-11-27   # rejouer un jour BOAMP enregistré

Étapes : 1) avis BOAMP de la veille (+ rattrapage), 2) paiements Stripe,
3) cycle d'essai (rappel J12, fin d'essai), 4) alertes quotidiennes.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from . import boamp, emails
from .db import DB
from .mailer import QuotaReached, from_env
from .matching import detect_trades, matches
from .summary import summarize

log = logging.getLogger("robot")
PARIS = ZoneInfo("Europe/Paris")
CATCHUP_DAYS = 3          # rattrapage si une exécution a été manquée
RETENTION_DAYS = 180      # avis conservés (pages SEO)
MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]


def day_label(d: date) -> str:
    return f"{d.day} {MOIS[d.month - 1]} {d.year}"


def env(name: str, default: str | None = None, required: bool = True) -> str:
    v = os.environ.get(name, default)
    if required and not v:
        raise SystemExit(f"Variable d'environnement manquante : {name}")
    return v or ""


# ---------------------------------------------------------------------------
def ingest(db: DB, days: list[date], fixture: str | None = None) -> dict[str, int]:
    """Récupère, filtre, résume et enregistre les avis. Doublons ignorés (clé idweb)."""
    stats = {"raw": 0, "kept": 0, "with_trade": 0}
    for d in days:
        raw = json.load(open(fixture)) if fixture else boamp.fetch_day(d)
        stats["raw"] += len(raw)
        rows = []
        for r in raw:
            n = boamp.parse_record(r)
            if not n:
                continue
            stats["kept"] += 1
            n.trades = detect_trades(n.objet, n.description, n.cpv, n.descripteurs, n.type_marche)
            if not n.trades:
                continue
            n.summary = summarize(n.objet, n.acheteur, n.ville, n.departments, n.montant)
            rows.append(n.to_row())
        # Un avis peut apparaître deux fois dans l'export : dédoublonnage local.
        unique = list({r["idweb"]: r for r in rows}.values())
        db.upsert("notices", unique, on_conflict="idweb")
        stats["with_trade"] += len(unique)
        log.info("%s : %d avis retenus avec métier", d, len(unique))
    return stats


def trial_lifecycle(db: DB, mailer, cfg: dict, now: datetime) -> dict[str, int]:
    stats = {"reminders": 0, "trials_ended": 0}
    subs = db.select("subscribers", {"status": "eq.trial", "select": "*"})
    for s in subs:
        end = datetime.fromisoformat(s["trial_ends_at"])
        lk = emails.links(cfg["site_url"], cfg["functions_url"], s, cfg["payment_link"])
        if end <= now:
            db.update("subscribers", {"id": f"eq.{s['id']}", "status": "eq.trial"}, {"status": "expired"})
            if not s.get("trial_ended_notice_sent_at"):
                try:
                    mailer.send(emails.trial_ended(s, lk, cfg["footer_legal"]))
                    db.update("subscribers", {"id": f"eq.{s['id']}"}, {"trial_ended_notice_sent_at": now.isoformat()})
                except QuotaReached:
                    pass
            stats["trials_ended"] += 1
        elif end - now <= timedelta(days=2) and not s.get("trial_reminder_sent_at"):
            # Jour 12 de l'essai : « Votre essai se termine bientôt »
            sent = db.select("sent_notices", {"subscriber_id": f"eq.{s['id']}", "select": "idweb"})
            try:
                mailer.send(emails.trial_reminder(s, len(sent), lk, cfg["footer_legal"]))
                db.update("subscribers", {"id": f"eq.{s['id']}"}, {"trial_reminder_sent_at": now.isoformat()})
                stats["reminders"] += 1
            except QuotaReached:
                pass
    return stats


def send_alerts(db: DB, mailer, cfg: dict, now: datetime, today: date) -> dict[str, int]:
    stats = {"recipients": 0, "emails": 0, "notices_sent": 0, "skipped_quota": 0, "errors": 0}
    since = today - timedelta(days=CATCHUP_DAYS + 1)
    pool = db.select("notices", {"date_parution": f"gte.{since.isoformat()}", "select": "*", "order": "date_parution.desc,idweb.asc"})
    # Seuls les avis dont la date limite n'est pas dépassée.
    pool = [n for n in pool if not n.get("date_limite") or datetime.fromisoformat(n["date_limite"]) > now]
    subs = db.recipients()  # payants d'abord (enum : trial < active, tri descendant)
    for s in subs:
        stats["recipients"] += 1
        cands = [n for n in pool if matches(n["trades"], n["departments"], s["trades"], s["departments"])]
        if s.get("confirmed_at"):
            confirmed = datetime.fromisoformat(s["confirmed_at"]).date()
            cands = [n for n in cands if date.fromisoformat(n["date_parution"]) >= confirmed - timedelta(days=1)]
        if not cands:
            continue  # rien à signaler → pas d'email
        already = db.already_sent(s["id"], [n["idweb"] for n in cands])
        fresh = [n for n in cands if n["idweb"] not in already]
        if not fresh:
            continue
        fresh.sort(key=lambda n: n.get("date_limite") or "9999")
        fresh = fresh[:30]  # un email lisible
        lk = emails.links(cfg["site_url"], cfg["functions_url"], s, cfg["payment_link"])
        msg = emails.daily_alert(s, fresh, day_label(max(date.fromisoformat(n["date_parution"]) for n in fresh)), lk, cfg["footer_legal"], now)
        try:
            mailer.send(msg)
        except QuotaReached:
            stats["skipped_quota"] += 1
            continue
        except Exception as e:  # un échec d'envoi ne bloque pas les autres abonnés
            log.error("Envoi échoué pour %s : %s", s["id"], e)
            stats["errors"] += 1
            continue
        db.upsert("sent_notices", [{"subscriber_id": s["id"], "idweb": n["idweb"], "sent_at": now.isoformat()} for n in fresh], on_conflict="subscriber_id,idweb", ignore_duplicates=True)
        db.update("subscribers", {"id": f"eq.{s['id']}"}, {"last_email_at": now.isoformat()})
        stats["emails"] += 1
        stats["notices_sent"] += len(fresh)
    return stats


def already_ran_today(db: DB, today: date) -> bool:
    start = datetime.combine(today, datetime.min.time(), PARIS).astimezone(timezone.utc).isoformat()
    rows = db.select("runs", {"status": "eq.success", "started_at": f"gte.{start}", "select": "id"})
    return bool(rows)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--force", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--fixture")
    p.add_argument("--day", help="jour BOAMP à traiter (AAAA-MM-JJ), par défaut la veille")
    a = p.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if a.dry_run:
        os.environ["MAIL_MODE"] = "log"

    db = DB(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"))
    now = datetime.now(timezone.utc)
    paris_now = now.astimezone(PARIS)
    today = paris_now.date()
    if not a.force:
        if paris_now.hour < 6:
            log.info("Il est %s à Paris : trop tôt, le robot attend 6 h.", paris_now.strftime("%H:%M"))
            return 0
        if already_ran_today(db, today):
            log.info("Déjà exécuté aujourd'hui : rien à faire.")
            return 0

    from .build_site import load_config
    site_cfg = load_config()  # config/site.json (lien Stripe, URL du site…), surchargeable par l'environnement
    supabase_url = env("SUPABASE_URL").rstrip("/")
    cfg = {
        "site_url": site_cfg["site_url"],
        "functions_url": os.environ.get("FUNCTIONS_URL") or f"{supabase_url}/functions/v1",
        "payment_link": site_cfg["stripe_payment_link"] or None,
        "footer_legal": os.environ.get("MAIL_FOOTER_LEGAL") or f"{site_cfg['editeur']['nom_ou_raison_sociale']} — {site_cfg['contact_email']}".replace("A_REMPLIR", "").strip(" —"),
    }
    # Signale à GitHub Actions que le robot a réellement tourné (→ régénérer le site).
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as f:
            f.write("ran=true\n")
    run = db.insert("runs", {"status": "running"}, returning=True)
    stats: dict[str, object] = {}
    status, error = "success", None
    try:
        mailer = from_env(db)
        # 1. Avis : la veille + rattrapage des jours manqués
        if a.day:
            days = [date.fromisoformat(a.day)]
        else:
            days = [today - timedelta(days=i) for i in range(1, CATCHUP_DAYS + 1)]
            days.reverse()
        try:
            stats["boamp"] = ingest(db, days, a.fixture)
        except boamp.BoampUnavailable as e:
            # API en panne : on envoie quand même ce qui est déjà en base (rattrapage demain).
            log.error("%s", e)
            stats["boamp_error"] = str(e)
            status = "partial"
        # 2. Paiements
        if os.environ.get("STRIPE_SECRET_KEY"):
            from .stripe_sync import Stripe, sync
            try:
                stats["stripe"] = sync(db, Stripe(os.environ["STRIPE_SECRET_KEY"]), now)
            except Exception as e:
                log.error("Vérification Stripe impossible : %s", e)
                stats["stripe_error"] = str(e)
                status = "partial"
        # 3. Essais
        stats["trials"] = trial_lifecycle(db, mailer, cfg, now)
        # 4. Alertes
        stats["alerts"] = send_alerts(db, mailer, cfg, now, today)
        stats["mail_quota_left"] = mailer.remaining
        # Ménage + durées de conservation annoncées dans la politique de confidentialité
        db._req("DELETE", "/notices", params={"date_parution": f"lt.{(today - timedelta(days=RETENTION_DAYS)).isoformat()}"})
        db._req("DELETE", "/subscribers", params={"status": "eq.pending", "created_at": f"lt.{(now - timedelta(days=30)).isoformat()}"})
        three_years = (now - timedelta(days=3 * 365)).isoformat()
        db._req("DELETE", "/subscribers", params={"status": "in.(unsubscribed,expired)", "created_at": f"lt.{three_years}",
                                                   "or": f"(last_email_at.is.null,last_email_at.lt.{three_years})", "stripe_subscription_id": "is.null"})
    except Exception as e:
        status, error = "error", f"{type(e).__name__}: {e}"
        log.exception("Échec du robot")
    finally:
        db.update("runs", {"id": f"eq.{run['id']}"}, {"status": status, "finished_at": datetime.now(timezone.utc).isoformat(), "stats": stats, "error": error})
    log.info("Terminé (%s) : %s", status, json.dumps(stats, ensure_ascii=False))
    return 1 if status == "error" else 0


if __name__ == "__main__":
    sys.exit(main())
