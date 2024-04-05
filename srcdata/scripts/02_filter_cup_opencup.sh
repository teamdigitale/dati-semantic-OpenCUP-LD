duckdb -c "COPY (SELECT DISTINCT (OpenCUP.*) FROM read_json_auto('../data/cupcig_candidature_comuni_finanziate.json') CAND JOIN \
read_parquet ('../rawdata/OpenCUP.parquet') OpenCUP ON CAND.CUP = OpenCUP.CUP \
JOIN read_csv_auto ('../rawdata/v_od_esiti.csv') Esiti ON CAND.CIG = Esiti.CIG) TO '../data/opencup_candidature_comuni_finanziate.json'"

