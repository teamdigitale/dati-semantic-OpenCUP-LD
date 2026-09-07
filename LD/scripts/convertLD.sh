#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

run_py() {
    env -u VIRTUAL_ENV uv run python "$@"
}

# CUP↔CIG: reshape + JSON-LD @context (no Handlebars)
run_py LD/scripts/convert_cupcig_jsonld.py \
    --src srcdata/data/cupcig_candidature_comuni_finanziate.json \
    --dest LD/json-ld/cupcig_candidature_comuni_finanziate-ld.json
run_py LD/scripts/compactJsonLD.py LD/json-ld/cupcig_candidature_comuni_finanziate-ld.json

# SCP bandi/esiti hub → Award / ContractNotice on same Lot URIs
run_py LD/scripts/convert_scp_jsonld.py \
    --bandi srcdata/data/SCP_bandi.json \
    --esiti srcdata/data/SCP_esiti.json \
    --dest LD/json-ld/scp_bandi_esiti-ld.json
run_py LD/scripts/compactJsonLD.py LD/json-ld/scp_bandi_esiti-ld.json

for tname in LD/templates/*.hbs; do
    bname=$(basename "${tname}" .hbs)
    if [[ "${bname}" == "cupcig_candidature_comuni_finanziate" ]]; then
        continue
    fi
    jname="srcdata/data/${bname}.json"
    jldname="LD/json-ld/${bname}-ld.json"
    run_py LD/scripts/applyTemplate.py "${jname}" "${tname}" > "${jldname}"
    run_py LD/scripts/compactJsonLD.py "${jldname}"
done

for jldname in LD/json-ld/*-ld.json; do
    bname=$(basename "${jldname}" .json)
    ttlname="LD/ttl/${bname}.ttl"
    run_py LD/scripts/convertTTL.py "${jldname}" "${ttlname}"
done

run_py - <<'PY'
import sys
from pathlib import Path

sys.path.insert(0, str(Path("LD/scripts").resolve()))
from rdflib import Graph
from rdf_utils import serialize_turtle

root = Path.cwd()
g = Graph()
for ttl in sorted((root / "LD" / "ttl").glob("*-ld.ttl")):
    g.parse(ttl, format="turtle")
out = root / "LD" / "ttl" / "all.ttl"
serialize_turtle(g, out)
print(f"Wrote {out} ({len(g)} triples)")

legacy = root / "LD" / "json-ld" / "all.ttl"
legacy.write_text(out.read_text())
print(f"Wrote {legacy} ({len(g)} triples)")
PY
