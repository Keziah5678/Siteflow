"""
Récupération et normalisation des avis du BOAMP.

Source : API ouverte opendatasoft de la DILA
  https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp
Jeu de données « boamp » ; quota public : 10 000 requêtes/jour.

Le champ `donnees` contient l'avis complet en JSON, dans l'un de ces formats :
  EFORMS (avis européens), FNSimple (national), MAPA (marchés adaptés), DSP.
Les codes CPV, la description, la ville et le montant y sont extraits.
"""
from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Iterator

import requests

log = logging.getLogger(__name__)

API = "https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp"
USER_AGENT = "ChantierAlerte/1.0 (+https://github.com/)"


class BoampUnavailable(RuntimeError):
    """L'API du BOAMP n'a pas répondu correctement après plusieurs essais."""


# ---------------------------------------------------------------------------
# Récupération
# ---------------------------------------------------------------------------
def fetch_day(day: date, session: requests.Session | None = None, attempts: int = 6, backoff: float = 5.0) -> list[dict[str, Any]]:
    """Tous les avis publiés le jour donné (un seul appel d'export, avec réessais)."""
    s = session or requests.Session()
    url = f"{API}/exports/json"
    params = {"where": f"dateparution=date'{day.isoformat()}'"}
    last: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            r = s.get(url, params=params, timeout=120, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
            if r.status_code == 429:
                raise BoampUnavailable("quota BOAMP atteint (429)")
            r.raise_for_status()
            data = r.json()
            if not isinstance(data, list):
                raise ValueError("réponse inattendue")
            log.info("BOAMP %s : %d avis bruts", day, len(data))
            return data
        except (requests.RequestException, ValueError, BoampUnavailable) as e:
            last = e
            wait = backoff * attempt
            log.warning("BOAMP essai %d/%d échoué (%s) — nouvel essai dans %.0fs", attempt, attempts, e, wait)
            if attempt < attempts:
                time.sleep(wait)
    raise BoampUnavailable(f"API BOAMP indisponible après {attempts} essais : {last}")


# ---------------------------------------------------------------------------
# Normalisation
# ---------------------------------------------------------------------------
@dataclass
class Notice:
    idweb: str
    objet: str
    acheteur: str | None
    departments: list[str]
    ville: str | None
    cpv: list[str]
    descripteurs: list[str]
    description: str | None
    date_parution: date
    date_limite: datetime | None
    montant: float | None
    url: str
    type_marche: list[str]
    summary: str = ""
    trades: list[str] = field(default_factory=list)

    def to_row(self) -> dict[str, Any]:
        return {
            "idweb": self.idweb, "objet": self.objet, "acheteur": self.acheteur, "departments": self.departments,
            "ville": self.ville, "cpv": self.cpv, "descripteurs": self.descripteurs, "description": self.description,
            "summary": self.summary, "date_parution": self.date_parution.isoformat(),
            "date_limite": self.date_limite.isoformat() if self.date_limite else None,
            "montant": self.montant, "url": self.url, "type_marche": self.type_marche, "trades": self.trades,
        }


def _walk(o: Any) -> Iterator[tuple[str, Any]]:
    """Parcourt un JSON imbriqué en produisant (clé, valeur)."""
    if isinstance(o, dict):
        for k, v in o.items():
            yield k, v
            yield from _walk(v)
    elif isinstance(o, list):
        for v in o:
            yield from _walk(v)


def _text(v: Any) -> str | None:
    if v is None:
        return None
    if isinstance(v, dict):
        v = v.get("#text") or v.get("value")
    if isinstance(v, list):
        v = " ".join(t for t in (_text(x) for x in v) if t)
    s = str(v).strip() if v is not None else ""
    return s or None


def extract_cpv(donnees: dict) -> list[str]:
    codes: list[str] = []
    for k, v in _walk(donnees):
        # eForms : {"@listName": "cpv", "#text": "45000000"}
        if isinstance(v, dict) and v.get("@listName") == "cpv" and v.get("#text"):
            codes.append(str(v["#text"]))
        # FNSimple / DSP : codeCPV / CPV → objetPrincipal / classPrincipale
        if k == "classPrincipale" and isinstance(v, (str, int)):
            codes.append(str(v))
    out = []
    for c in codes:
        m = re.match(r"^(\d{8})", c)
        if m and m.group(1) not in out:
            out.append(m.group(1))
    return out


def extract_description(donnees: dict, objet: str) -> str | None:
    best: str | None = None
    for k, v in _walk(donnees):
        if k in ("cbc:Description", "description", "objetComplet", "objet") and k != "cbc:Name":
            t = _text(v) if not isinstance(v, dict) or "#text" in v else None
            if t and len(t) > 20 and t.strip() != objet.strip():
                if best is None or len(t) > len(best):
                    best = t
        if best and len(best) > 400:
            break
    return best


def _city_and_cp(block: Any) -> tuple[str | None, str | None]:
    ville = cp = None
    for k, v in _walk(block):
        if k in ("cbc:CityName", "ville", "commune") and not ville and _text(v):
            ville = _clean_city(_text(v))
        if k in ("cbc:PostalZone", "cp", "codePostal") and not cp and _text(v):
            m = re.match(r"^\s*(\d{5})", _text(v) or "")
            cp = m.group(1) if m else None
    return ville, cp


def extract_place(donnees: dict) -> tuple[str | None, str | None, bool]:
    """(ville, code postal, vient_du_lieu_d_execution).

    Lieu d'exécution en priorité ; sinon adresse de l'acheteur (moins fiable :
    un acheteur lyonnais peut commander un chantier dans la Drôme).
    """
    for k, v in _walk(donnees):
        if k in ("cac:RealizedLocation", "lieuExecution", "lieuExecutionLivraison") and v:
            ville, cp = _city_and_cp(v)
            if cp:
                return ville, cp, True
            if ville:
                bv, bcp = _city_and_cp(donnees)
                return ville, (bcp if bv and norm_city(bv) == norm_city(ville) else None), bool(bv and norm_city(bv) == norm_city(ville))
    bv, bcp = _city_and_cp(donnees)
    return bv, bcp, False


def norm_city(s: str) -> str:
    return re.sub(r"[^a-z]", "", s.lower())


_DEPT_ALIASES = {"20A": "2A", "20B": "2B", "977": "971", "978": "971"}  # Corse ; Saint-Barth/Saint-Martin → Guadeloupe


def norm_dept(d: str) -> str:
    d = str(d).strip().upper()
    d = _DEPT_ALIASES.get(d, d)
    return d.zfill(2) if d.isdigit() and len(d) < 2 else d


def extract_ville(donnees: dict) -> str | None:
    return extract_place(donnees)[0]


def dept_from_cp(cp: str | None) -> str | None:
    if not cp:
        return None
    if cp.startswith("97"):
        return norm_dept("978" if cp == "97150" else "977" if cp == "97133" else cp[:3])
    if cp.startswith("20"):
        return "2A" if int(cp) < 20200 else "2B"
    return cp[:2]


def _clean_city(s: str | None) -> str | None:
    if not s:
        return None
    s = re.sub(r"\s+cedex.*$", "", s, flags=re.I).strip()
    return s.title() if s.isupper() else s


def extract_montant(donnees: dict) -> float | None:
    keys = ("cbc:EstimatedOverallContractAmount", "valeur", "valeurHaute", "montant", "estimationValeurTotal")
    best: float | None = None
    for k, v in _walk(donnees):
        if k in keys:
            t = _text(v)
            if not t:
                continue
            try:
                n = float(t.replace(" ", "").replace(",", "."))
            except ValueError:
                continue
            if 100 <= n <= 5_000_000_000 and (best is None or n > best):
                best = n
    return best


def parse_record(r: dict[str, Any]) -> Notice | None:
    """Normalise un enregistrement ; None si l'avis n'est pas un appel d'offres exploitable."""
    nature = (r.get("nature_categorise_libelle") or "")
    # Uniquement les nouveaux avis de marché (pas résultats, rectificatifs, concessions).
    if nature != "Avis de marché/":
        return None
    types = r.get("type_marche") or []
    if not set(types) & {"TRAVAUX", "SERVICES"}:
        return None
    try:
        donnees = json.loads(r["donnees"]) if isinstance(r.get("donnees"), str) else (r.get("donnees") or {})
    except (ValueError, TypeError):
        donnees = {}
    objet = (r.get("objet") or "").strip()
    if not objet or not r.get("idweb"):
        return None
    dl = r.get("datelimitereponse")
    try:
        date_limite = datetime.fromisoformat(dl) if dl else None
    except ValueError:
        date_limite = None
    depts = [norm_dept(d) for d in (r.get("code_departement") or []) if d]
    ville, cp, from_location = extract_place(donnees)
    buyer_cp = _city_and_cp(donnees)[1]
    # `code_departement` = départements de DIFFUSION (un gros marché à Strasbourg peut
    # être diffusé à Paris). Le chantier est rattaché au département de son lieu
    # (code postal) ; la liste de diffusion ne sert qu'à défaut.
    main = dept_from_cp(cp)
    if main and (from_location or main in depts or not depts):
        depts = [main]
    elif len(depts) > 1:
        # Lieu sans code postal : l'acheteur est très probablement dans le
        # département de diffusion qui le concerne.
        buyer_dept = dept_from_cp(buyer_cp)
        if buyer_dept in depts:
            depts = [buyer_dept]
    # Ville de l'acheteur située dans un autre département que le chantier : on ne l'affiche pas.
    if not from_location and ville and len(depts) == 1 and dept_from_cp(buyer_cp) not in (None, depts[0]):
        ville = None
    return Notice(
        idweb=str(r["idweb"]),
        objet=objet,
        acheteur=(r.get("nomacheteur") or None),
        departments=depts,
        ville=ville,
        cpv=extract_cpv(donnees),
        descripteurs=list(r.get("descripteur_libelle") or []),
        description=extract_description(donnees, objet),
        date_parution=date.fromisoformat(r["dateparution"]),
        date_limite=date_limite,
        montant=extract_montant(donnees),
        url=r.get("url_avis") or f"https://www.boamp.fr/pages/avis/?q=idweb:{r['idweb']}",
        type_marche=list(types),
    )
