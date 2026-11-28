"""Contenu des emails (HTML simple + texte brut). Jinja2 avec échappement automatique."""
from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import urlencode

from jinja2 import Environment
from markupsafe import Markup

from .mailer import Email
from .summary import deadline_fr
from .trades import TRADES_BY_SLUG

env = Environment(autoescape=True, trim_blocks=True, lstrip_blocks=True)

LAYOUT = """<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{ title }}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<span style="display:none;max-height:0;overflow:hidden">{{ preheader }}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7"><tr><td align="center" style="padding:16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:10px">
<tr><td style="padding:20px 22px 8px"><span style="font-size:18px;font-weight:bold;color:#c2410c">Chantier</span><span style="font-size:18px;font-weight:bold;color:#111827">Alerte</span></td></tr>
{{ body }}
<tr><td style="padding:18px 22px 22px;font-size:12px;line-height:18px;color:#6b7280;border-top:1px solid #e5e7eb">
{% if trial_days is not none %}Essai gratuit : encore {{ trial_days }} jour{{ 's' if trial_days > 1 }}. <a href="{{ pay_url }}" style="color:#c2410c">Continuer pour 12 €/mois</a><br>{% endif %}
Vous recevez cet email car vous êtes inscrit à ChantierAlerte.<br>
<a href="{{ prefs_url }}" style="color:#6b7280">Modifier mes préférences</a> · <a href="{{ unsub_url }}" style="color:#6b7280">Se désinscrire en un clic</a>
{% if footer_legal %}<br>{{ footer_legal }}{% endif %}
</td></tr></table></td></tr></table></body></html>"""

DAILY_BODY = """
<tr><td style="padding:4px 22px 6px"><h1 style="margin:8px 0 4px;font-size:21px;line-height:28px;color:#111827">{{ n }} nouveau{{ 'x' if n > 1 }} chantier{{ 's' if n > 1 }} pour vous</h1>
<p style="margin:0 0 6px;font-size:14px;color:#4b5563">{{ scope }} — avis publiés le {{ day }}.</p></td></tr>
{% for it in items %}
<tr><td style="padding:10px 22px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px"><tr><td style="padding:14px">
<p style="margin:0 0 4px;font-size:15px;line-height:21px;font-weight:bold;color:#111827">{{ it.line1 }}</p>
{% if it.line2 %}<p style="margin:0 0 8px;font-size:13px;line-height:19px;color:#4b5563">{{ it.line2 }}</p>{% endif %}
<p style="margin:0 0 10px;font-size:13px;color:#111827">Date limite : <strong style="color:{{ '#b91c1c' if it.urgent else '#111827' }}">{{ it.deadline }}</strong>{% if it.trades %} · <span style="color:#6b7280">{{ it.trades }}</span>{% endif %}</p>
<a href="{{ it.url }}" style="display:inline-block;background:#c2410c;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:9px 14px;border-radius:6px">Voir l'avis</a>
</td></tr></table></td></tr>
{% endfor %}
"""

NOTICE_BODY = """
<tr><td style="padding:4px 22px 18px"><h1 style="margin:8px 0 10px;font-size:21px;line-height:28px;color:#111827">{{ heading }}</h1>
{% for p in paragraphs %}<p style="margin:0 0 12px;font-size:15px;line-height:22px">{{ p }}</p>{% endfor %}
<p style="margin:16px 0"><a href="{{ pay_url }}" style="display:inline-block;background:#c2410c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:11px 18px;border-radius:6px">{{ cta }}</a></p>
<p style="margin:0;font-size:13px;color:#6b7280">Sans engagement, résiliable à tout moment.</p></td></tr>
"""


def links(site_url: str, functions_url: str | None, sub: dict, payment_link: str | None) -> dict[str, str]:
    token = sub["token"]
    base = site_url.rstrip("/")
    unsub = f"{functions_url.rstrip('/')}/unsubscribe?t={token}" if functions_url else f"{base}/desinscription.html?t={token}"
    pay = base + "/abonnement.html"
    if payment_link:
        pay = payment_link + ("&" if "?" in payment_link else "?") + urlencode({"prefilled_email": sub["email"], "client_reference_id": sub["id"]})
    return {"prefs_url": f"{base}/preferences.html?t={token}", "unsub_url": unsub, "pay_url": pay}


def trial_days_left(sub: dict, now: datetime | None = None) -> int | None:
    if sub.get("status") != "trial" or not sub.get("trial_ends_at"):
        return None
    now = now or datetime.now(timezone.utc)
    end = datetime.fromisoformat(sub["trial_ends_at"])
    return max(0, (end - now).days + (1 if (end - now).seconds else 0))


