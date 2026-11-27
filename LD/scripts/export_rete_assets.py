#!/usr/bin/env python3
"""Export immutable .rete assets for the static SPARQL explorer.

Writes:
  web/public/data/rete/opencup-hub.rete
  web/public/data/rete/monithon-hub.rete
  web/public/data/rete/index.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import textwrap
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import rete_graph as rete
from rdflib import Graph

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "web" / "public" / "data" / "rete"
RETE_VERSION = rete.__version__
EXPORT_VERSION = "1"
REPO_URL = "https://github.com/teamdigitale/dati-semantic-OpenCUP-LD"
CANONICAL_URL = "https://teamdigitale.github.io/dati-semantic-OpenCUP-LD/#/sparql"
FORMAT_NOTICE = (
    "Formato rete pre-1.0 generato con rete-graph 0.7.8; "
    "rigenerare i file con la stessa versione quando cambiano i TTL."
)
LICENSE_NOTE = (
    "Licenze miste: verificare la pagina Fonti del sito e le note "
    "di provenienza dei singoli dataset prima del riuso."
)

PI_ONTOLOGY = ROOT / "LD/ontologies/public-investment/latest/public-investment.ttl"
PI_CV_FILES = (
    ROOT
    / "LD/controlled-vocabularies/classificazione-intervento/latest/classificazione_intervento.ttl",
    ROOT / "LD/controlled-vocabularies/natura-intervento/latest/natura_intervento.ttl",
    ROOT / "LD/controlled-vocabularies/tipologia-intervento/latest/tipologia_intervento.ttl",
)
MAIN_HUB = ROOT / "LD/ttl/all.ttl"
MONITHON_HUB = ROOT / "LD/ttl/all_monithon.ttl"
OC_ONTOLOGY = ROOT / "LD/opencoesione/ontologies/open-coesione/latest/open-coesione.ttl"
OC_CV_GLOB = ROOT / "LD/opencoesione/controlled-vocabularies"


def sparql(text: str) -> str:
    return textwrap.dedent(text).strip()


@dataclass(frozen=True)
class ExampleQuery:
    id: str
    title: str
    question: str
    sparql: str
    dimension: str = "custom"


@dataclass(frozen=True)
class DatasetSpec:
    id: str
    title: str
    description: str
    output_name: str
    keywords: tuple[str, ...]
    inputs: tuple[Path, ...]
    examples: tuple[ExampleQuery, ...]


MAIN_EXAMPLES = (
    ExampleQuery(
        id="opencup-conteggi-hub",
        title="Conteggi dell'hub",
        question="Quanti progetti CUP, lotti e organizzazioni pubbliche contiene l'hub?",
        sparql=sparql(
            """
            PREFIX pi: <https://w3id.org/italia/PublicInvestment/onto/PublicInvestment/>
            PREFIX pctr: <https://w3id.org/italia/onto/PublicContract/>
            PREFIX cov: <https://w3id.org/italia/onto/COV/>
            SELECT ?progetti ?lotti ?organizzazioni
            WHERE {
              { SELECT (COUNT(DISTINCT ?cup) AS ?progetti) WHERE { ?cup a pi:Progetto_di_investimento_pubblico . } }
              { SELECT (COUNT(DISTINCT ?lot) AS ?lotti) WHERE { ?lot a pctr:Lot . } }
              { SELECT (COUNT(DISTINCT ?org) AS ?organizzazioni) WHERE { ?org a cov:PublicOrganization . } }
            }
            """
        ),
        dimension="overview",
    ),
    ExampleQuery(
        id="opencup-cup-piu-lotti",
        title="CUP con più lotti",
        question="Quali CUP hanno il maggior numero di lotti CIG collegati?",
        sparql=sparql(
            """
            PREFIX pctr: <https://w3id.org/italia/onto/PublicContract/>
            SELECT ?cup (COUNT(DISTINCT ?lot) AS ?lotti)
            WHERE {
              ?lot a pctr:Lot ; pctr:hasProject ?cup .
            }
            GROUP BY ?cup
            ORDER BY DESC(?lotti)
            LIMIT 20
            """
        ),
        dimension="contracts",
    ),
    ExampleQuery(
        id="opencup-dettaglio-cup-funivia",
        title="Dettaglio del CUP B31B21006780001",
        question="Come si collegano progetto, titolare, lotto, aggiudicazione e vincitore per il CUP B31B21006780001?",
        sparql=sparql(
            """
            PREFIX pi: <https://w3id.org/italia/PublicInvestment/onto/PublicInvestment/>
            PREFIX pctr: <https://w3id.org/italia/onto/PublicContract/>
            PREFIX cov: <https://w3id.org/italia/onto/COV/>
            PREFIX owl: <http://www.w3.org/2002/07/owl#>
            PREFIX l0: <https://w3id.org/italia/onto/l0/>
            SELECT ?lot ?notice ?noticeTitle ?award ?awardDate ?awardAmount ?titolareName ?winnerName
            WHERE {
              VALUES ?cup { <https://w3id.org/italia/PublicInvestment/data/CUP/B31B21006780001> }
              OPTIONAL { ?cup pi:ha_soggetto_titolare ?titolare .
                OPTIONAL { ?titolareOrg owl:sameAs ?titolare ; cov:legalName ?titolareName . }
              }
              OPTIONAL {
                ?lot a pctr:Lot ; pctr:hasProject ?cup .
                OPTIONAL { ?notice a pctr:ContractNotice ; pctr:hasLot ?lot ; l0:name ?noticeTitle . }
                OPTIONAL {
                  ?award a pctr:Award ; pctr:awardedLot ?lot .
                  OPTIONAL { ?award pctr:awardDate ?awardDate . }
                  OPTIONAL { ?award pctr:awardAmount ?awardAmount . }
                  OPTIONAL { ?award pctr:hasWinner ?winner .
                    OPTIONAL { ?winner cov:legalName ?winnerName . }
                  }
                }
              }
            }
            LIMIT 50
            """
        ),
        dimension="integration",
    ),
    ExampleQuery(
        id="opencup-settori-intervento",
        title="Settori di intervento",
        question="Quali settori di intervento ricoprono più progetti, con etichette SKOS italiane?",
        sparql=sparql(
            """
            PREFIX pi: <https://w3id.org/italia/PublicInvestment/onto/PublicInvestment/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            SELECT ?settore ?label (COUNT(DISTINCT ?cup) AS ?progetti)
            WHERE {
              ?cup pi:ha_intervento_di_investimento_pubblico ?intervento .
              ?intervento pi:ha_settore_intervento ?settore .
              ?settore skos:prefLabel ?label .
              FILTER(lang(?label) = "it")
            }
            GROUP BY ?settore ?label
            ORDER BY DESC(?progetti)
            LIMIT 20
            """
        ),
        dimension="vocabularies",
    ),
)

MONITHON_EXAMPLES = (
    ExampleQuery(
        id="monithon-report-conteggi",
        title="Report Monithon",
        question="Quanti report Monithon contiene l'hub e qual è la data più recente?",
        sparql=sparql(
            """
            PREFIX schema: <https://schema.org/>
            PREFIX dct: <http://purl.org/dc/terms/>
            SELECT (COUNT(DISTINCT ?report) AS ?report) (MAX(?data) AS ?ultimoReport)
            WHERE {
              ?report a schema:Report ; dct:issued ?data .
            }
            """
        ),
        dimension="overview",
    ),
    ExampleQuery(
        id="opencoesione-temi-sintetici",
        title="Temi sintetici OpenCoesione",
        question="Come si distribuiscono progetti e costi OpenCoesione per tema sintetico?",
        sparql=sparql(
            """
            PREFIX oc: <https://w3id.org/italia/draft/OpenCoesione/onto/OpenCoesione/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            SELECT ?tema ?label (COUNT(DISTINCT ?progetto) AS ?progetti) (SUM(?costo) AS ?costoTotale)
            WHERE {
              ?progetto a oc:Progetto_di_coesione ; oc:ha_tema_sintetico ?tema .
              OPTIONAL { ?progetto oc:costo_coesione ?costo . }
              ?tema skos:prefLabel ?label .
              FILTER(lang(?label) = "it")
            }
            GROUP BY ?tema ?label
            ORDER BY DESC(?costoTotale)
            LIMIT 20
            """
        ),
        dimension="cohesion",
    ),
    ExampleQuery(
        id="cup-attraverso-fonti",
        title="Un CUP attraverso le fonti",
        question="Come si incontrano report Monithon, progetti OpenCoesione e lotti ANAC intorno al CUP B23D13000420009?",
        sparql=sparql(
            """
            PREFIX pctr: <https://w3id.org/italia/onto/PublicContract/>
            PREFIX oc: <https://w3id.org/italia/draft/OpenCoesione/onto/OpenCoesione/>
            PREFIX schema: <https://schema.org/>
            PREFIX dct: <http://purl.org/dc/terms/>
            SELECT ?kind ?node ?title ?cup
            WHERE {
              VALUES ?cup { <https://w3id.org/italia/PublicInvestment/data/CUP/B23D13000420009> }
              {
                ?report a schema:Report ; schema:about ?cup ; dct:title ?title .
                BIND("report Monithon" AS ?kind)
                BIND(?report AS ?node)
              }
              UNION
              {
                ?ocProject a oc:Progetto_di_coesione ; oc:ha_cup ?cup ; dct:title ?title .
                BIND("progetto OpenCoesione" AS ?kind)
                BIND(?ocProject AS ?node)
              }
              UNION
              {
                ?lot a pctr:Lot ; pctr:hasProject ?cup .
                BIND("lotto ANAC" AS ?kind)
                BIND(?lot AS ?node)
              }
            }
            ORDER BY ?kind ?node
            LIMIT 50
            """
        ),
        dimension="integration",
    ),
    ExampleQuery(
        id="opencoesione-stati-progetto",
        title="Stati dei progetti OpenCoesione",
        question="Quanti progetti OpenCoesione ci sono per stato progettuale?",
        sparql=sparql(
            """
            PREFIX oc: <https://w3id.org/italia/draft/OpenCoesione/onto/OpenCoesione/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            SELECT ?stato ?label (COUNT(DISTINCT ?progetto) AS ?progetti)
            WHERE {
              ?progetto a oc:Progetto_di_coesione ; oc:ha_stato_progetto ?stato .
              ?stato skos:prefLabel ?label .
              FILTER(lang(?label) = "it" || lang(?label) = "")
            }
            GROUP BY ?stato ?label
            ORDER BY DESC(?progetti)
            """
        ),
        dimension="cohesion",
    ),
)


def oc_cv_files() -> tuple[Path, ...]:
    return tuple(sorted(OC_CV_GLOB.glob("*/latest/*.ttl")))


def require_inputs(paths: tuple[Path, ...], dataset: str) -> None:
    missing = [str(path.relative_to(ROOT)) for path in paths if not path.is_file()]
    if missing:
        raise SystemExit(
            f"Input mancanti per {dataset}: {', '.join(missing)}. "
            "Per i vocabolari/ontologie esegui make fetch-assets; per all.ttl esegui make ld."
        )


def main_spec() -> DatasetSpec:
    inputs = (MAIN_HUB, PI_ONTOLOGY, *PI_CV_FILES)
    require_inputs(inputs, "opencup-hub")
    return DatasetSpec(
        id="opencup-hub",
        title="Hub OpenCUP / PA Digitale",
        description=(
            "Grafo Linked Data dell'hub PA Digitale: progetti OpenCUP, CUP↔CIG, "
            "candidature, lotti ANAC/SCP, enti IndicePA, ontologia PublicInvestment "
            "e vocabolari controllati delle tipologie di intervento."
        ),
        output_name="opencup-hub.rete",
        keywords=("OpenCUP", "PA Digitale", "CUP", "CIG", "ANAC", "IndicePA", "SPARQL"),
        inputs=inputs,
        examples=MAIN_EXAMPLES,
    )


def monithon_spec() -> DatasetSpec:
    inputs = (
        MONITHON_HUB,
        PI_ONTOLOGY,
        *PI_CV_FILES,
        OC_ONTOLOGY,
        *oc_cv_files(),
    )
    require_inputs(inputs, "monithon-hub")
    return DatasetSpec(
        id="monithon-hub",
        title="Hub Monithon / OpenCoesione",
        description=(
            "Grafo Linked Data seedato dai report Monithon: monitoraggio civico, "
            "progetti OpenCoesione, progetti OpenCUP, lotti ANAC/SCP ed enti, "
            "con ontologie e vocabolari controllati locali inclusi."
        ),
        output_name="monithon-hub.rete",
        keywords=("Monithon", "OpenCoesione", "monitoraggio civico", "OpenCUP", "SPARQL"),
        inputs=inputs,
        examples=MONITHON_EXAMPLES,
    )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def spec_fingerprint(spec: DatasetSpec) -> str:
    payload = {
        "export_version": EXPORT_VERSION,
        "rete_graph_version": RETE_VERSION,
        "repo_url": REPO_URL,
        "canonical_url": CANONICAL_URL,
        "license_note": LICENSE_NOTE,
        "format_notice": FORMAT_NOTICE,
        "title": spec.title,
        "description": spec.description,
        "keywords": spec.keywords,
        "examples": [example.__dict__ for example in spec.examples],
        "inputs": [
            {
                "path": str(path.relative_to(ROOT)),
                "sha256": sha256_file(path),
            }
            for path in spec.inputs
        ],
    }
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def configure_builder(spec: DatasetSpec) -> rete.Builder:
    builder = rete.Builder()
    builder.card(
        title=spec.title,
        description=spec.description,
        source=REPO_URL,
        canonical_url=CANONICAL_URL,
        keywords=list(spec.keywords),
        extra={
            "license_note": LICENSE_NOTE,
            "format_notice": FORMAT_NOTICE,
            "generator": "LD/scripts/export_rete_assets.py",
            "source_files": [str(path.relative_to(ROOT)) for path in spec.inputs],
        },
    )
    for example in spec.examples:
        builder.example(
            example.sparql,
            title=example.title,
            question=example.question,
            dimension=example.dimension,
            id=example.id,
        )
    builder.derive_card()
    builder.text_index()
    return builder


def build_direct(spec: DatasetSpec) -> bytes:
    builder = configure_builder(spec)
    for path in spec.inputs:
        builder.add_file(path)
    return builder.run()


def build_with_rdflib(spec: DatasetSpec) -> bytes:
    builder = configure_builder(spec)
    for path in spec.inputs:
        graph = Graph()
        graph.parse(path, format="turtle")
        builder.add(graph, name=path.name)
    return builder.run()


def build_image(spec: DatasetSpec) -> bytes:
    try:
        return build_direct(spec)
    except Exception as direct_error:
        print(
            f"[rete] {spec.id}: build Turtle diretta fallita ({direct_error}); "
            "riprovo tramite rdflib",
            file=sys.stderr,
        )
        try:
            return build_with_rdflib(spec)
        except Exception as fallback_error:
            raise RuntimeError(
                f"build rete fallita per {spec.id}: direct={direct_error}; "
                f"rdflib={fallback_error}"
            ) from fallback_error


def expected_union_count(inputs: tuple[Path, ...]) -> int:
    union = Graph()
    for path in inputs:
        union.parse(path, format="turtle")
    return len(union)


def run_example_checks(graph: rete.Graph, spec: DatasetSpec) -> None:
    failures: list[str] = []
    for example in spec.examples:
        try:
            result = graph.query(example.sparql)
        except Exception as exc:  # noqa: BLE001 - report every example id in the export error
            failures.append(f"{example.id}: {exc}")
            continue
        if isinstance(result, list) and not result:
            failures.append(f"{example.id}: nessun risultato")
        warnings = graph.last_warnings()
        if warnings:
            print(f"[rete] {spec.id}/{example.id}: warning SPARQL: {warnings[0].get('message')}")
    if failures:
        raise RuntimeError("query di esempio non valide: " + "; ".join(failures))


def inspect_image(spec: DatasetSpec, image: bytes, expected_quads: int | None) -> dict[str, Any]:
    if not rete.verify(image):
        raise RuntimeError(f"{spec.id}: rete.verify() fallita")
    graph = rete.open(image)
    card = graph.card()
    if card is None:
        raise RuntimeError(f"{spec.id}: Dataset Card assente")
    if expected_quads is not None and graph.quads != expected_quads:
        raise RuntimeError(
            f"{spec.id}: quads rete={graph.quads}, unione RDF attesa={expected_quads}"
        )
    example_ids = {example.get("id") for example in graph.examples()}
    missing_examples = [example.id for example in spec.examples if example.id not in example_ids]
    if missing_examples:
        raise RuntimeError(f"{spec.id}: esempi mancanti nella card: {missing_examples}")
    run_example_checks(graph, spec)
    return {
        "id": spec.id,
        "title": spec.title,
        "description": spec.description,
        "file": spec.output_name,
        "path": f"data/rete/{spec.output_name}",
        "size_bytes": len(image),
        "quads": graph.quads,
        "content_hash": graph.content_hash(),
        "source_files": [str(path.relative_to(ROOT)) for path in spec.inputs],
        "license_note": LICENSE_NOTE,
        "examples_count": len(spec.examples),
        "examples": [example.__dict__ for example in spec.examples],
    }


def read_manifest() -> dict[str, Any]:
    path = OUT_DIR / "index.json"
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def up_to_date_entry(manifest: dict[str, Any], spec: DatasetSpec, fingerprint: str) -> dict[str, Any] | None:
    for entry in manifest.get("datasets", []):
        if entry.get("id") != spec.id:
            continue
        artifact = OUT_DIR / spec.output_name
        if entry.get("input_fingerprint") != fingerprint or not artifact.is_file():
            return None
        if entry.get("rete_graph_version") != RETE_VERSION:
            return None
        try:
            image = artifact.read_bytes()
            checked = inspect_image(spec, image, expected_quads=None)
            if checked["content_hash"] != entry.get("content_hash"):
                return None
            if checked["quads"] != entry.get("quads"):
                return None
            entry.update(checked)
            return entry
        except Exception as exc:  # noqa: BLE001 - a corrupt generated artifact is rebuilt
            print(f"[rete] {spec.id}: artefatto esistente non valido ({exc}); rigenero", file=sys.stderr)
            return None
    return None


def export_spec(spec: DatasetSpec, old_manifest: dict[str, Any], force: bool) -> tuple[dict[str, Any], bool]:
    fingerprint = spec_fingerprint(spec)
    if not force:
        existing = up_to_date_entry(old_manifest, spec, fingerprint)
        if existing is not None:
            existing["input_fingerprint"] = fingerprint
            existing["rete_graph_version"] = RETE_VERSION
            print(f"[rete] {spec.id}: aggiornato, nessuna ricostruzione")
            return existing, False

    print(f"[rete] {spec.id}: build da {len(spec.inputs)} file Turtle")
    image = build_image(spec)
    expected = expected_union_count(spec.inputs)
    entry = inspect_image(spec, image, expected_quads=expected)
    entry["input_fingerprint"] = fingerprint
    entry["rete_graph_version"] = RETE_VERSION

    output = OUT_DIR / spec.output_name
    output.write_bytes(image)
    print(
        f"[rete] {spec.id}: scritto {output.relative_to(ROOT)} "
        f"({len(image):,} bytes, {entry['quads']:,} quads, hash {entry['content_hash'][:12]})"
    )
    return entry, True


def write_manifest(entries: list[dict[str, Any]]) -> None:
    manifest = {
        "format": "rete",
        "format_version": "0x08",
        "rete_graph_version": RETE_VERSION,
        "pre_release_notice": FORMAT_NOTICE,
        "canonical_url": CANONICAL_URL,
        "source": REPO_URL,
        "datasets": entries,
    }
    path = OUT_DIR / "index.json"
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[rete] manifest: {path.relative_to(ROOT)}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="ricostruisce anche se input e artefatti sono invariati")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    specs = [main_spec()]
    if MONITHON_HUB.is_file():
        specs.append(monithon_spec())
    else:
        print(
            f"[rete] warning: {MONITHON_HUB.relative_to(ROOT)} assente; "
            "genero solo opencup-hub (make monithon-hub per l'altro artifact)",
            file=sys.stderr,
        )

    old_manifest = read_manifest()
    entries: list[dict[str, Any]] = []
    rebuilt = 0
    for spec in specs:
        entry, was_rebuilt = export_spec(spec, old_manifest, force=args.force)
        entries.append(entry)
        rebuilt += int(was_rebuilt)
    write_manifest(entries)
    print(f"[rete] completato: {len(entries)} dataset, {rebuilt} ricostruiti")


if __name__ == "__main__":
    main()
