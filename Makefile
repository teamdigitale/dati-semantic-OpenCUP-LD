# dati-semantic-OpenCUP-LD — pipeline dati → Linked Data
#
# Uso rapido:
#   make setup          # ambiente Python (uv)
#   make fetch          # scarica le fonti remote (ANAC CUP, PA Digitale, IndicePA)
#   make all            # filtra i JSON e genera JSON-LD + TTL
#
# Prima di `make all` servono anche in srcdata/rawdata/ (download manuale):
#   - OpenCUP.parquet       https://www.opencup.gov.it/...
#   - v_od_esiti.csv        https://dati.anticorruzione.it/opendata/...
#   - v_od_bandi.csv        https://dati.anticorruzione.it/opendata/...

SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

UV      ?= uv
SCRIPTS := srcdata/scripts
RAWDATA := srcdata/rawdata

RAW_REQUIRED := \
	$(RAWDATA)/cup_json.json \
	$(RAWDATA)/candidature_comuni_finanziate.json \
	$(RAWDATA)/OpenCUP.parquet \
	$(RAWDATA)/v_od_esiti.csv \
	$(RAWDATA)/v_od_bandi.csv \
	$(RAWDATA)/enti_ipa.csv

FILTER_OUTPUTS := \
	srcdata/data/cupcig_candidature_comuni_finanziate.json \
	srcdata/data/opencup_candidature_comuni_finanziate.json \
	srcdata/data/candidature_comuni_finanziate.json \
	srcdata/data/candidature_enti_ipa.json \
	srcdata/data/SCP_bandi.json \
	srcdata/data/SCP_esiti.json

LD_JSON := $(wildcard LD/json-ld/*-ld.json)
LD_TTL  := $(patsubst LD/json-ld/%-ld.json,LD/ttl/%.ttl,$(LD_JSON))

.PHONY: help setup fetch check-rawdata filter ld all clean clean-ld clean-filter

.DEFAULT_GOAL := help

help: ## Elenco target disponibili
	@printf "\nUso: make <target>\n\n"
	@grep -E '^[a-zA-Z0-9_.-]+:.*##' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*## "}; {printf "  %-18s %s\n", $$1, $$2}'
	@printf "\nPipeline completa (con rawdata già presente):\n"
	@printf "  make setup && make all\n\n"
	@printf "Pipeline da zero (dopo aver messo OpenCUP.parquet e CSV ANAC in %s):\n" "$(RAWDATA)"
	@printf "  make setup && make fetch && make all\n\n"

setup: ## Crea/aggiorna l'ambiente Python con uv
	$(UV) sync

fetch: setup ## Scarica le fonti disponibili via rete (ANAC, PA Digitale, IndicePA)
	cd $(SCRIPTS) && bash get_cup_json.sh
	cd $(SCRIPTS) && bash get_candidature_comuni.sh
	cd $(SCRIPTS) && bash get_indicepa_json.sh

check-rawdata: ## Verifica che i file raw necessari esistano
	@missing=0; \
	for f in $(RAW_REQUIRED); do \
		if [[ ! -f "$$f" ]]; then \
			echo "Manca: $$f"; \
			missing=1; \
		fi; \
	done; \
	if (( missing )); then \
		echo ""; \
		echo "Scarica i file mancanti oppure esegui: make fetch"; \
		echo "OpenCUP.parquet e i CSV ANAC (v_od_*) vanno aggiunti manualmente in $(RAWDATA)/"; \
		exit 1; \
	fi

filter: check-rawdata ## Filtra e collega i dataset (DuckDB) → srcdata/data/
	cd $(SCRIPTS) && bash 01_filter_cup_json.sh
	cd $(SCRIPTS) && bash 02_filter_cup_opencup.sh
	cd $(SCRIPTS) && bash 03_filter_cup_od_bandi_esiti.sh
	cd $(SCRIPTS) && bash 04_filter_cup_candidature.sh
	cd $(SCRIPTS) && bash 05_filter_enti_ipa.sh

ld: setup ## Converte JSON → JSON-LD → TTL (incluso LD/ttl/all.ttl)
	env -u VIRTUAL_ENV bash LD/scripts/convertLD.sh

all: filter ld ## Filtra i dati e rigenera tutto il Linked Data

clean-filter: ## Rimuove JSON filtrati in srcdata/data/
	rm -f $(FILTER_OUTPUTS)

clean-ld: ## Rimuove output JSON-LD e TTL
	rm -f LD/json-ld/*-ld.json LD/ttl/*-ld.ttl LD/ttl/all.ttl

clean: clean-filter clean-ld ## Rimuove tutti gli output generati (non i rawdata)
