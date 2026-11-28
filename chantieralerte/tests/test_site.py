"""Génération du site statique (landing, pages SEO, pages légales)."""
import json
from datetime import datetime, timezone

import pytest

from robot import build_site
from robot.boamp import parse_record
from robot.matching import detect_trades
from robot.summary import summarize

NOW = datetime(2026, 11, 28, 6, tzinfo=timezone.utc)


@pytest.fixture()
def site(raw_records, tmp_path, monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://projet.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "cle-publique-anon")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "SECRET-SERVICE-ROLE")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_SECRET")
    monkeypatch.setenv("SITE_URL", "https://chantieralerte.test")
    rows = []
    for r in raw_records:
        n = parse_record(r)
        if n:
            n.trades = detect_trades(n.objet, n.description, n.cpv, n.descripteurs, n.type_marche)
            if n.trades:
                n.summary = summarize(n.objet, n.acheteur, n.ville, n.departments, n.montant)
                rows.append(n.to_row())
    out = tmp_path / "dist"
    stats = build_site.build(rows, out, build_site.load_config(), NOW)
    return out, stats, rows


def test_core_pages(site):
    out, stats, _ = site
    for p in ["index.html", "preferences.html", "desinscription.html", "confirmer.html", "abonnement.html", "merci.html",
              "admin.html", "mentions-legales.html", "confidentialite.html", "cgv.html", "404.html", "sitemap.xml", "robots.txt"]:
        assert (out / p).exists(), p
    index = (out / "index.html").read_text()
    assert "Ne ratez plus aucun <em>chantier public</em> près de chez vous" in index
    assert 'name="email"' in index and 'name="trades"' in index and 'name="departments"' in index


def test_no_secret_is_published(site):
    out, _, _ = site
    blob = "".join(p.read_text(errors="ignore") for p in out.rglob("*") if p.is_file())
    assert "SECRET-SERVICE-ROLE" not in blob and "sk_test_SECRET" not in blob
    assert "cle-publique-anon" in blob  # la clé anon est publique par conception (protégée par RLS)


def test_seo_pages_per_trade_and_department(site):
    out, stats, rows = site
    from robot.departments import DEPARTMENTS, DEPT_SLUGS
    from robot.trades import TRADES_BY_SLUG
    # Une combinaison métier × département réellement présente dans les avis.
    r = next(r for r in rows if r["date_limite"] and r["departments"][0] in DEPARTMENTS)
    slug, d = r["trades"][0], r["departments"][0]
    t, name, dslug = TRADES_BY_SLUG[slug], DEPARTMENTS[d], DEPT_SLUGS[d]
    page = out / "appels-offres" / slug / dslug / "index.html"
    assert page.exists()
    html = page.read_text()
    assert f"<title>Appels d&#39;offres {t.label.lower()} {name} ({d})" in html or f"<title>Appels d'offres {t.label.lower()} {name} ({d})" in html
    assert "Voir l'avis officiel" in html
    assert f'rel="canonical" href="https://chantieralerte.test/appels-offres/{slug}/{dslug}/"' in html
    assert f"?metier={slug}&amp;dep={d}#inscription" in html
    sitemap = (out / "sitemap.xml").read_text()
    assert f"https://chantieralerte.test/appels-offres/{slug}/{dslug}/" in sitemap
    assert "admin.html" not in sitemap and "preferences.html" not in sitemap
    # Aucune page département vide n'est générée.
    for page in (out / "appels-offres").glob("*/*/index.html"):
        assert "Voir l'avis officiel" in page.read_text(), page


def test_private_pages_are_noindex(site):
    out, _, _ = site
    for p in ["preferences.html", "admin.html", "desinscription.html"]:
        assert 'name="robots" content="noindex"' in (out / p).read_text()


def test_legal_placeholders_are_highlighted(site):
    out, _, _ = site
    html = (out / "mentions-legales.html").read_text()
    assert '<span class="todo">A_REMPLIR' in html


def test_public_config_has_no_payment_link_until_filled(site):
    out, _, _ = site
    html = (out / "index.html").read_text()
    cfg = json.loads(html.split("window.CA=")[1].split(";</script>")[0])
    assert cfg["paymentLink"] == "" and cfg["functionsUrl"] == "https://projet.supabase.co/functions/v1"
