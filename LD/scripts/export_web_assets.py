#!/usr/bin/env python3
"""Export JSON assets for the static web app from RDF/Turtle files."""

from __future__ import annotations

import html
import json
from pathlib import Path

from rdflib import Graph, Literal, URIRef
from rdflib.namespace import RDF, OWL

ROOT = Path(__file__).resolve().parents[2]
TTL_DIR = ROOT / "LD" / "ttl"
OUT_DIR = ROOT / "web" / "public" / "data"

PI = URIRef("https://w3id.org/italia/PublicInvestment/onto/PublicInvestment/")
PI_DATA = "https://w3id.org/italia/PublicInvestment/data/CUP/"
PO_DATA = "https://w3id.org/italia/data/PublicOrganization/"
LOT_DATA = "https://w3id.org/italia/data/Lot/"
CALL_DATA = "https://w3id.org/italia/data/Call/"

DATASETS = {
    "opencup": "opencup_candidature_comuni_finanziate-ld.ttl",
    "candidature": "candidature_comuni_finanziate-ld.ttl",
    "cupcig": "cupcig_candidature_comuni_finanziate-ld.ttl",
    "enti_ipa": "candidature_enti_ipa-ld.ttl",
}

OPEN_CUP_SAMPLE = 10

PRJ_HAS_CALL = URIRef("https://w3id.org/italia/onto/Project/hasCall")
HA_TITOLARE = PI + "ha_soggetto_titolare"
HA_INTERVENTO = PI + "ha_intervento_di_investimento_pubblico"
ONTO_NS = "https://w3id.org/italia/PublicInvestment/onto/"


def short_id(uri: str) -> str:
    for prefix, label in [
        (PI_DATA, "cup:"),
        (PO_DATA, "po:"),
        (LOT_DATA, "lot:"),
        (CALL_DATA, "call:"),
        ("https://w3id.org/italia/PublicInvestment/controlled-vocabulary/", "picv:"),
        (str(PI), "pi:"),
        ("https://w3id.org/italia/onto/COV/", "COV:"),
        ("https://w3id.org/italia/onto/CLV/", "CLV:"),
        ("https://w3id.org/italia/onto/Project/", "PRJ:"),
        ("https://w3id.org/italia/onto/PublicContract/", "PCTR:"),
    ]:
        if uri.startswith(prefix):
            return label + uri[len(prefix) :]
    if uri.startswith("_:"):
        return uri
    if "#" in uri:
        return uri.rsplit("#", 1)[-1]
    return uri.rsplit("/", 1)[-1]


def node_type(g: Graph, subject) -> str:
    types = [short_id(str(t)) for t in g.objects(subject, RDF.type)]
    for preferred in (
        "pi:Progetto_di_investimento_pubblico",
        "pi:Intervento_di_investimento_pubblico",
        "COV:PublicOrganization",
        "PCTR:Lot",
        "PRJ:Call",
        "skos:Concept",
        "CLV:Address",
    ):
        if preferred in types:
            return preferred
    return types[0] if types else "Resource"


def normalize_display_text(text: str) -> str:
    """Corregge byte Windows-1252 (es. \\x92) e tipografici non supportati dal canvas."""
    win1252 = {
        0x91: "'",
        0x92: "'",
        0x93: '"',
        0x94: '"',
        0x96: "–",
        0x97: "—",
    }
    apostrophe = {"\u2018", "\u2019", "\u02bc", "`", "\u00b4"}
    quote = {"\u201c", "\u201d", "\u00ab", "\u00bb"}
    out: list[str] = []
    for ch in text:
        code = ord(ch)
        if 0x80 <= code <= 0x9F:
            out.append(win1252.get(code, ""))
        elif ch in apostrophe:
            out.append("'")
        elif ch in quote:
            out.append('"')
        elif code == 0xA0:
            out.append(" ")
        elif code < 0x20 and ch not in "\n\r":
            continue
        else:
            out.append(ch)
    return "".join(out)


def node_label(g: Graph, subject, ntype: str) -> str:
    for pred in (
        URIRef("https://w3id.org/italia/onto/COV/legalName"),
        URIRef("http://www.w3.org/2004/02/skos/core#prefLabel"),
        URIRef("https://w3id.org/italia/onto/l0/name"),
        URIRef("https://w3id.org/italia/PublicInvestment/onto/PublicInvestment/oggetto_progettuale"),
    ):
        val = next(g.objects(subject, pred), None)
        if val:
            text = str(val)
            text = html.unescape(text)
            text = normalize_display_text(text)
            return text[:60] + ("…" if len(text) > 60 else "")
    sid = short_id(str(subject))
    if sid.startswith("cup:"):
        return sid[4:]
    if sid.startswith("lot:"):
        return f"CIG {sid[4:8]}…"
    return sid


