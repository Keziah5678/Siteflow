"""Normalisation des avis BOAMP réels (4 formats) et résumés."""
from datetime import datetime

from robot.boamp import extract_cpv, norm_dept, parse_record
from robot.departments import DEPARTMENTS
from robot.summary import deadline_fr, money, summarize


def by_id(raw, idweb):
    return parse_record(next(r for r in raw if r["idweb"] == idweb))


def test_only_new_works_and_services_notices(raw_records):
    notices = [parse_record(r) for r in raw_records]
    kept = [n for n in notices if n]
    assert kept and len(kept) < len(raw_records)  # résultats / rectificatifs ignorés
    for r, n in zip(raw_records, notices):
        if r["nature_categorise_libelle"] != "Avis de marché/":
            assert n is None


def test_every_kept_notice_has_core_fields(raw_records):
    for n in filter(None, map(parse_record, raw_records)):
        assert n.idweb and n.objet and n.url.startswith("https://www.boamp.fr/")
        assert n.departments and all(d in DEPARTMENTS for d in n.departments)


def test_cpv_extracted_from_eforms_and_national_formats(raw_records):
    eforms = [parse_record(r) for r in raw_records if r["donnees"].startswith('{"EFORMS')]
    national = [parse_record(r) for r in raw_records if r["donnees"].startswith('{"FNSimple')]
    assert any(n and n.cpv for n in eforms)
    assert any(n and n.cpv for n in national)
    assert all(len(c) == 8 and c.isdigit() for n in eforms + national if n for c in n.cpv)
    assert extract_cpv({"x": {"@listName": "cpv", "#text": "45330000-9"}}) == ["45330000"]


def test_department_is_the_worksite_not_the_diffusion_list(raw_records):
    # Diffusé dans 7 départements dont Paris, mais chantier à Schiltigheim (67).
    assert by_id(raw_records, "26-114610").departments == ["67"]
    # Lieu sans code postal ; acheteur (CHU de Besançon) dans le Doubs.
    assert by_id(raw_records, "26-114629").departments == ["25"]
    # Acheteur à Lyon, chantier dans la Drôme : on n'affiche pas « Lyon ».
    n = by_id(raw_records, "26-115552")
    assert n.departments == ["26"] and n.ville is None
    assert by_id(raw_records, "26-115549").departments == ["94"]


def test_dept_normalisation():
    assert norm_dept("8") == "08" and norm_dept("20B") == "2B" and norm_dept("978") == "971"


def test_summary_is_two_plain_lines(raw_records):
    n = by_id(raw_records, "26-115362")
    s = summarize(n.objet, n.acheteur, n.ville, n.departments, n.montant)
    line1, line2 = s.split("\n")
    assert "eaux usées" in line1 and "eau potable" in line1  # sigles EU/AEP traduits
    assert line1[0].isupper() and not line1.istitle()
    assert line2.startswith("Pour ") and "(11)" in line2
    assert all(len(l) <= 220 for l in (line1, line2))


def test_formatting_helpers():
    assert money(460000) == "460 k€" and money(1_500_000) == "1,5 M€" and money(None) is None
    assert deadline_fr(datetime(2027, 1, 22, 11)) == "22 janv. 2027"
    assert deadline_fr(None) == "non précisée"
