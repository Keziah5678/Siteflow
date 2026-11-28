"""
Table de correspondance métier → signaux de détection.

Un avis est rattaché à un métier si AU MOINS UN de ces signaux correspond :
  1. un code CPV commençant par l'un des préfixes (avis européens et nationaux) ;
  2. un descripteur officiel du BOAMP (libellé exact, champ `descripteur_libelle`) ;
  3. un mot-clé dans l'objet ou la description (indispensable pour les MAPA,
     petits marchés publiés sans code CPV).

Les préfixes CPV et descripteurs ont été validés sur des avis BOAMP réels
(voir tests/test_trades.py). Les mots-clés sont des racines sans accents,
recherchées en début de mot.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Trade:
    slug: str            # identifiant stable (URL, base de données)
    label: str           # « Plomberie »
    artisan: str         # « plombiers » (textes marketing)
    cpv: tuple[str, ...] = ()
    descripteurs: tuple[str, ...] = ()
    keywords: tuple[str, ...] = ()
    excludes: tuple[str, ...] = field(default=())  # présents dans le texte → un match par mot-clé seul est rejeté
    services_by_keyword: bool = False  # marchés de SERVICES acceptés sur simple mot-clé (entretien)


TRADES: tuple[Trade, ...] = (
    Trade(
        "plomberie", "Plomberie", "plombiers",
        cpv=("45330000", "45332", "45333", "44115200", "45232150"),
        descripteurs=("Plomberie (travaux)", "Sanitaire"),
        keywords=("plomberie", "plombier", "sanitaire", "sanitaires", "reseau d'eau", "eau chaude sanitaire", "colonnes d'eau", "robinetterie"),
        excludes=("sanitaire et social", "crise sanitaire", "agence sanitaire", "veille sanitaire", "securite sanitaire", "nettoyage"),
    ),
    Trade(
        "electricite", "Électricité", "électriciens",
        cpv=("4531", "45232200", "45232300", "45316"),
        descripteurs=("Electricité (travaux)", "Câblage", "Eclairage public", "Courant faible"),
        keywords=("electricite", "electrique", "electriques", "electricien", "courants faibles", "courants forts", "eclairage", "tableau electrique", "cablage", "borne de recharge", "bornes de recharge", "irve"),
        excludes=("fourniture d'electricite", "achat d'electricite", "fourniture et acheminement", "vehicule", "vehicules", "automobile"),
        services_by_keyword=True,
    ),
    Trade(
        "peinture", "Peinture", "peintres",
        cpv=("45442", "45440000", "45443"),
        descripteurs=("Peinture (travaux)", "Revêtements muraux", "Ravalement", "Décoration (travaux)"),
        keywords=("peinture", "peintures", "ravalement", "revetements muraux", "papier peint"),
        excludes=("peinture routiere", "marquage", "peinture (fourniture)"),
    ),
    Trade(
        "maconnerie", "Maçonnerie & gros œuvre", "maçons",
        cpv=("45262500", "45262520", "45262522", "45262300", "45262210", "45223"),
        descripteurs=("Maçonnerie", "Gros oeuvre", "Mur de soutènement"),
        keywords=("maconnerie", "gros oeuvre", "gros-oeuvre", "beton arme", "mur de soutenement", "dallage"),
    ),
    Trade(
        "menuiserie", "Menuiserie", "menuisiers",
        cpv=("45421", "45422", "44220000", "44221"),
        descripteurs=("Menuiserie",),
        keywords=("menuiserie", "menuiseries", "menuisier", "fenetres", "huisseries", "portes et fenetres", "agencement"),
    ),
    Trade(
        "couverture", "Couverture & zinguerie", "couvreurs",
        cpv=("45261", "45262210"),
        descripteurs=("Couverture", "Zinguerie", "Gouttières"),
        keywords=("couverture", "toiture", "toitures", "zinguerie", "gouttieres", "chenaux", "ardoise", "tuiles"),
        excludes=("couverture sociale", "couverture assurance", "couverture vaccinale", "couverture mobile", "couverture radio", "couverture numerique"),
    ),
    Trade(
        "charpente", "Charpente", "charpentiers",
        cpv=("45261100", "45422100", "45262400"),
        descripteurs=("Charpente", "Structure métallique"),
        keywords=("charpente", "charpentes", "ossature bois", "structure bois"),
    ),
    Trade(
        "carrelage", "Carrelage & sols", "carreleurs",
        cpv=("45431", "45432"),
        descripteurs=("Carrelage", "Revêtements de sols"),
        keywords=("carrelage", "carrelages", "faience", "revetements de sols", "revetement de sol", "sols souples", "chape"),
    ),
    Trade(
        "platrerie", "Plâtrerie, cloisons & isolation", "plaquistes",
        cpv=("45410000", "45421141", "45421146", "45320000", "45321"),
        descripteurs=("Plâtrerie", "Cloison, faux plafond", "Isolation"),
        keywords=("platrerie", "plaquiste", "cloison", "cloisons", "doublage", "doublages", "faux plafond", "faux plafonds", "faux-plafonds", "isolation", "ite", "renovation energetique"),
        excludes=("isolation phonique des logements riverains",),
    ),
    Trade(
        "chauffage", "Chauffage, ventilation & climatisation", "chauffagistes",
        cpv=("45331", "45259300"),
        descripteurs=("Chauffage (travaux)", "Chauffage (exploitation, entretien)", "Climatisation", "Ventilation", "Equipement thermique", "Géothermie"),
        keywords=("chauffage", "chaufferie", "chaudiere", "chaudieres", "climatisation", "ventilation", "vmc", "cvc", "pompe a chaleur", "pompes a chaleur", "pac", "genie climatique", "renovation energetique"),
        services_by_keyword=True,
    ),
    Trade(
        "serrurerie", "Serrurerie & métallerie", "serruriers-métalliers",
        cpv=("45421160", "45340000", "45341", "45342", "44316", "45262400"),
        descripteurs=("Serrurerie", "Métallerie", "Ferronnerie", "Clôture", "Porte automatique, portail"),
        keywords=("serrurerie", "metallerie", "ferronnerie", "garde-corps", "garde corps", "portail", "portails", "cloture", "clotures"),
    ),
    Trade(
        "terrassement", "Terrassement & VRD", "terrassiers",
        cpv=("45112", "45111200", "45233", "45232400", "45232410"),
        descripteurs=("Terrassement", "Voirie et réseaux divers", "Voirie", "Travaux de viabilité", "Réseaux divers", "Assainissement", "Canalisations"),
        keywords=("terrassement", "terrassements", "vrd", "voirie", "viabilisation", "assainissement", "enrobe", "enrobes", "reseaux humides", "chaussee", "chaussees"),
        excludes=("rez-de-chaussee", "rez de chaussee"),
    ),
    Trade(
        "espaces-verts", "Espaces verts & paysage", "paysagistes",
        cpv=("45112700", "45112710", "77310000", "77311", "77312", "77313", "77314", "77340000", "77211"),
        descripteurs=("Espaces verts", "Végétaux", "Arrosage", "Aire de jeux"),
        keywords=("espaces verts", "espace vert", "paysager", "paysagere", "paysagers", "elagage", "plantations", "tonte", "debroussaillage", "entretien des espaces"),
        services_by_keyword=True,
    ),
    Trade(
        "demolition", "Démolition & désamiantage", "entreprises de démolition",
        cpv=("45111100", "45111000", "45262660", "45262600"),
        descripteurs=("Démolition", "Amiante (désamiantage)", "Dépollution", "Curage"),
        keywords=("demolition", "deconstruction", "desamiantage", "curage", "deplombage"),
    ),
    Trade(
        "etancheite", "Étanchéité", "étancheurs",
        cpv=("45261410", "45261420", "45262130"),
        descripteurs=("Etanchéité", "Bardage"),
        keywords=("etancheite", "bardage", "bardages", "toiture-terrasse", "toitures-terrasses", "toiture terrasse"),
    ),
)

TRADES_BY_SLUG: dict[str, Trade] = {t.slug: t for t in TRADES}

# Missions intellectuelles (bureaux d'études, contrôleurs) : jamais retenues
# sur simple mot-clé — elles ne concernent pas les artisans.
INTELLECTUAL = (
    "maitrise d'oeuvre", "maitrise d oeuvre", "controle technique", "controleur technique",
    "assistance a maitrise d'ouvrage", "coordination sps", "coordonnateur sps", "etudes diagnostiques",
    "diagnostic", "etude de faisabilite", "suivi et coordination", "essais et controles", "programmation",
)