def graph_to_json(g: Graph, dataset: str, limit_nodes: int | None = None) -> dict:
    nodes_map: dict[str, dict] = {}
    edges: list[dict] = []

    def add_node(s):
        sid = str(s)
        if sid not in nodes_map:
            ntype = node_type(g, s)
            nodes_map[sid] = {
                "id": sid,
                "shortId": short_id(sid),
                "label": node_label(g, s, ntype),
                "type": ntype,
                "dataset": dataset,
            }

    subjects = list(g.subjects())
    if limit_nodes and len(subjects) > limit_nodes:
        # Prefer CUP projects as seeds
        cup_subjects = [
            s for s in subjects
            if str(s).startswith(PI_DATA) and (PI + "Progetto_di_investimento_pubblico") in g.objects(s, RDF.type)
        ]
        seeds = cup_subjects[:limit_nodes] if cup_subjects else subjects[:limit_nodes]
        seen = set(seeds)
        for seed in list(seeds):
            for _, o in g.predicate_objects(seed):
                if isinstance(o, URIRef) and o in g.subjects():
                    seen.add(o)
            for p, o in g.predicate_objects(seed):
                if isinstance(o, URIRef):
                    seen.add(o)
        subjects = list(seen)[: limit_nodes * 4]

    for s in subjects:
        if not isinstance(s, URIRef) and not str(s).startswith("_:"):
            continue
        add_node(s)
        for p, o in g.predicate_objects(s):
            pred = short_id(str(p))
            if pred in ("rdf:type", "type"):
                continue
            if isinstance(o, URIRef):
                add_node(o)
                edges.append({
                    "source": str(s),
                    "target": str(o),
                    "label": pred,
                })
            elif isinstance(o, Literal) and pred.startswith("pi:"):
                lit_id = f"{s}|{pred}"
                if lit_id not in nodes_map:
                    nodes_map[lit_id] = {
                        "id": lit_id,
                        "shortId": pred,
                        "label": str(o)[:40],
                        "type": "Literal",
                        "dataset": dataset,
                    }
                edges.append({"source": str(s), "target": lit_id, "label": pred})

    return {
        "dataset": dataset,
        "nodes": list(nodes_map.values()),
        "edges": edges,
    }


def is_ontology_class_uri(uri: str) -> bool:
    return "/onto/" in uri and not uri.startswith(PI_DATA)


def dedupe_edges(edges: list[dict]) -> list[dict]:
    seen: set[tuple[str, str, str]] = set()
    out: list[dict] = []
    for e in edges:
        key = (e["source"], e["target"], e["label"])
        if key in seen:
            continue
        seen.add(key)
        out.append(e)
    return out


def select_sample_cup_uris(g: Graph, n: int = OPEN_CUP_SAMPLE) -> list[URIRef]:
    """CUP campione condiviso da tutti i grafi separati (ordinamento stabile)."""
    cups = sorted(
        g.subjects(RDF.type, PI + "Progetto_di_investimento_pubblico"),
        key=lambda c: str(c),
    )
    return list(cups)[:n]


def build_cup_neighborhood_graph(
    g: Graph,
    cup_uris: list[URIRef],
    dataset: str,
    *,
    neighbor_preds: tuple[tuple[URIRef, str], ...],
    include_pi_literals: bool = False,
) -> dict:
    """Grafo a stella su N CUP: solo vicini diretti selezionati."""
    cup_set = {str(c) for c in cup_uris}
    nodes_map: dict[str, dict] = {}
    edges: list[dict] = []

    def add_ds_node(s) -> None:
        sid = str(s)
        if sid not in nodes_map:
            ntype = node_type(g, s)
            nodes_map[sid] = {
                "id": sid,
                "shortId": short_id(sid),
                "label": node_label(g, s, ntype),
                "type": ntype,
                "dataset": dataset,
            }

    def link(source, target, pred_label: str) -> None:
        add_ds_node(source)
        add_ds_node(target)
        edges.append({"source": str(source), "target": str(target), "label": pred_label})

    cups_in_graph = [
        c for c in cup_uris if (c, RDF.type, PI + "Progetto_di_investimento_pubblico") in g
    ]

    for cup in cups_in_graph:
        add_ds_node(cup)
        for pred, label in neighbor_preds:
            for obj in g.objects(cup, pred):
                if isinstance(obj, URIRef) and is_ontology_class_uri(str(obj)):
                    continue
                link(cup, obj, label)
                break
        if include_pi_literals:
            for p, o in g.predicate_objects(cup):
                pred = short_id(str(p))
                if pred in ("rdf:type", "type") or not pred.startswith("pi:"):
                    continue
                if isinstance(o, Literal):
                    lit_id = f"{cup}|{pred}"
                    if lit_id not in nodes_map:
                        nodes_map[lit_id] = {
                            "id": lit_id,
                            "shortId": pred,
                            "label": str(o)[:40],
                            "type": "Literal",
                            "dataset": dataset,
                        }
                    edges.append({"source": str(cup), "target": lit_id, "label": pred})

    cup_codes = [short_id(str(c)).replace("cup:", "") for c in cups_in_graph]
    return {
        "dataset": dataset,
        "nodes": list(nodes_map.values()),
        "edges": dedupe_edges(edges),
        "sample_cups": cup_codes,
        "sample_note": f"{len(cups_in_graph)} CUP campionati: {', '.join(cup_codes)}",
    }


