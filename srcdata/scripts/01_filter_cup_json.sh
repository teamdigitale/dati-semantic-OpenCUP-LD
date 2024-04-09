duckdb -c "COPY (SELECT DISTINCT (CUPCIG.*) FROM read_json_auto('../rawdata/cup_json.json') CUPCIG JOIN \
read_json_auto('../rawdata/candidature_comuni_finanziate.json') CAND ON CUPCIG.CUP=CAND.codice_cup \
JOIN read_csv_auto ('../rawdata/v_od_esiti.csv') Esiti ON CUPCIG.CIG = Esiti.CIG) TO 'cupcig_candidature_comuni_finanziate.json' (FORMAT JSON, ARRAY true)"

jq -r -S '{cupcig: .}' < cupcig_candidature_comuni_finanziate.json > ../data/cupcig_candidature_comuni_finanziate.json
