"""Résumé en 2 lignes, en langage simple, sans IA (0 €, déterministe)."""
from __future__ import annotations

import re
from datetime import datetime

from .departments import DEPARTMENTS

# Sigles du BTP traduits (recherchés sans tenir compte de la casse, mot entier).
ABBREV = [
    (r"\bMOE\b", "maîtrise d'œuvre"), (r"\bVRD\b", "voirie et réseaux"), (r"\bCVC\b", "chauffage-ventilation-clim"),
    (r"\bITE\b", "isolation extérieure"), (r"\bERP\b", "établissement recevant du public"),
    (r"\bAEP\b", "eau potable"), (r"\bEU\b", "eaux usées"), (r"\bEP\b", "eaux pluviales"),
    (r"\bTCE\b", "tous corps d'état"), (r"\bPMR\b", "personnes à mobilité réduite"),
]
KEEP_UPPER = {"SDIS", "CAF", "CHU", "SNCF", "EHPAD", "HLM", "OPH", "SPL", "SEM", "SIVOM", "SIVU", "CCAS", "IRVE", "SSI", "VMC", "PAC"}


def _sentence_case(s: str) -> str:
    """« Rehabilitation Des Reseaux » → « Rehabilitation des reseaux » (sigles conservés)."""
    words = s.split(" ")
    out = [w if (w.upper() in KEEP_UPPER) else w.lower() for w in words]
    return " ".join(out)
NOISE = [
    r"^(avis d'appel public à la concurrence|avis de marché|marché public|consultation)\s*[:\-–]\s*",
    r"\s*[-–]\s*(procédure adaptée|mapa|appel d'offres ouvert)\s*$",
]


def clean(s: str) -> str:
    s = re.sub(r"\s+", " ", s).strip(" .;:-–")
    for pat in NOISE:
        s = re.sub(pat, "", s, flags=re.I)
    letters = [w for w in s.split() if w[:1].isalpha()]
    titled = len(letters) >= 3 and sum(w[:1].isupper() for w in letters) / len(letters) > 0.7
    if s.isupper() or titled:
        s = _sentence_case(s)
    for pat, rep in ABBREV:
        s = re.sub(pat, rep, s, flags=re.I)
    return s[:1].upper() + s[1:] if s else s


def shorten(s: str, n: int) -> str:
    if len(s) <= n:
        return s
    cut = s[: n - 1].rsplit(" ", 1)[0].rstrip(" ,;:-–(")
    return cut + "…"


def money(v: float | None) -> str | None:
    if not v:
        return None
    if v >= 1_000_000:
        return f"{v / 1_000_000:.1f} M€".replace(".", ",").replace(",0 ", " ")
    if v >= 1_000:
        return f"{round(v / 1000):,} k€".replace(",", " ")
    return f"{round(v)} €"


def where(ville: str | None, depts: list[str]) -> str | None:
    d = depts[0] if depts else None
    dname = DEPARTMENTS.get(d) if d else None
    if ville and dname:
        return f"{ville} ({d})"
    return ville or (f"{dname} ({d})" if dname else None)


def summarize(objet: str, acheteur: str | None, ville: str | None, depts: list[str], montant: float | None) -> str:
    """Ligne 1 : quoi. Ligne 2 : pour qui, où, combien."""
    line1 = shorten(clean(objet), 140)
    bits = []
    if acheteur:
        bits.append(f"Pour {shorten(clean(acheteur), 70)}")
    w = where(ville, depts)
    if w:
        bits.append(w)
    m = money(montant)
    if m:
        bits.append(f"budget estimé {m}")
    return line1 + ("\n" + " · ".join(bits) if bits else "")


def deadline_fr(d: datetime | None) -> str:
    if not d:
        return "non précisée"
    mois = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
    return f"{d.day} {mois[d.month - 1]} {d.year}"
