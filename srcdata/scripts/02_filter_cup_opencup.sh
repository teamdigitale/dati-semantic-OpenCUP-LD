duckdb -c "COPY (SELECT DISTINCT (OpenCUP.*) FROM read_json_auto('cupcig_candidature_comuni_finanziate.json') CAND JOIN \
read_parquet ('../rawdata/OpenCUP.parquet') OpenCUP ON CAND.CUP = OpenCUP.CUP \
JOIN read_csv_auto ('../rawdata/v_od_esiti.csv') Esiti ON CAND.CIG = Esiti.CIG) TO 'opencup_candidature_comuni_finanziate.json' (FORMAT JSON, ARRAY true)"

jq -r -S '{opencup: .}' < opencup_candidature_comuni_finanziate.json > ../data/opencup_candidature_comuni_finanziate.json