def build_opencup_sample_graph(g: Graph, cup_uris: list[URIRef]) -> dict:
    return build_cup_neighborhood_graph(
        g,
        cup_uris,
        "opencup",
        neighbor_preds=(
            (HA_TITOLARE, "pi:ha_soggetto_titolare"),
            (PRJ_HAS_CALL, "PRJ:hasCall"),
            (HA_INTERVENTO, "pi:ha_intervento_di_investimento_pubblico"),
        ),
    )


def build_candidature_sample_graph(g: Graph, cup_uris: list[URIRef]) -> dict:
    prj_programme = URIRef("https://w3id.org/italia/onto/Project/hasProgramme")
    return build_cup_neighborhood_graph(
        g,
        cup_uris,
        "candidature",
        neighbor_preds=(
            (PRJ_HAS_CALL, "PRJ:hasCall"),
            (prj_programme, "PRJ:hasProgramme"),
        ),
        include_pi_literals=True,
    )


def build_cupcig_sample_graph(g: Graph, cup_uris: list[URIRef]) -> dict:
    cup_set = {str(c) for c in cup_uris}
    pctr_has_project = URIRef("https://w3id.org/italia/onto/PublicContract/hasProject")
    lot_type = URIRef("https://w3id.org/italia/onto/PublicContract/Lot")
    nodes_map: dict[str, dict] = {}
    edges: list[dict] = []

    def add_ds_node(s) -> None:
        sid = str(s)
        if sid not in nodes_map:
            ntype = node_type(g, s)
            nodes_map[sid] = {
                "id": sid,
                "shortId": short_id(sid),
                "label": node_label(g, s, ntype),
                "type": ntype,
                "dataset": "cupcig",
            }

    linked_cups: set[str] = set()
    for lot in g.subjects(RDF.type, lot_type):
        for cup in g.objects(lot, pctr_has_project):
            if str(cup) not in cup_set:
                continue
            add_ds_node(lot)
            add_ds_node(cup)
            linked_cups.add(str(cup))
            edges.append({
                "source": str(lot),
                "target": str(cup),
                "label": "PCTR:hasProject",
            })

    n_lots = sum(1 for n in nodes_map.values() if n["type"] == "PCTR:Lot")
    return {
        "dataset": "cupcig",
        "nodes": list(nodes_map.values()),
        "edges": dedupe_edges(edges),
        "sample_note": f"{n_lots} lotti CIG per {len(linked_cups)} CUP campionati",
    }


def related_org_uris(all_g: Graph, cup_uris: list[URIRef]) -> set[str]:
    orgs: set[str] = set()
    for cup in cup_uris:
        for org in all_g.objects(cup, HA_TITOLARE):
            orgs.add(str(org))
            for ipa in all_g.subjects(OWL.sameAs, org):
                orgs.add(str(ipa))
    return orgs


def build_enti_ipa_sample_graph(g: Graph, org_uris: set[str]) -> dict:
    nodes_map: dict[str, dict] = {}
    edges: list[dict] = []

    def add_ds_node(s) -> None:
        sid = str(s)
        if sid not in nodes_map:
            ntype = node_type(g, s)
            nodes_map[sid] = {
                "id": sid,
                "shortId": short_id(sid),
                "label": node_label(g, s, ntype),
                "type": ntype,
                "dataset": "enti_ipa",
            }

    seed = set(org_uris)
    for s in set(g.subjects()):
        if str(s) not in seed:
            continue
        add_ds_node(s)
        for p, o in g.predicate_objects(s):
            pred = short_id(str(p))
            if pred in ("rdf:type", "type"):
                continue
            if isinstance(o, URIRef) and (str(o) in seed or pred == "owl:sameAs"):
                add_ds_node(o)
                edges.append({"source": str(s), "target": str(o), "label": pred})

    return {
        "dataset": "enti_ipa",
        "nodes": list(nodes_map.values()),
        "edges": dedupe_edges(edges),
        "sample_note": f"{len(nodes_map)} enti IndicePA collegati ai CUP campionati",
    }


def wrap_sample_graph(data: dict, sample_cups: list[str]) -> dict:
    data["coverage"] = "sample"
    data["sample_cups"] = sample_cups
    if "sample_note" not in data:
        data["sample_note"] = f"{len(sample_cups)} CUP campionati (statico, build time)"
    return data


