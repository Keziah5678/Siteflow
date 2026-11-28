"""Table métier → signaux : couverture et absence de faux positifs connus."""
from robot.boamp import parse_record
from robot.matching import detect_trades, matches, norm
from robot.trades import TRADES


def detect(n):
    return detect_trades(n.objet, n.description, n.cpv, n.descripteurs, n.type_marche)


def test_at_least_ten_trades_with_all_three_signal_types():
    assert len(TRADES) >= 10
    for t in TRADES:
        assert t.cpv and t.descripteurs and t.keywords, t.slug
        assert all(c.isdigit() for c in t.cpv)


def test_strong_signals():
    assert "plomberie" in detect_trades("Réfection", None, ["45330000"], [])
    assert "electricite" in detect_trades("Lot 3", None, [], ["Electricité (travaux)"])


def test_keywords_work_for_mapa_without_cpv():
    assert detect_trades("Travaux de peinture intérieure de l'école", None, [], [], ["TRAVAUX"]) == ["peinture"]
    assert "chauffage" in detect_trades("Remplacement de la chaudière de la mairie", None, [], [], ["TRAVAUX"])


def test_known_false_positives_are_excluded():
    svc = ["SERVICES"]
    assert detect_trades("Nettoyage des locaux et des sanitaires", None, [], [], svc) == []
    assert detect_trades("Contrats d'assurance : couverture des risques", None, [], [], svc) == []
    assert detect_trades("Réparations du parc automobile (thermique et électrique)", None, [], [], svc) == []
    assert detect_trades("Mission de maîtrise d'œuvre pour des travaux d'assainissement", None, [], ["Assainissement"], svc) == []
    assert "terrassement" not in detect_trades("Aménagement du rez-de-chaussée de la mairie", None, [], [], ["TRAVAUX"])
    assert detect_trades("Grille tarifaire des prestations", None, [], [], ["TRAVAUX"]) == []


def test_maintenance_services_kept_for_maintenance_trades():
    assert "espaces-verts" in detect_trades("Entretien des espaces verts de la commune", None, [], [], ["SERVICES"])


def test_real_day_detection_rate(raw_records):
    notices = [n for n in map(parse_record, raw_records) if n]
    detected = [n for n in notices if detect(n)]
    assert len(detected) >= len(notices) // 3


def test_matching_requires_trade_and_department():
    assert matches(["plomberie"], ["33"], ["plomberie", "peinture"], ["33", "40"])
    assert not matches(["plomberie"], ["33"], ["peinture"], ["33"])
    assert not matches(["plomberie"], ["33"], ["plomberie"], ["40"])


def test_norm():
    assert norm("Électricité  ŒUVRE’s") == "electricite oeuvre's"
