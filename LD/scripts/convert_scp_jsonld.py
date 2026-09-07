#!/usr/bin/env python3
"""Convert hub SCP bandi/esiti JSON to JSON-LD (reshape + @context).

Joins onto the same Lot/{CIG} URIs as cupcig. Adds ContractNotice (bando)
and Award (esito) nodes with contracting authority / winner CF URIs.
"""

from __future__ import annotations

import argparse
import json
import re
import urllib.parse
from pathlib import Path

PI_DATA = "https://w3id.org/italia/PublicInvestment/data/CUP/"
LOT_DATA = "https://w3id.org/italia/data/Lot/"
CF_DATA = "https://w3id.org/italia/data/CodiceFiscale/"
NOTICE_DATA = "https://w3id.org/italia/data/ContractNotice/"
AWARD_DATA = "https://w3id.org/italia/data/Award/"
PCTR = "https://w3id.org/italia/onto/PublicContract/"
COV = "https://w3id.org/italia/onto/COV/"
PI = "https://w3id.org/italia/PublicInvestment/onto/PublicInvestment/"

PLACEHOLDER_CUP = re.compile(
    r"^(ND|N\.D\.|N/D|NULL|NONE|0+|00)$",
    re.IGNORECASE,
)


def q(value: str) -> str:
    return urllib.parse.quote(str(value).strip(), safe="")


def present(value) -> bool:
    if value is None:
        return False
    s = str(value).strip()
    return s not in ("", "null", "None", "nan")


def valid_cup(cup) -> bool:
    if not present(cup):
        return False
    s = str(cup).strip().upper()
    if PLACEHOLDER_CUP.match(s):
        return False
    if s.startswith("00000000000000"):
        return False
    return True


def cf_node(cf: str, legal_name: str | None = None) -> dict:
    node: dict = {
        "@id": f"{CF_DATA}{q(cf)}",
        "@type": "COV:Organization",
    }
    if legal_name and present(legal_name):
        node["COV:legalName"] = str(legal_name).strip()
    return node


def reshape_bandi(records: list[dict]) -> list[dict]:
    nodes: list[dict] = []
    seen_notices: set[str] = set()
    for row in records:
        cig = str(row.get("cig") or "").strip()
        if not cig:
            continue
        lot_id = f"{LOT_DATA}{q(cig)}"
        lot: dict = {
            "@id": lot_id,
            "@type": "PCTR:Lot",
        }
        if present(row.get("oggetto_lotto")):
            lot["l0:name"] = str(row["oggetto_lotto"]).strip()
        elif present(row.get("oggetto_della_gara")):
            lot["l0:name"] = str(row["oggetto_della_gara"]).strip()
        if present(row.get("imp_lotto")):
            try:
                lot["PCTR:lotAmount"] = float(row["imp_lotto"])
            except (TypeError, ValueError):
                pass
        if present(row.get("cpv")):
            lot["PCTR:cpv"] = str(row["cpv"]).strip()
        if valid_cup(row.get("cup")):
            lot["PCTR:hasProject"] = {
                "@id": f"{PI_DATA}{q(str(row['cup']).strip().upper())}",
                "@type": "pi:Progetto_di_investimento_pubblico",
            }
        nodes.append(lot)

        id_gara = row.get("id_gara")
        if present(id_gara):
            notice_id = f"{NOTICE_DATA}{q(str(int(id_gara) if isinstance(id_gara, float) else id_gara))}"
            if notice_id not in seen_notices:
                seen_notices.add(notice_id)
                notice: dict = {
                    "@id": notice_id,
                    "@type": "PCTR:ContractNotice",
                    "PCTR:hasLot": {"@id": lot_id},
                }
                if present(row.get("oggetto_della_gara")):
                    notice["l0:name"] = str(row["oggetto_della_gara"]).strip()
                if present(row.get("data_pubblicazione_bando")):
                    notice["PCTR:publicationDate"] = str(row["data_pubblicazione_bando"])[:10]
                if present(row.get("url_bando")):
                    notice["rdfs:seeAlso"] = {"@id": str(row["url_bando"]).strip()}
                sa_cf = row.get("codice_fiscale_stazione_appaltante")
                if present(sa_cf):
                    notice["PCTR:contractingAuthority"] = cf_node(
                        str(sa_cf).strip(),
                        row.get("denominazione_stazione_appaltante"),
                    )
                nodes.append(notice)
            else:
                # Extra lot on same notice
                nodes.append(
                    {
                        "@id": notice_id,
                        "PCTR:hasLot": {"@id": lot_id},
                    }
                )
    return nodes