def build_mappings() -> dict:
    opencup_fields = [
        ("CUP", "cup:{CUP}", "@id progetto / CUP", "opencup"),
        ("DESCRIZIONE_SINTETICA_CUP", "pi:oggetto_progettuale", "intervento", "opencup"),
        ("PIVA_CODFISCALE_SOG_TITOLARE", "pi:ha_soggetto_titolare → po:{CF}", "ente titolare", "opencup"),
        ("CODICE_SETTORE_INTERVENTO", "pi:ha_settore_intervento", "classificazione SKOS", "opencup"),
        ("COSTO_PROGETTO", "pi:costo_del_progetto", "importo", "opencup"),
        ("FINANZIAMENTO_PROGETTO", "pi:importo_finanziamento_pubblico", "importo", "opencup"),
        ("INDIRIZZO_INTERVENTO / COMUNE", "pi:ha_localizzazione / pi:ha_indirizzo_o_riferimento", "CLV:Address", "opencup"),
    ]
    candidature_fields = [
        ("codice_cup", "cup:{CUP}", "@id progetto", "candidature"),
        ("importo_finanziamento", "pi:importo_finanziamento_pubblico", "importo PNRR", "candidature"),
        ("avviso", "PRJ:hasCall → call:{avviso}", "avviso PNRR", "candidature"),
    ]
    cupcig_fields = [
        ("CUP", "PCTR:hasProject → cup:{CUP}", "collegamento CUP", "cupcig"),
        ("CIG", "lot:{CIG}", "@id lotto ANAC", "cupcig"),
    ]
    enti_fields = [
        ("Codice_IPA", "po:{IPA}", "@id ente", "enti_ipa"),
        ("Codice_fiscale_ente", "owl:sameAs → po:{CF}", "ponte semantico", "enti_ipa"),
        ("Denominazione_ente", "COV:legalName", "denominazione", "enti_ipa"),
    ]
    joins = [
        {
            "id": "cup_hub",
            "label": "CUP condiviso",
            "uri": "cup:{CUP}",
            "datasets": ["opencup", "candidature", "cupcig"],
            "note": "Lo stesso URI identifica il progetto in tutti i grafi: il collegamento è automatico, non serve una join tabellare.",
        },
        {
            "id": "org_sameas",
            "label": "Ente IPA ↔ CF",
            "uri": "owl:sameAs",
            "datasets": ["enti_ipa", "opencup"],
            "note": "IndicePA e OpenCUP usano URI diversi collegati da owl:sameAs sul codice fiscale.",
        },
        {
            "id": "cup_cig",
            "label": "Lotto CIG → CUP",
            "uri": "PCTR:hasProject",
            "datasets": ["cupcig", "opencup"],
            "note": "I lotti ANAC puntano al progetto CUP tramite proprietà ontologica PCTR:hasProject.",
        },
        {
            "id": "pnrr_call",
            "label": "Avviso PNRR",
            "uri": "PRJ:hasCall → call:{avviso}",
            "datasets": ["candidature", "opencup"],
            "note": "PA Digitale arricchisce lo stesso CUP con l'avviso PNRR di finanziamento.",
        },
    ]
    templates = [
        {"file": t.name, "dataset": t.stem}
        for t in sorted((ROOT / "LD" / "templates").glob("*.hbs"))
    ]
    return {
        "templates": templates,
        "fieldMappings": opencup_fields + candidature_fields + cupcig_fields + enti_fields,
        "semanticJoins": joins,
    }


def sparql_select(g: Graph, query: str) -> list[dict]:
    rows = []
    for row in g.query(query):
        rows.append({str(v): str(row[v]) if row[v] is not None else None for v in row.labels})
    return rows