def _render(body_tpl: str, title: str, preheader: str, ctx: dict) -> str:
    # Le corps est déjà rendu ET échappé : on l'insère tel quel (sinon double échappement).
    body = Markup(env.from_string(body_tpl).render(**ctx))
    return env.from_string(LAYOUT).render(title=title, preheader=preheader, body=body, **ctx)


def daily_alert(sub: dict, notices: list[dict], day_label: str, ctx_links: dict, footer_legal: str = "", now: datetime | None = None) -> Email:
    now = now or datetime.now(timezone.utc)
    items = []
    for n in notices:
        line1, _, line2 = n["summary"].partition("\n")
        dl = datetime.fromisoformat(n["date_limite"]) if n.get("date_limite") else None
        items.append({
            "line1": line1, "line2": line2, "url": n["url"], "deadline": deadline_fr(dl),
            "urgent": bool(dl and (dl - now).days < 10),
            "trades": ", ".join(TRADES_BY_SLUG[t].label for t in n.get("trades", []) if t in TRADES_BY_SLUG and t in sub["trades"]),
        })
    n = len(items)
    labels = [TRADES_BY_SLUG[t].label for t in sub["trades"] if t in TRADES_BY_SLUG]
    scope = ", ".join(labels[:3]) + ("…" if len(labels) > 3 else "")
    subject = f"{n} nouveau{'x' if n > 1 else ''} chantier{'s' if n > 1 else ''} pour vous"
    ctx = {"n": n, "items": items, "scope": scope, "day": day_label, "trial_days": trial_days_left(sub, now), "footer_legal": footer_legal, **ctx_links}
    html = _render(DAILY_BODY, subject, f"{items[0]['line1'][:90]}" if items else "", ctx)
    text_lines = [subject, f"{scope} — avis publiés le {day_label}", ""]
    for it in items:
        text_lines += [f"• {it['line1']}", f"  {it['line2']}" if it["line2"] else "", f"  Date limite : {it['deadline']}", f"  {it['url']}", ""]
    text_lines += ["Modifier mes préférences : " + ctx_links["prefs_url"], "Se désinscrire : " + ctx_links["unsub_url"]]
    return Email(to=sub["email"], subject=subject, html=html, text="\n".join(l for l in text_lines if l is not None), unsubscribe_url=ctx_links["unsub_url"])


def trial_reminder(sub: dict, sent_count: int, ctx_links: dict, footer_legal: str = "") -> Email:
    subject = "Votre essai se termine bientôt"
    paras = [
        "Votre essai gratuit de ChantierAlerte se termine dans 2 jours.",
        f"Pendant votre essai, nous vous avons signalé {sent_count} appel{'s' if sent_count > 1 else ''} d'offres correspondant à votre métier et à vos départements." if sent_count else "Pendant votre essai, aucun nouvel appel d'offres ne correspondait encore à vos critères. Pensez à élargir vos départements ou vos métiers.",
        "Pour continuer à recevoir chaque matin les nouveaux chantiers publics près de chez vous, activez votre abonnement à 12 € par mois.",
    ]
    ctx = {"heading": subject, "paragraphs": paras, "cta": "Continuer pour 12 €/mois", "trial_days": None, "footer_legal": footer_legal, **ctx_links}
    html = _render(NOTICE_BODY, subject, "Plus que 2 jours d'essai gratuit", ctx)
    text = "\n\n".join([subject, *paras, "S'abonner : " + ctx_links["pay_url"], "Se désinscrire : " + ctx_links["unsub_url"]])
    return Email(sub["email"], subject, html, text, ctx_links["unsub_url"])


def trial_ended(sub: dict, ctx_links: dict, footer_legal: str = "") -> Email:
    subject = "Votre essai gratuit est terminé"
    paras = [
        "Votre essai de 14 jours est terminé : vous ne recevrez plus les alertes quotidiennes.",
        "Vous pouvez les réactiver à tout moment en souscrivant l'abonnement à 12 € par mois. Vos préférences sont conservées.",
    ]
    ctx = {"heading": subject, "paragraphs": paras, "cta": "Réactiver mes alertes", "trial_days": None, "footer_legal": footer_legal, **ctx_links}
    html = _render(NOTICE_BODY, subject, "Réactivez vos alertes chantiers", ctx)
    text = "\n\n".join([subject, *paras, "S'abonner : " + ctx_links["pay_url"]])
    return Email(sub["email"], subject, html, text, ctx_links["unsub_url"])

