"""Détection des métiers d'un avis et correspondance avec les abonnés."""
from __future__ import annotations

import re
import unicodedata
from functools import lru_cache

from .trades import INTELLECTUAL, TRADES, Trade


def norm(s: str | None) -> str:
    """Minuscules, sans accents, apostrophes unifiées, espaces simples."""
    if not s:
        return ""
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower().replace("’", "'").replace("œ", "oe")
    return re.sub(r"\s+", " ", s)


@lru_cache(maxsize=None)
def _kw_regex(trade: Trade) -> re.Pattern[str] | None:
    if not trade.keywords:
        return None
    parts = sorted((re.escape(norm(k)) for k in trade.keywords), key=len, reverse=True)
    return re.compile(r"(?<![a-z0-9])(?:" + "|".join(parts) + r")(?![a-z0-9])")


def detect_trades(objet: str, description: str | None, cpv: list[str], descripteurs: list[str], type_marche: list[str] | None = None) -> list[str]:
    """Retourne les slugs des métiers concernés (ordre de la table).

    Signaux forts (toujours retenus) : préfixe CPV, descripteur officiel BOAMP.
    Signal faible (mot-clé) : retenu seulement pour un marché de TRAVAUX — ou de
    SERVICES pour les métiers d'entretien — et jamais pour une mission
    intellectuelle ni en présence d'un mot d'exclusion.
    """
    text = norm(f"{objet} . {description or ''}")
    is_works = "TRAVAUX" in (type_marche or ["TRAVAUX"])
    intellectual = any(w in text for w in _INTELLECTUAL)
    # Une prestation intellectuelle (titre de l'avis) n'est jamais pour un artisan.
    if not is_works and any(w in norm(objet) for w in _INTELLECTUAL):
        return []
    found: list[str] = []
    for t in TRADES:
        hit = any(code.startswith(p) for code in cpv for p in t.cpv) or bool(set(descripteurs) & set(t.descripteurs))
        if not hit and not intellectual and (is_works or t.services_by_keyword):
            kw = _kw_regex(t)
            if kw and kw.search(text) and not any(norm(e) in text for e in t.excludes):
                hit = True
        if hit:
            found.append(t.slug)
    return found


_INTELLECTUAL = tuple(norm(w) for w in INTELLECTUAL)


def matches(notice_trades: list[str], notice_depts: list[str], sub_trades: list[str], sub_depts: list[str]) -> bool:
    return bool(set(notice_trades) & set(sub_trades)) and bool(set(notice_depts) & set(sub_depts))
