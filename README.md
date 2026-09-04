# dati-semantic-OpenCUP-LD

Repository di lavoro per la conversione dei dati OpenCUP e collegati in Linked Data,
e per raccontare come la semantica rende interoperabili le banche dati pubbliche.

> Branch di sviluppo narrativo / JSON-LD: `narrative-jsonld`.

## Obiettivi

I dati di:

* PA Digitale
* OpenCUP
* IndicePA
* ANAC

possono essere connessi fra loro. Un'alternativa alle join SQL è produrre Linked Data
con le ontologie e i CV pubblicati su [schema.gov.it](https://schema.gov.it)
(PublicInvestment, classificazione intervento, natura, tipologia, …).

In questo modo i collegamenti (stesso CUP, stesso ente, stesso concetto SKOS)
diventano evidenti: stesse URI → stesso nodo nel grafo.

### Orizzonte

1. Passare dal campione “CUP in PA Digitale” a **OpenCUP e ANAC completi**
   (CUP↔CIG; poi bandi/esiti SCP).
2. Caricare il grafo su un **database a grafo / endpoint SPARQL** (es. Jena Fuseki).
3. Mostrare un catalogo di **query** (CUP→CIG→bando, IPA↔CF, costi per CV, …).
4. Tenere i grafi Cytoscape sui **campioni**; le query sul DB per la scala piena.

## Organizzazione del repository

* `srcdata` — dati di partenza e script di filtro
* `LD` — conversione a Linked Data
  * `templates/*.hbs` — ancora usati per OpenCUP, PA Digitale, IndicePA
  * `scripts/convert_cupcig_jsonld.py` — CUP↔CIG via **reshape + `@context`**
    (Handlebars deprecato per questo dataset; `--spike` mostra anche framing pyld)
  * `ttl/all.ttl` — grafo unito
* `web` — sito statico; la **home** è il racconto JSON → JSON-LD → join → roadmap grafo

Nota: i JSON filtrati in `srcdata/data/` contengono oggi solo progetti catalogati in
PA Digitale, per avere uno scope davvero interoperabile tra le fonti.

## Ambiente Python (uv)

```bash
make setup          # uv sync (include pyld)
make all            # filtra + converte in Linked Data
make help           # tutti i target
```

Pipeline completa da zero:

```bash
make setup
make fetch          # scarica ANAC CUP, PA Digitale, IndicePA
# aggiungere manualmente in srcdata/rawdata/: OpenCUP.parquet, v_od_esiti.csv, v_od_bandi.csv
make all
```

Solo conversione LD:

```bash
make ld
# demo CUP↔CIG JSON → reshape → frame:
uv run python LD/scripts/convert_cupcig_jsonld.py --spike
```

## Web app (GitHub Pages)

```bash
make all
make web            # export JSON + build → docs/
make web-preview    # http://localhost:4173/dati-semantic-OpenCUP-LD/
```

**Non usare** `npx serve docs` dalla root: la build referenzia
`/dati-semantic-OpenCUP-LD/...`. Usare `make web-preview` o `cd web && npm run preview`.

### Pubblicazione su GitHub Pages

**Opzione A — cartella `/docs` sul branch principale**

1. `make web` e committare `docs/`
2. Settings → Pages → Source: branch, folder `/docs`

**Opzione B — GitHub Actions**

Il workflow `.github/workflows/pages.yml` pubblica su ogni push.
URL previsto: `https://<org>.github.io/dati-semantic-OpenCUP-LD/`
