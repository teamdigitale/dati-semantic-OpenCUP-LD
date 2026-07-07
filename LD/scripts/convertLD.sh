#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

run_py() {
    env -u VIRTUAL_ENV uv run python "$@"
}

for tname in LD/templates/*.hbs; do
    bname=$(basename "${tname}" .hbs)
    jname="srcdata/data/${bname}.json"
    jldname="LD/json-ld/${bname}-ld.json"
    run_py LD/scripts/applyTemplate.py "${jname}" "${tname}" > "${jldname}"
done

for jldname in LD/json-ld/*-ld.json; do
    bname=$(basename "${jldname}" .json)
    ttlname="LD/ttl/${bname}.ttl"
    run_py LD/scripts/convertTTL.py "${jldname}" "${ttlname}"
done

run_py - <<'PY'
from pathlib import Path
from rdflib import Graph

root = Path.cwd()
g = Graph()
for ttl in sorted((root / "LD" / "ttl").glob("*-ld.ttl")):
    g.parse(ttl, format="turtle")
out = root / "LD" / "ttl" / "all.ttl"
g.serialize(destination=out, format="turtle")
print(f"Wrote {out} ({len(g)} triples)")
PY
