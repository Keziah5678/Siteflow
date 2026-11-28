"""
Génère le site statique dans dist/ (publié sur GitHub Pages).

    python -m robot.build_site            # avec les avis de la base Supabase
    python -m robot.build_site --offline  # sans base (pages SEO vides) : aperçu local

Pages SEO : une page par métier, et une par métier × département ayant au
moins un avis ouvert récent (une page vide n'apporte rien à Google).
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from xml.sax.saxutils import escape

from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup, escape as h

from .departments import DEPARTMENTS, DEPT_SLUGS
from .summary import deadline_fr
from .trades import TRADES, TRADES_BY_SLUG

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
WINDOW_DAYS = 60


def load_config() -> dict:
    cfg = json.loads((ROOT / "config" / "site.json").read_text(encoding="utf-8"))
    # Les variables d'environnement (GitHub Actions) priment sur le fichier.
    cfg["site_url"] = os.environ.get("SITE_URL") or cfg["site_url"]
    cfg["stripe_payment_link"] = os.environ.get("STRIPE_PAYMENT_LINK") or cfg.get("stripe_payment_link") or ""
    return cfg


def todo(v: str | None) -> Markup:
    """Met en évidence les champs « A_REMPLIR » des pages légales."""
    s = str(v or "A_REMPLIR")
    return Markup(f'<span class="todo">{h(s)}</span>') if "A_REMPLIR" in s else h(s)


def notice_view(n: dict, now: datetime) -> dict:
    line1, _, line2 = n["summary"].partition("\n")
    dl = datetime.fromisoformat(n["date_limite"]) if n.get("date_limite") else None
    return {"line1": line1, "line2": line2, "url": n["url"], "deadline": deadline_fr(dl), "urgent": bool(dl and (dl - now).days < 10), "raw": n}


def build(notices: list[dict], out: Path, cfg: dict, now: datetime | None = None) -> dict[str, int]:
    now = now or datetime.now(timezone.utc)
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    public = {
        "supabaseUrl": supabase_url,
        "anonKey": os.environ.get("SUPABASE_ANON_KEY", ""),
        "functionsUrl": os.environ.get("FUNCTIONS_URL") or (supabase_url + "/functions/v1"),
        "paymentLink": cfg["stripe_payment_link"],
        "price": cfg["price_eur_month"],
        "trialDays": cfg["trial_days"],
        "contactEmail": cfg["contact_email"],
        "tradeLabels": {t.slug: t.label for t in TRADES},
    }
    env = Environment(loader=FileSystemLoader(SITE / "templates"), autoescape=select_autoescape(["html"]), trim_blocks=True, lstrip_blocks=True)
    env.filters["todo"] = todo
    base_url = cfg["site_url"].rstrip("/") + "/"
    updated = f"{now.astimezone().day} {['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'][now.month - 1]} {now.year}"
    common = {"site": cfg, "e": cfg["editeur"], "public_config": public, "trades": TRADES, "depts": list(DEPARTMENTS.items()),
              "updated": updated, "version": now.strftime("%Y%m%d%H%M")}

    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(SITE / "static", out / "static")
    shutil.copy(SITE / "static" / "favicon.svg", out / "favicon.svg")
    urls: list[str] = []

    def page(tpl: str, path: str, title: str, description: str, indexed: bool = True, **ctx) -> None:
        depth = path.count("/")
        root = "../" * depth
        html = env.get_template(tpl).render({**common, **ctx, "title": title, "description": description, "root": root,
                                             "canonical": base_url + path.removesuffix("index.html") if indexed else None, "noindex": not indexed})
        f = out / path
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(html, encoding="utf-8")
        if indexed:
            urls.append(base_url + path.removesuffix("index.html"))

    # Avis ouverts récents
    since = (now.date() - timedelta(days=WINDOW_DAYS)).isoformat()
    open_notices = [n for n in notices if n["date_parution"] >= since and (not n.get("date_limite") or datetime.fromisoformat(n["date_limite"]) > now)]
    open_notices.sort(key=lambda n: (n["date_parution"], n["idweb"]), reverse=True)
    views = [notice_view(n, now) for n in open_notices]
    month_ago = (now.date() - timedelta(days=30)).isoformat()
    stats = {"notices_30d": sum(1 for n in notices if n["date_parution"] >= month_ago)}

    page("index.html", "index.html", "ChantierAlerte — Les appels d'offres publics du BTP chaque matin",
         "Plombiers, électriciens, peintres, maçons… Recevez chaque matin les nouveaux appels d'offres publics de votre métier et de vos départements. 14 jours gratuits.",
         examples=views[:4], stats=stats)
    for tpl, title in [("confirmer.html", "Confirmation"), ("preferences.html", "Mes alertes"), ("desinscription.html", "Désinscription"),
                       ("abonnement.html", "Abonnement"), ("merci.html", "Merci"), ("admin.html", "Tableau de bord"), ("404.html", "Page introuvable")]:
        page(tpl, tpl, f"{title} — ChantierAlerte", "ChantierAlerte", indexed=False)
    for tpl, title in [("mentions-legales.html", "Mentions légales"), ("confidentialite.html", "Politique de confidentialité"), ("cgv.html", "Conditions générales de vente")]:
        page(tpl, tpl, f"{title} — ChantierAlerte", title)

    # Pages SEO
    trade_counts = []
    seo_pages = 0
    for t in TRADES:
        tv = [v for v in views if t.slug in v["raw"]["trades"]]
        by_dept: dict[str, list[dict]] = {}
        for v in tv:
            for d in v["raw"]["departments"]:
                if d in DEPARTMENTS:
                    by_dept.setdefault(d, []).append(v)
        trade_counts.append({"slug": t.slug, "label": t.label, "count": len(tv)})
        related = [{"href": f"appels-offres/{t.slug}/{DEPT_SLUGS[d]}/", "label": f"{t.label} — {DEPARTMENTS[d]} ({d}) : {len(by_dept[d])}"} for d in sorted(by_dept)]
        page("seo_trade_dept.html", f"appels-offres/{t.slug}/index.html",
             f"Appels d'offres {t.label.lower()} — marchés publics du BTP | ChantierAlerte",
             f"Les derniers appels d'offres publics en {t.label.lower()} publiés au BOAMP, partout en France. Alertes quotidiennes par email pour les {t.artisan}.",
             trade=t, dept_name=None, dept_code=None, h1=f"Appels d'offres {t.label.lower()} : les marchés publics en cours",
             intro=f"{len(tv)} appel{'s' if len(tv) > 1 else ''} d'offres ouvert{'s' if len(tv) > 1 else ''} pour les {t.artisan}, publié{'s' if len(tv) > 1 else ''} ces {WINDOW_DAYS} derniers jours au BOAMP. Choisissez votre département ou recevez-les chaque matin par email.",
             notices=tv[:40], window_days=WINDOW_DAYS, related=related, related_title=f"{t.label} par département",
             jsonld={"@context": "https://schema.org", "@type": "CollectionPage", "name": f"Appels d'offres {t.label.lower()}"})
        seo_pages += 1
        for d, dv in by_dept.items():
            name = DEPARTMENTS[d]
            others = [{"href": f"appels-offres/{o.slug}/{DEPT_SLUGS[d]}/", "label": f"{o.label} en {name}"} for o in TRADES if o.slug != t.slug and any(o.slug in v["raw"]["trades"] and d in v["raw"]["departments"] for v in views)]
            page("seo_trade_dept.html", f"appels-offres/{t.slug}/{DEPT_SLUGS[d]}/index.html",
                 f"Appels d'offres {t.label.lower()} {name} ({d}) — marchés publics | ChantierAlerte",
                 f"{len(dv)} appel{'s' if len(dv) > 1 else ''} d'offres {t.label.lower()} en {name} ({d}) : objet, acheteur, date limite. Recevez les nouveaux chaque matin par email.",
                 trade=t, dept_name=name, dept_code=d, h1=f"Appels d'offres {t.label.lower()} en {name} ({d})",
                 intro=f"Les marchés publics de {t.label.lower()} ouverts en {name}, publiés au BOAMP. ChantierAlerte les repère chaque nuit pour les {t.artisan} du {d}.",
                 notices=dv[:40], window_days=WINDOW_DAYS, related=others, related_title=f"Autres métiers en {name}",
                 jsonld={"@context": "https://schema.org", "@type": "CollectionPage", "name": f"Appels d'offres {t.label.lower()} {name}"})
            seo_pages += 1
    page("seo_index.html", "appels-offres/index.html", "Appels d'offres du BTP par métier | ChantierAlerte",
         "Tous les appels d'offres publics du bâtiment par métier : plomberie, électricité, peinture, maçonnerie, menuiserie…", trades=trade_counts)

    (out / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                                     + "".join(f"<url><loc>{escape(u)}</loc><lastmod>{now.date().isoformat()}</lastmod></url>\n" for u in urls) + "</urlset>\n", encoding="utf-8")
    (out / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /admin.html\nSitemap: {base_url}sitemap.xml\n", encoding="utf-8")
    (out / ".nojekyll").write_text("")
    return {"pages": len(urls), "seo_pages": seo_pages, "open_notices": len(open_notices)}


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--offline", action="store_true")
    p.add_argument("--out", default=str(ROOT / "dist"))
    a = p.parse_args()
    cfg = load_config()
    notices: list[dict] = []
    if not a.offline:
        from .db import DB
        db = DB(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
        since = (date.today() - timedelta(days=WINDOW_DAYS + 30)).isoformat()
        notices = db.select("notices", {"date_parution": f"gte.{since}", "select": "idweb,summary,url,date_limite,date_parution,trades,departments"})
    print(json.dumps(build(notices, Path(a.out), cfg), ensure_ascii=False))


if __name__ == "__main__":
    main()
