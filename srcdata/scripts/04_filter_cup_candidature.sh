duckdb -c "COPY (SELECT DISTINCT (CAND.*) FROM read_json_auto('../data/cupcig_candidature_comuni_finanziate.json') CUPCIG JOIN \
read_json_auto('../rawdata/candidature_comuni_finanziate.json') CAND ON CUPCIG.CUP=CAND.codice_cup) TO '../data/candidature_comuni_finanziate.json'"
