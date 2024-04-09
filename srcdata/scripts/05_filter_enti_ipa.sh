duckdb -c "COPY (SELECT DISTINCT (IPA.*) FROM read_csv_auto('../rawdata/enti_ipa.csv') IPA JOIN read_json_auto('opencup_candidature_comuni_finanziate.json') CAND \
ON IPA.codice_fiscale_ente = CAND.PIVA_CODFISCALE_SOG_TITOLARE) TO 'candidature_enti_ipa.json' (FORMAT JSON, ARRAY true)"

jq -r -S '{enti: .}' < candidature_enti_ipa.json > ../data/candidature_enti_ipa.json