def build_analytics(all_g: Graph) -> None:
    out = OUT_DIR / "analytics"
    out.mkdir(parents=True, exist_ok=True)

    by_funder = sparql_select(all_g, """
        PREFIX pi: <https://w3id.org/italia/PublicInvestment/onto/PublicInvestment/>
        PREFIX COV: <https://w3id.org/italia/onto/COV/>
        SELECT ?funderName (SUM(xsd:decimal(?totalCost)) AS ?total)
        WHERE {
            ?prj a pi:Progetto_di_investimento_pubblico ;
                 pi:ha_soggetto_titolare ?funder .
            ?funder COV:legalName ?funderName .
            OPTIONAL { ?prj pi:importo_finanziamento_pubblico ?fin }
            OPTIONAL { ?prj pi:costo_del_progetto ?costo }
            BIND(COALESCE(?fin, ?costo) AS ?totalCost)
            FILTER(BOUND(?totalCost))
        }
        GROUP BY ?funderName
        ORDER BY DESC(?total)
        LIMIT 15
    """)
    write_json(out / "cost_by_funder.json", {
        "title": "Costo per ente titolare (top 15)",
        "labels": [r["funderName"] for r in by_funder],
        "series": [{"name": "Euro", "data": [float(r["total"]) for r in by_funder]}],
    })

    by_call = sparql_select(all_g, """
        PREFIX pi: <https://w3id.org/italia/PublicInvestment/onto/PublicInvestment/>
        PREFIX PRJ: <https://w3id.org/italia/onto/Project/>
        PREFIX l0: <https://w3id.org/italia/onto/l0/>
        SELECT ?callName (SUM(xsd:decimal(?totalCost)) AS ?total)
        WHERE {
            ?prj a pi:Progetto_di_investimento_pubblico ;
                 PRJ:hasCall ?call .
            ?call l0:name ?callName .
            OPTIONAL { ?prj pi:importo_finanziamento_pubblico ?fin }
            OPTIONAL { ?prj pi:costo_del_progetto ?costo }
            BIND(COALESCE(?fin, ?costo) AS ?totalCost)
            FILTER(BOUND(?totalCost))
        }
        GROUP BY ?callName
        ORDER BY DESC(?total)
        LIMIT 12
    """)
    write_json(out / "cost_by_call.json", {
        "title": "Costo per avviso PNRR",
        "labels": [r["callName"][:50] for r in by_call],
        "series": [{"name": "Euro", "data": [float(r["total"]) for r in by_call]}],
    })

    counts = {
        "cups": len(list(all_g.subjects(RDF.type, PI + "Progetto_di_investimento_pubblico"))),
        "lots": len(list(all_g.subjects(RDF.type, URIRef("https://w3id.org/italia/onto/PublicContract/Lot")))),
        "orgs": len(list(all_g.subjects(RDF.type, URIRef("https://w3id.org/italia/onto/COV/PublicOrganization")))),
        "triples": len(all_g),
    }
    write_json(out / "counts.json", counts)

    cup_cig_dist = sparql_select(all_g, """
        PREFIX pi: <https://w3id.org/italia/PublicInvestment/onto/PublicInvestment/>
        PREFIX PCTR: <https://w3id.org/italia/onto/PublicContract/>
        SELECT ?nLots (COUNT(?cup) AS ?nCups)
        WHERE {
            {
                SELECT ?cup (COUNT(?lot) AS ?nLots) WHERE {
                    ?cup a pi:Progetto_di_investimento_pubblico .
                    ?lot a <https://w3id.org/italia/onto/PublicContract/Lot> ;
                         PCTR:hasProject ?cup .
                }
                GROUP BY ?cup
            }
        }
        GROUP BY ?nLots
        ORDER BY ?nLots
    """)
    write_json(out / "cup_cig_distribution.json", {
        "title": "Distribuzione CUP per numero di CIG (ANAC)",
        "labels": [f"{r['nLots']} CIG" for r in cup_cig_dist],
        "series": [{"name": "Progetti CUP", "data": [int(r["nCups"]) for r in cup_cig_dist]}],
    })

    top_cup_cig = sparql_select(all_g, """
        PREFIX pi: <https://w3id.org/italia/PublicInvestment/onto/PublicInvestment/>
        PREFIX PCTR: <https://w3id.org/italia/onto/PublicContract/>
        SELECT ?cup (COUNT(?lot) AS ?nLots)
        WHERE {
            ?cup a pi:Progetto_di_investimento_pubblico .
            ?lot a <https://w3id.org/italia/onto/PublicContract/Lot> ;
                 PCTR:hasProject ?cup .
        }
        GROUP BY ?cup
        ORDER BY DESC(?nLots)
        LIMIT 15
    """)
    write_json(out / "top_cup_cig.json", {
        "title": "CUP con più lotti CIG collegati (top 15)",
        "labels": [short_id(r["cup"]).replace("cup:", "") for r in top_cup_cig],
        "series": [{"name": "Lotti CIG", "data": [int(r["nLots"]) for r in top_cup_cig]}],
    })

    build_scope_analytics(out)


