duckdb -c "COPY (SELECT DISTINCT (CAND.*) FROM read_json_auto('cupcig_candidature_comuni_finanziate.json') CUPCIG JOIN \
read_json_auto('../rawdata/candidature_comuni_finanziate.json') CAND ON CUPCIG.CUP=CAND.codice_cup) TO 'candidature_comuni_finanziate.json' (FORMAT JSON, ARRAY true)"

jq -r -S '{candidature: .}' < candidature_comuni_finanziate.json > ../data/candidature_comuni_finanziate.json
