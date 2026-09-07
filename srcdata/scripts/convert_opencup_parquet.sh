#!/usr/bin/env bash
# Converte OpendataComplessivo.zip → OpenCUP.parquet ottimizzato per join/filtri su CUP.
#
# Copia di lavoro anche in: /data/DTD/work/opencup/data/convert_parquet.sh
# (esegui preferibilmente da lì: lì stanno zip e parquet usati dal symlink del repo).
#
# Ottimizzazioni:
#   - ORDER BY CUP  → row group con range CUP contigui (predicate pushdown / join)
#   - ZSTD + row group ~100k righe
#   - ingest a due fasi (CSV→tmp, poi rewrite ordinato) per non tenere tutto in RAM
#
# Prerequisiti: duckdb CLI, unzip, OpendataComplessivo.zip in questa directory.
# Riferimento: https://aborruso.github.io/posts/csv-ventitre-gigabyte-senza-affanno/
#
# Uso:
#   cd /data/DTD/work/opencup/data && bash convert_parquet.sh
# Serve spazio disco (~2× dimensione parquet + spill sort); oggi tipicamente >10 GB liberi.
set -euo pipefail

cd "$(dirname "$0")"

ZIP="${ZIP:-OpendataComplessivo.zip}"
OUT="${OUT:-OpenCUP.parquet}"
TMP_UNSORTED="${TMP_UNSORTED:-OpenCUP.unsorted.parquet}"
TMP_SORTED="${TMP_SORTED:-OpenCUP.sorted.parquet}"
WORKDIR="${WORKDIR:-.duckdb-opencup-tmp}"
ROW_GROUP_SIZE="${ROW_GROUP_SIZE:-100000}"

if [[ ! -f "$ZIP" ]]; then
  echo "Manca $ZIP — scaricalo da OpenCUP opendata complessivo." >&2
  exit 1
fi

if ! command -v duckdb >/dev/null; then
  echo "duckdb CLI non trovato in PATH." >&2
  exit 1
fi

mkdir -p "$WORKDIR"
cleanup() {
  rm -rf "$WORKDIR"
  # Non toccare $OUT; rimuovi solo intermedi ancora presenti
  if [[ -n "${TMP_UNSORTED:-}" && -f "${TMP_UNSORTED}" && "${TMP_UNSORTED}" != "$OUT" ]]; then
    rm -f "$TMP_UNSORTED"
  fi
  if [[ -n "${TMP_SORTED:-}" && -f "${TMP_SORTED}" && "${TMP_SORTED}" != "$OUT" ]]; then
    rm -f "$TMP_SORTED"
  fi
}
trap cleanup EXIT

echo "==> Fase 1/2: CSV (da zip) → $TMP_UNSORTED"
# parallel=FALSE + sample_size=-1: sniffing stabile sul CSV OpenCUP (';, date DD-MON-YYYY)
unzip -p "$ZIP" | duckdb -c "
SET temp_directory='${WORKDIR}';
SET preserve_insertion_order=false;
SET threads=4;
COPY (
  SELECT * FROM read_csv_auto(
    '/dev/stdin',
    delim=';',
    header=true,
    ignore_errors=false,
    dateformat='%d-%b-%Y',
    parallel=FALSE,
    sample_size=-1
  )
) TO '${TMP_UNSORTED}'
WITH (FORMAT PARQUET, COMPRESSION ZSTD, ROW_GROUP_SIZE ${ROW_GROUP_SIZE});
"

echo "==> Fase 2/2: ORDER BY CUP → $TMP_SORTED"
duckdb -c "
SET temp_directory='${WORKDIR}';
SET preserve_insertion_order=true;
SET threads=4;
COPY (
  SELECT * FROM read_parquet('${TMP_UNSORTED}')
  ORDER BY CUP
) TO '${TMP_SORTED}'
WITH (FORMAT PARQUET, COMPRESSION ZSTD, ROW_GROUP_SIZE ${ROW_GROUP_SIZE});
"

echo "==> Verifica ordinamento CUP tra row group…"
duckdb -c "
WITH cup_rg AS (
  SELECT row_group_id,
         min(stats_min_value) AS cup_min,
         max(stats_max_value) AS cup_max
  FROM parquet_metadata('${TMP_SORTED}')
  WHERE path_in_schema = 'CUP'
  GROUP BY 1
),
chk AS (
  SELECT
    count(*) AS n_rg,
    count(*) FILTER (WHERE cup_min > lag_max) AS strictly_after_prev,
    count(*) FILTER (WHERE cup_min < lag_max) AS overlaps_prev
  FROM (
    SELECT *, lag(cup_max) OVER (ORDER BY row_group_id) AS lag_max
    FROM cup_rg
  )
)
SELECT * FROM chk;
SELECT count(*) AS num_rows, count(DISTINCT row_group_id) AS num_row_groups
FROM parquet_metadata('${TMP_SORTED}')
WHERE path_in_schema = 'CUP';
"

mv -f "$TMP_SORTED" "$OUT"
rm -f "$TMP_UNSORTED"
# evita che trap cancelli l'output: svuota i path già spostati
TMP_SORTED="__done__"
TMP_UNSORTED="__done__"

echo "==> Scritto $(pwd)/${OUT}"
ls -lh "$OUT"
