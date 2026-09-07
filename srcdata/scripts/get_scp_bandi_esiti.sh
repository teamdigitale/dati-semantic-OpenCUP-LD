#!/usr/bin/env bash
# Bandi / esiti SCP (MIT — Servizio Contratti Pubblici), aggiornati quotidianamente.
# Catalogo: https://dati.mit.gov.it/catalog/dataset/scp
set -euo pipefail

cd "$(dirname "$0")"
mkdir -p ../rawdata

wget --progress=dot:giga \
  --output-document=../rawdata/v_od_bandi.csv \
  https://dati.mit.gov.it/scp/v_od_bandi.csv

wget --progress=dot:giga \
  --output-document=../rawdata/v_od_esiti.csv \
  https://dati.mit.gov.it/scp/v_od_esiti.csv

ls -lh ../rawdata/v_od_bandi.csv ../rawdata/v_od_esiti.csv