def reshape_esiti(records: list[dict]) -> list[dict]:
    nodes: list[dict] = []
    for i, row in enumerate(records):
        cig = str(row.get("cig") or "").strip()
        if not cig:
            continue
        lot_id = f"{LOT_DATA}{q(cig)}"
        award_key = f"{cig}-{row.get('id_gara')}-{row.get('cf_aggiudicatario') or row.get('aggiudicatario') or i}"
        award: dict = {
            "@id": f"{AWARD_DATA}{q(award_key)}",
            "@type": "PCTR:Award",
            "PCTR:awardedLot": {"@id": lot_id},
        }
        if present(row.get("imp_di_aggiudicazione")):
            try:
                award["PCTR:awardAmount"] = float(row["imp_di_aggiudicazione"])
            except (TypeError, ValueError):
                pass
        if present(row.get("data_aggiudicazione_definitiva")):
            award["PCTR:awardDate"] = str(row["data_aggiudicazione_definitiva"])[:10]
        if present(row.get("url_esito")):
            award["rdfs:seeAlso"] = {"@id": str(row["url_esito"]).strip()}
        if present(row.get("ribasso_di_aggiudicazione")):
            try:
                award["PCTR:awardDiscount"] = float(row["ribasso_di_aggiudicazione"])
            except (TypeError, ValueError):
                pass

        win_cf = row.get("cf_aggiudicatario")
        win_name = row.get("aggiudicatario")
        if present(win_cf):
            award["PCTR:hasWinner"] = cf_node(str(win_cf).strip(), win_name)
        elif present(win_name):
            award["PCTR:hasWinner"] = {
                "@type": "COV:Organization",
                "COV:legalName": str(win_name).strip(),
            }

        nodes.append(award)

        # Enrich lot lightly (same URI as cupcig)
        lot: dict = {"@id": lot_id, "@type": "PCTR:Lot"}
        if valid_cup(row.get("cup")):
            lot["PCTR:hasProject"] = {
                "@id": f"{PI_DATA}{q(str(row['cup']).strip().upper())}",
                "@type": "pi:Progetto_di_investimento_pubblico",
            }
        if present(row.get("cpv")):
            lot["PCTR:cpv"] = str(row["cpv"]).strip()
        nodes.append(lot)

        sa_cf = row.get("codice_fiscale_stazione_appaltante")
        if present(sa_cf):
            nodes.append(
                cf_node(
                    str(sa_cf).strip(),
                    row.get("denominazione_stazione_appaltante"),
                )
            )
    return nodes


def build_document(bandi: list[dict], esiti: list[dict]) -> dict:
    return {
        "@context": {
            "pi": PI,
            "PCTR": PCTR,
            "COV": COV,
            "l0": "https://w3id.org/italia/onto/l0/",
            "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
            "xsd": "http://www.w3.org/2001/XMLSchema#",
        },
        "@graph": reshape_bandi(bandi) + reshape_esiti(esiti),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--bandi",
        type=Path,
        default=Path("srcdata/data/SCP_bandi.json"),
    )
    parser.add_argument(
        "--esiti",
        type=Path,
        default=Path("srcdata/data/SCP_esiti.json"),
    )
    parser.add_argument(
        "--dest",
        type=Path,
        default=Path("LD/json-ld/scp_bandi_esiti-ld.json"),
    )
    args = parser.parse_args()

    bandi_data = json.loads(args.bandi.read_text(encoding="utf-8"))
    esiti_data = json.loads(args.esiti.read_text(encoding="utf-8"))
    bandi = bandi_data["bandi"] if isinstance(bandi_data, dict) else bandi_data
    esiti = esiti_data["esiti"] if isinstance(esiti_data, dict) else esiti_data

    doc = build_document(bandi, esiti)
    args.dest.parent.mkdir(parents=True, exist_ok=True)
    args.dest.write_text(
        json.dumps(doc, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Wrote {args.dest} "
        f"({len(doc['@graph'])} nodes from {len(bandi)} bandi + {len(esiti)} esiti)"
    )


if __name__ == "__main__":
    main()
