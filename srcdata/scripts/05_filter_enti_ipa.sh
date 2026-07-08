#!/usr/bin/env bash
set -euo pipefail

# Enti IndicePA collegati a PA Digitale:
# - via CF titolare OpenCUP (quando il CUP è in OpenCUP)
# - via codice_ipa PA Digitale (copre comuni assenti da OpenCUP.parquet)
duckdb -c "COPY (
  SELECT DISTINCT IPA.*
  FROM read_csv('../rawdata/enti_ipa.csv', header=true, delim=',', quote='\"', escape='\"', strict_mode=false) IPA
  JOIN read_json_auto('opencup_candidature_comuni_finanziate.json') OC
    ON IPA.Codice_fiscale_ente = OC.PIVA_CODFISCALE_SOG_TITOLARE
  UNION
  SELECT DISTINCT IPA.*
  FROM read_csv('../rawdata/enti_ipa.csv', header=true, delim=',', quote='\"', escape='\"', strict_mode=false) IPA
  JOIN (
    SELECT DISTINCT c.codice_ipa AS ipa
    FROM read_json_auto('../data/candidature_comuni_finanziate.json'), unnest(candidature) AS u(c)
  ) PAD ON IPA.Codice_IPA = PAD.ipa
) TO 'candidature_enti_ipa.json' (FORMAT JSON, ARRAY true)"

jq -r -S '{enti: .}' < candidature_enti_ipa.json > ../data/candidature_enti_ipa.json