def build_scope_analytics(out: Path) -> None:
    """Documenta lo scope PA Digitale dei filtri tabellari (srcdata/data)."""
    data_dir = ROOT / "srcdata" / "data"
    raw_pad = ROOT / "srcdata" / "rawdata" / "candidature_comuni_finanziate.json"

    scope: dict = {
        "title": "Scope PA Digitale nel repository",
        "definition": (
            "CUP presenti in PA Digitale (candidature comuni finanziate) che ANAC collega "
            "a un CIG con esito di gara pubblicato. Tutti i dataset filtrati derivano da questo insieme."
        ),
        "filters": [
            {
                "step": "01_filter_cup_json",
                "rule": "PA Digitale ∩ ANAC cup_json ∩ v_od_esiti (CIG con esito)",
                "role": "Definisce l'insieme CUP/CIG hub",
            },
            {
                "step": "04_filter_cup_candidature",
                "rule": "Candidature PA Digitale il cui CUP è nell'hub",
                "role": "Grafo PA Digitale completo in RDF",
            },
            {
                "step": "03_filter_cup_od_bandi_esiti",
                "rule": "Bandi ed esiti ANAC sui CIG dell'hub",
                "role": "Tabellare (non ancora in RDF)",
            },
            {
                "step": "02_filter_cup_opencup",
                "rule": "OpenCUP.parquet filtrato sui CUP dell'hub",
                "role": "Metadati progetto / titolare",
            },
            {
                "step": "05_filter_enti_ipa",
                "rule": "IndicePA via CF OpenCUP oppure codice_ipa PA Digitale",
                "role": "Ponte semantico enti",
            },
        ],
    }

    if raw_pad.exists():
        raw = json.loads(raw_pad.read_text(encoding="utf-8"))
        scope["padigitale_raw_cups"] = len({r["codice_cup"] for r in raw})

    hub_path = data_dir / "cupcig_candidature_comuni_finanziate.json"
    if hub_path.exists():
        hub = json.loads(hub_path.read_text(encoding="utf-8"))["cupcig"]
        scope["hub_cups"] = len({r["CUP"] for r in hub})
        scope["hub_cigs"] = len({r["CIG"] for r in hub})
        scope["hub_pairs"] = len(hub)

    cand_path = data_dir / "candidature_comuni_finanziate.json"
    if cand_path.exists():
        cand = json.loads(cand_path.read_text(encoding="utf-8"))["candidature"]
        scope["padigitale_filtered_cups"] = len({r["codice_cup"] for r in cand})
        scope["padigitale_rows"] = len(cand)
        scope["padigitale_ipa_codes"] = len({r["codice_ipa"] for r in cand})

    oc_path = data_dir / "opencup_candidature_comuni_finanziate.json"
    if oc_path.exists():
        oc = json.loads(oc_path.read_text(encoding="utf-8"))["opencup"]
        scope["opencup_cups"] = len({r["CUP"] for r in oc})
        if scope.get("hub_cups"):
            scope["opencup_missing_from_hub"] = scope["hub_cups"] - scope["opencup_cups"]

    ipa_path = data_dir / "candidature_enti_ipa.json"
    if ipa_path.exists():
        scope["enti_ipa"] = len(json.loads(ipa_path.read_text(encoding="utf-8"))["enti"])

    bandi_path = data_dir / "SCP_bandi.json"
    esiti_path = data_dir / "SCP_esiti.json"
    if bandi_path.exists() and esiti_path.exists() and hub_path.exists():
        hub_cigs = {r["CIG"] for r in json.loads(hub_path.read_text(encoding="utf-8"))["cupcig"]}
        bandi = json.loads(bandi_path.read_text(encoding="utf-8"))["bandi"]
        esiti = json.loads(esiti_path.read_text(encoding="utf-8"))["esiti"]
        b_cigs = {(r.get("cig") or r.get("CIG") or "").upper() for r in bandi}
        e_cigs = {(r.get("cig") or r.get("CIG") or "").upper() for r in esiti}
        hub_upper = {c.upper() for c in hub_cigs}
        scope["scp_bandi_cigs"] = len(hub_upper & b_cigs)
        scope["scp_esiti_cigs"] = len(hub_upper & e_cigs)
        scope["hub_cigs_without_bando"] = len(hub_upper - b_cigs)

    scope["gaps"] = [
        "SCP bandi/esiti filtrati ma non convertiti in RDF (manca template LD).",
        "OpenCUP.parquet non copre tutti i CUP dell'hub (6 CUP senza riga OpenCUP).",
        "Il filtro 01 esclude PA Digitale senza mapping ANAC o senza esito gara.",
    ]

    write_json(out / "scope.json", scope)


def find_hub_cup(g: Graph):
    """CUP con un solo CIG, avviso PNRR e ente collegato a IndicePA via sameAs."""
    rows = sparql_select(g, """
        PREFIX pi: <https://w3id.org/italia/PublicInvestment/onto/PublicInvestment/>
        PREFIX PCTR: <https://w3id.org/italia/onto/PublicContract/>
        PREFIX PRJ: <https://w3id.org/italia/onto/Project/>
        SELECT ?cup (COUNT(DISTINCT ?lot) AS ?nLots) WHERE {
            ?cup a pi:Progetto_di_investimento_pubblico ;
                 PRJ:hasCall ?call ;
                 pi:ha_soggetto_titolare ?org .
            ?lot a <https://w3id.org/italia/onto/PublicContract/Lot> ;
                 PCTR:hasProject ?cup .
            ?ipaOrg owl:sameAs ?org .
        }
        GROUP BY ?cup
        HAVING (COUNT(DISTINCT ?lot) = 1)
        LIMIT 1
    """)
    if not rows:
        return None
    return URIRef(rows[0]["cup"])


