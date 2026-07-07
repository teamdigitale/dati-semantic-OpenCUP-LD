#!/usr/bin/env bash
set -euo pipefail

duckdb -c "COPY (SELECT DISTINCT (IPA.*) FROM read_csv('../rawdata/enti_ipa.csv', header=true, delim=',', quote='\"', escape='\"', strict_mode=false) IPA JOIN read_json_auto('opencup_candidature_comuni_finanziate.json') CAND \
ON IPA.Codice_fiscale_ente = CAND.PIVA_CODFISCALE_SOG_TITOLARE) TO 'candidature_enti_ipa.json' (FORMAT JSON, ARRAY true)"

jq -r -S '{enti: .}' < candidature_enti_ipa.json > ../data/candidature_enti_ipa.json
