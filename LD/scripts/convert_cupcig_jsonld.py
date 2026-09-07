#!/usr/bin/env python3
"""Convert CUP↔CIG flat JSON to JSON-LD via reshape + @context (+ optional frame).

JSON-LD framing is not a full ETL from tabular JSON: URI minting / nesting still
need a thin reshape step. For cupcig that step is mechanical; OpenCUP still needs
richer helpers (CV composite URIs, blank nodes, conditional types).
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
from pathlib import Path

from pyld import jsonld

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rdf_utils import LD_CONTEXT, PI_DATA

LOT_DATA = "https://w3id.org/italia/data/Lot/"
PCTR = "https://w3id.org/italia/onto/PublicContract/"
PI = "https://w3id.org/italia/PublicInvestment/onto/PublicInvestment/"
HAS_PROJECT = f"{PCTR}hasProject"
LOT_TYPE = f"{PCTR}Lot"
PROJECT_TYPE = f"{PI}Progetto_di_investimento_pubblico"


def reshape_cupcig_records(records: list[dict]) -> list[dict]:
    """Mint Lot/CUP URIs and nest hasProject — only non-context step for cupcig."""
    nodes: list[dict] = []
    for row in records:
        cig = str(row["CIG"]).strip()
        cup = str(row["CUP"]).strip().upper()
        nodes.append(
            {
                "@id": f"{LOT_DATA}{urllib.parse.quote(cig)}",
                "@type": "PCTR:Lot",
                "PCTR:hasProject": {
                    "@id": f"{PI_DATA}{urllib.parse.quote(cup)}",
                    "@type": "pi:Progetto_di_investimento_pubblico",
                },
            }
        )
    return nodes


def build_document(records: list[dict]) -> dict:
    """Pipeline-ready JSON-LD (same shape as former Handlebars output)."""
    return {
        "@context": {
            "pi": PI,
            "PCTR": PCTR,
        },
        "@graph": reshape_cupcig_records(records),
    }


def spike_document(records: list[dict]) -> dict:
    """Didactic path: absolute IRIs → expand → frame → compact with full LD_CONTEXT."""
    abs_nodes = []
    for row in records:
        cig = str(row["CIG"]).strip()
        cup = str(row["CUP"]).strip().upper()
        abs_nodes.append(
            {
                "@id": f"{LOT_DATA}{urllib.parse.quote(cig)}",
                "@type": LOT_TYPE,
                HAS_PROJECT: {
                    "@id": f"{PI_DATA}{urllib.parse.quote(cup)}",
                    "@type": PROJECT_TYPE,
                },
            }
        )
    expanded = jsonld.expand({"@graph": abs_nodes})
    frame = {
        "@type": LOT_TYPE,
        HAS_PROJECT: {"@type": PROJECT_TYPE},
    }
    framed = jsonld.frame(expanded, frame)
    return jsonld.compact(framed, LD_CONTEXT)


def convert_cupcig_file(src: Path, dest: Path) -> dict:
    data = json.loads(src.read_text(encoding="utf-8"))
    records = data["cupcig"] if isinstance(data, dict) else data
    doc = build_document(records)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return doc


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--src",
        type=Path,
        default=Path("srcdata/data/cupcig_candidature_comuni_finanziate.json"),
    )
    parser.add_argument(
        "--dest",
        type=Path,
        default=Path("LD/json-ld/cupcig_candidature_comuni_finanziate-ld.json"),
    )
    parser.add_argument(
        "--spike",
        action="store_true",
        help="Print flat → reshape → framed/compact sample and exit",
    )
    args = parser.parse_args()

    data = json.loads(args.src.read_text(encoding="utf-8"))
    records = data["cupcig"] if isinstance(data, dict) else data

    if args.spike:
        sample = records[:2]
        print("=== 1. flat JSON ===")
        print(json.dumps(sample, ensure_ascii=False, indent=2))
        print("\n=== 2. reshape (URI mint + nest) ===")
        print(json.dumps(reshape_cupcig_records(sample), ensure_ascii=False, indent=2))
        print("\n=== 3. expand + frame + compact (pyld) ===")
        print(json.dumps(spike_document(sample), ensure_ascii=False, indent=2))
        print("\n=== 4. pipeline document (context + @graph, then rdflib compact) ===")
        print(json.dumps(build_document(sample), ensure_ascii=False, indent=2))
        return

    doc = convert_cupcig_file(args.src, args.dest)
    print(f"Wrote {args.dest} ({len(doc.get('@graph', []))} nodes)")


if __name__ == "__main__":
    main()