def build_cup_union(all_g: Graph, cup) -> dict:
    """Sottografo unione semantica per un singolo CUP (hub tra i 4 dataset)."""
    cup_code = short_id(str(cup)).replace("cup:", "")
    if (cup, RDF.type, PI + "Progetto_di_investimento_pubblico") not in all_g:
        return empty_subgraph(f"cup_{cup_code}")

    prj_has_call = URIRef("https://w3id.org/italia/onto/Project/hasCall")
    pctr_has_project = URIRef("https://w3id.org/italia/onto/PublicContract/hasProject")
    ha_titolare = PI + "ha_soggetto_titolare"
    ha_intervento = PI + "ha_intervento_di_investimento_pubblico"

    call = next(all_g.objects(cup, prj_has_call), None)
    org_cf = next(all_g.objects(cup, ha_titolare), None)
    org_ipa = next(all_g.subjects(OWL.sameAs, org_cf), None) if org_cf else None
    lots = list(all_g.subjects(pctr_has_project, cup))
    intervento = next(all_g.objects(cup, ha_intervento), None)

    nodes_map: dict[str, dict] = {}
    edges: list[dict] = []

    def link(source, target, pred_label: str):
        add_node(all_g, nodes_map, source)
        add_node(all_g, nodes_map, target)
        edges.append({"source": str(source), "target": str(target), "label": pred_label})

    add_node(all_g, nodes_map, cup)
    if call:
        link(cup, call, "PRJ:hasCall")
    if org_cf:
        link(cup, org_cf, "pi:ha_soggetto_titolare")
    if org_ipa and org_cf:
        link(org_ipa, org_cf, "owl:sameAs")
    for lot in lots:
        link(lot, cup, "PCTR:hasProject")
    if intervento:
        link(cup, intervento, "pi:ha_intervento_di_investimento_pubblico")
        nodes_map[str(intervento)]["dataset"] = "opencup"

    datasets_involved = sorted({
        n["dataset"] for n in nodes_map.values() if n["dataset"] != "shared"
    })
    n_lots = len(lots)
    lotto_label = "1 lotto" if n_lots == 1 else f"{n_lots} lotti"
    note = (
        f"Il CUP {cup_code} è lo stesso nodo RDF in OpenCUP e PA Digitale (URI condiviso). "
        f"Collegato a {lotto_label} CIG ANAC"
        f"{', avviso PNRR' if call else ''}"
        f"{', ente titolare' if org_cf else ''}"
        f"{', IndicePA via owl:sameAs' if org_ipa else ''} — nessuna join SQL."
    )

    join_predicates = ["owl:sameAs", "PCTR:hasProject", "PRJ:hasCall", "pi:ha_soggetto_titolare"]
    return wrap_subgraph(
        f"cup_{cup_code}",
        f"Unione semantica — CUP {cup_code}",
        note,
        list(nodes_map.values()),
        dedupe_edges(edges),
        datasets_involved,
        join_predicates=join_predicates,
    )


def build_unione_completa(all_g: Graph) -> dict:
    """Sottografo demo: primo CUP campione con tutti e 4 i dataset collegati."""
    cup = find_hub_cup(all_g)
    if not cup:
        return empty_subgraph("unione_completa")
    result = build_cup_union(all_g, cup)
    result["id"] = "unione_completa"
    return result


def extract_subgraph(all_g: Graph, pattern_id: str) -> dict:
    """Build small demo subgraphs for semantic union page."""
    if pattern_id == "unione_completa":
        return build_unione_completa(all_g)

    if pattern_id == "cup_hub":
        cup = next(all_g.subjects(RDF.type, PI + "Progetto_di_investimento_pubblico"), None)
        if not cup:
            return empty_subgraph(pattern_id)
        nodes, edges = bfs_subgraph(all_g, cup, depth=2, max_nodes=14)
        return wrap_subgraph(pattern_id, "Un CUP attraversa OpenCUP, PNRR e l'ente titolare",
            "Lo stesso URI cup: collega automaticamente i dati da dataset diversi.", nodes, edges,
            ["opencup", "candidature"], join_predicates=["PRJ:hasCall", "pi:ha_soggetto_titolare"])

    if pattern_id == "org_bridge":
        same_as = next(all_g.triples((None, OWL.sameAs, None)), None)
        if not same_as:
            return empty_subgraph(pattern_id)
        s, _, o = same_as
        nodes, edges = bfs_subgraph(all_g, s, depth=1, max_nodes=10)
        nodes2, edges2 = bfs_subgraph(all_g, o, depth=1, max_nodes=10)
        merge_graph(nodes, edges, nodes2, edges2)
        return wrap_subgraph(pattern_id, "IndicePA ↔ OpenCUP via owl:sameAs",
            "Due URI distinti per lo stesso ente, collegati semanticamente.", nodes, edges,
            ["enti_ipa", "opencup"], join_predicates=["owl:sameAs"])

    if pattern_id == "cup_cig":
        lot = next(all_g.subjects(RDF.type, URIRef("https://w3id.org/italia/onto/PublicContract/Lot")), None)
        if not lot:
            return empty_subgraph(pattern_id)
        nodes, edges = bfs_subgraph(all_g, lot, depth=2, max_nodes=12)
        return wrap_subgraph(pattern_id, "Lotto CIG → progetto CUP",
            "ANAC collega l'appalto al CUP con PCTR:hasProject.", nodes, edges,
            ["cupcig", "opencup"], join_predicates=["PCTR:hasProject"])

    if pattern_id == "pnrr_avviso":
        call = next(all_g.subjects(RDF.type, URIRef("https://w3id.org/italia/onto/Project/Call")), None)
        if not call:
            return empty_subgraph(pattern_id)
        nodes, edges = bfs_subgraph(all_g, call, depth=2, max_nodes=15)
        return wrap_subgraph(pattern_id, "Cluster avviso PNRR",
            "Più CUP condividono lo stesso avviso tramite PRJ:hasCall.", nodes, edges,
            ["candidature", "opencup"], join_predicates=["PRJ:hasCall"])

    return empty_subgraph(pattern_id)


