duckdb -c "COPY (SELECT DISTINCT (CUPCIG.*) FROM read_json_auto('../data/cupcig_candidature_comuni_finanziate.json') CAND JOIN \
read_parquet ('../rawdata/OpenCUP.parquet') OpenCUP ON CAND.CUP = OpenCUP.CUP) TO '../data/opencup_candidature_comuni_finanziate.json'"

