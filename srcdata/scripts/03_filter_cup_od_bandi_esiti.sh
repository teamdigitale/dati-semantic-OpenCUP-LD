duckdb -c "COPY (SELECT DISTINCT (Bandi.*) FROM read_json_auto('../data/cupcig_candidature_comuni_finanziate.json') CUPCIG JOIN \
read_csv_auto ('../rawdata/v_od_bandi.csv') Bandi ON CUPCIG.CIG = Bandi.CIG) TO '../data/SCP_bandi.json'"

duckdb -c "COPY (SELECT DISTINCT (Esiti.*) FROM read_json_auto('../data/cupcig_candidature_comuni_finanziate.json') CUPCIG JOIN \
read_csv_auto ('../rawdata/v_od_esiti.csv') Esiti ON CUPCIG.CIG = Esiti.CIG) TO '../data/SCP_esiti.json'"