def bfs_subgraph(g: Graph, start, depth: int, max_nodes: int):
    nodes_map: dict[str, dict] = {}
    edges: list[dict] = []
    frontier = {start}
    visited = set()

    for _ in range(depth + 1):
        if len(visited) >= max_nodes:
            break
        next_frontier = set()
        for s in frontier:
            if s in visited:
                continue
            visited.add(s)
            add_node(g, nodes_map, s)
            if len(visited) >= max_nodes:
                break
            for p, o in g.predicate_objects(s):
                pred = short_id(str(p))
                if pred in ("rdf:type", "type") or str(p).endswith("#type"):
                    continue
                if isinstance(o, URIRef):
                    add_node(g, nodes_map, o)
                    edges.append({"source": str(s), "target": str(o), "label": pred})
                    if o not in visited:
                        next_frontier.add(o)
        frontier = next_frontier

    return list(nodes_map.values()), edges


def add_node(g: Graph, nodes_map: dict, s):
    sid = str(s)
    if sid not in nodes_map:
        ntype = node_type(g, s)
        ds = dataset_for_uri(sid)
        nodes_map[sid] = {
            "id": sid,
            "shortId": short_id(sid),
            "label": node_label(g, s, ntype),
            "type": ntype,
            "dataset": ds,
        }


def dataset_for_uri(uri: str) -> str:
    if uri.startswith(PI_DATA):
        return "opencup"
    if uri.startswith(LOT_DATA):
        return "cupcig"
    if uri.startswith(CALL_DATA):
        return "candidature"
    if uri.startswith(PO_DATA):
        if uri[len(PO_DATA) :].startswith("c_"):
            return "enti_ipa"
        return "opencup"
    return "shared"


def merge_graph(n1, e1, n2, e2):
    ids = {n["id"] for n in n1}
    for n in n2:
        if n["id"] not in ids:
            n1.append(n)
    seen = {(e["source"], e["target"], e["label"]) for e in e1}
    for e in e2:
        key = (e["source"], e["target"], e["label"])
        if key not in seen:
            e1.append(e)
            seen.add(key)


def wrap_subgraph(pid, title, note, nodes, edges, datasets, join_predicates):
    join_edges = [e for e in edges if e["label"] in join_predicates]
    return {
        "id": pid,
        "title": title,
        "sparql_note": note,
        "datasets_involved": datasets,
        "join_edges": join_edges,
        "nodes": nodes,
        "edges": edges,
    }


def empty_subgraph(pid: str) -> dict:
    return {"id": pid, "title": pid, "sparql_note": "", "datasets_involved": [], "join_edges": [], "nodes": [], "edges": []}


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "graphs").mkdir(exist_ok=True)
    (OUT_DIR / "subgraphs").mkdir(exist_ok=True)

    write_json(OUT_DIR / "mappings.json", build_mappings())

    all_g = Graph()
    all_g.parse(TTL_DIR / "all.ttl", format="turtle")

    opencup_g = Graph()
    opencup_g.parse(TTL_DIR / DATASETS["opencup"], format="turtle")
    sample_cup_uris = select_sample_cup_uris(opencup_g)
    sample_cup_codes = [short_id(str(c)).replace("cup:", "") for c in sample_cup_uris]

    write_json(OUT_DIR / "graphs" / "sample_cups.json", {
        "count": len(sample_cup_codes),
        "cups": sample_cup_codes,
        "note": "CUP campione statico condiviso da tutti i grafi separati",
    })

    builders = {
        "opencup": lambda g: build_opencup_sample_graph(g, sample_cup_uris),
        "candidature": lambda g: build_candidature_sample_graph(g, sample_cup_uris),
        "cupcig": lambda g: build_cupcig_sample_graph(g, sample_cup_uris),
        "enti_ipa": lambda g: wrap_sample_graph(
            build_enti_ipa_sample_graph(g, related_org_uris(all_g, sample_cup_uris)),
            sample_cup_codes,
        ),
    }

    for name, filename in DATASETS.items():
        g = Graph()
        g.parse(TTL_DIR / filename, format="turtle")
        data = builders[name](g)
        if name != "enti_ipa":
            data = wrap_sample_graph(data, sample_cup_codes)
        write_json(OUT_DIR / "graphs" / f"{name}.json", data)

    for pid in ("unione_completa", "cup_hub", "org_bridge", "cup_cig", "pnrr_avviso"):
        write_json(OUT_DIR / "subgraphs" / f"{pid}.json", extract_subgraph(all_g, pid))

    by_cup_dir = OUT_DIR / "subgraphs" / "by_cup"
    by_cup_dir.mkdir(exist_ok=True)
    for cup in sample_cup_uris:
        code = short_id(str(cup)).replace("cup:", "")
        write_json(by_cup_dir / f"{code}.json", build_cup_union(all_g, cup))

    write_json(OUT_DIR / "subgraphs" / "index.json", {
        "sample_cups": sample_cup_codes,
        "default_cup": sample_cup_codes[0] if sample_cup_codes else None,
    })

    build_analytics(all_g)
    print(f"Web assets written to {OUT_DIR}")


if __name__ == "__main__":
    main()
