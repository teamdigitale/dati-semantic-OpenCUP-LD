import json
from pathlib import Path

from rdflib import Graph, Namespace

PI_DATA = "https://w3id.org/italia/PublicInvestment/data/CUP/"
PI_CV = "https://w3id.org/italia/PublicInvestment/controlled-vocabulary/"

CV_PREFIXES = {
    "settore-intervento": "picv-settore",
    "tipologia-intervento": "picv-tipologia",
    "sottosettore-intervento": "picv-sottosettore",
    "categoria-intervento": "picv-categoria",
    "area-intervento": "picv-area",
    "copertura-finanziaria": "picv-copertura",
    "strumento-programmazione": "picv-strumento",
}

LD_CONTEXT = {
    "pi": "https://w3id.org/italia/PublicInvestment/onto/PublicInvestment/",
    "CLV": "https://w3id.org/italia/onto/CLV/",
    "COV": "https://w3id.org/italia/onto/COV/",
    "l0": "https://w3id.org/italia/onto/l0/",
    "PRJ": "https://w3id.org/italia/onto/Project/",
    "PCTR": "https://w3id.org/italia/onto/PublicContract/",
    "owl": "http://www.w3.org/2002/07/owl#",
    "skos": "http://www.w3.org/2004/02/skos/core#",
    "xsd": "http://www.w3.org/2001/XMLSchema#",
    "cup": PI_DATA,
    "po": "https://w3id.org/italia/data/PublicOrganization/",
    "lot": "https://w3id.org/italia/data/Lot/",
    "call": "https://w3id.org/italia/data/Call/",
    "pocat": "https://w3id.org/italia/data/PublicOrganizationCategory/",
    **{prefix: f"{PI_CV}{slug}/" for slug, prefix in CV_PREFIXES.items()},
}


def bind_ld_prefixes(graph: Graph) -> None:
    graph.bind("cup", Namespace(PI_DATA), override=True)
    graph.bind("po", Namespace("https://w3id.org/italia/data/PublicOrganization/"), override=True)
    graph.bind("lot", Namespace("https://w3id.org/italia/data/Lot/"), override=True)
    graph.bind("call", Namespace("https://w3id.org/italia/data/Call/"), override=True)
    graph.bind(
        "pocat",
        Namespace("https://w3id.org/italia/data/PublicOrganizationCategory/"),
        override=True,
    )
    for slug, prefix in CV_PREFIXES.items():
        graph.bind(prefix, Namespace(f"{PI_CV}{slug}/"), override=True)


def serialize_turtle(graph: Graph, destination: str) -> None:
    bind_ld_prefixes(graph)
    graph.serialize(destination=destination, format="turtle")


def compact_jsonld(graph: Graph) -> str:
    bind_ld_prefixes(graph)
    return graph.serialize(format="json-ld", auto_compact=True, context=LD_CONTEXT)


def compact_jsonld_file(path: str) -> None:
    graph = Graph()
    graph.parse(path, format="json-ld")
    document = json.loads(compact_jsonld(graph))
    Path(path).write_text(
        json.dumps(document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
