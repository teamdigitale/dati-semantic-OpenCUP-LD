#!/usr/bin/env bash
set -euo pipefail

wget --output-document=../rawdata/enti_ipa.csv "https://indicepa.gov.it/ipa-dati/datastore/dump/d09adf99-dc10-4349-8c53-27b1e5aa97b6?bom=True"

# DuckDB non riesce a fare sniffing automatico con BOM UTF-8 sul file IndicePA.
sed -i '1s/^\xEF\xBB\xBF//' ../rawdata/enti_ipa.csv
