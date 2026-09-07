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

1. **Database / Analisi**: aggregati nazionali (quanto, dove, chi) — già in pagina Analisi + mappa regioni.
2. **Grafo / Unione**: identità URI e relazioni navigabili sul campione hub — non è un sostituto del DB, risolve i join multi-fonte.
3. Allargare la costellazione: mappe PA Digitale/comuni, Wikidata ISTAT, Award SCP nei subgraph, stati candidatura.

## Due percorsi dati

| Percorso | Input | Output | Uso |
|----------|--------|--------|-----|
| **Analytics full** | `srcdata/rawdata/*` (OpenCUP, ANAC, PA Digitale, IndicePA, SCP) | `web/public/data/analytics/*.json` | Pagina **Analisi** (quanto / dove / chi / stato) |
| **LD hub** | Filtri 01–05 (PA Digitale ∩ ANAC ∩ esiti) → JSON-LD → `all.ttl` | grafi / subgraph (campione CUP) | Unione semantica |

```bash
make analytics-full   # solo statistiche nazionali (DuckDB CLI)
make web-assets       # LD hub + analytics-full + export grafi
```

Non si materializza un RDF nazionale nel sito statico: aggregati tabellari +
campioni di grafo.

## Organizzazione del repository

* `srcdata` — dati di partenza e script di filtro
* `LD` — conversione a Linked Data
  * `templates/*.hbs` — ancora usati per OpenCUP, PA Digitale, IndicePA
  * `scripts/convert_cupcig_jsonld.py` — CUP↔CIG via **reshape + `@context`**
    (Handlebars deprecato per questo dataset; `--spike` mostra anche framing pyld)
  * `scripts/build_full_analytics.py` — aggregati DuckDB sulle basi raw complete
    (regione, stato progetto, top comuni PAD, top aggiudicatari SCP, …)
  * `scripts/convert_scp_jsonld.py` — SCP bandi/esiti hub → Award / ContractNotice su `Lot/{cig}`
  * `ttl/all.ttl` — grafo unito (**hub** interop, non nazionale)
* `web` — sito statico; testi editoriali in **`web/content/`** (Markdown/YAML), non nei `.tsx`
  * `content/README.md` — come modificare i testi

Nota: i JSON filtrati in `srcdata/data/` restano lo scope **hub** (intersezione) per RDF e
grafi. Le **Analisi** leggono invece le basi complete in `srcdata/rawdata/`.

## Ambiente Python (uv)

```bash
make setup          # uv sync (include pyld)
make all            # filtra + converte in Linked Data
make help           # tutti i target
```

Pipeline completa da zero:

```bash
make setup
make fetch          # ANAC CUP↔CIG, SCP bandi/esiti (MIT), PA Digitale, IndicePA
# aggiungere / convertire manualmente in srcdata/rawdata/: OpenCUP.parquet
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
