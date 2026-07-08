# dati-semantic-OpenCUP-LD
Repository di lavoro per la conversione dei dati OpenCUP e collegati in LD

## Obiettivi

I dati di:

* PA Digitale
* OpenCUP
* IndicePA
* ANAC

Possono tutti essere connessi fra loro. Idealmente questo può essere fatto attraverso delle join fra i vari database.

Un esempio di elaborazione di questi dati si può trovare nel [Vademecum sui dati aperti del PNRR](https://pnrr.datibenecomune.it/) realizzato
da @aborruso.

Un'alternativa è la produzione di Linked Data a partire da queste tabelle, utilizzando le ontologie pubblicate su https://schema.gov.it .

In questo modo, i dati sono resi interoperabili e i collegamenti fra le banche dati diventano evidenti ed "automatici".

## Organizzazione del repository

* nella cartella `srcdata` si trovano i dati di partenza e gli script per generarli a partire dalle fonti
* nella cartella `LD` si trovano:
  * i file template in formato [handlebars](https://handlebarsjs.com/) che permettono la conversione dai file JSON di partenza ai file JSON-LD corrispondenti
  * una cartella `ttl` nella quale si trova l'output delle conversioni. In particolare nel file `all.ttl` si può vedere il database ottenuto complessivo.

Nota bene: i file di partenza sono tutti filtrati in modo da contenere solo i progetti che sono catalogati in PA Digitale. Questo per avere solo dati realmente interoperabili fra loro.

## Ambiente Python (uv)

```bash
make setup          # uv sync
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

Per rigenerare solo la conversione LD (se i JSON in `srcdata/data/` sono già pronti):

```bash
make ld
```

## Web app (GitHub Pages)

Sito statico in `web/` che esplora mappature RDF, grafi per dataset, unione semantica e analisi pre-calcolate — tutto generato da `all.ttl` in fase di build.

```bash
make all            # genera all.ttl (se non già presente)
make web            # export JSON + build → docs/
```

In locale, dopo `make web`:

```bash
make web-preview    # http://localhost:4173/dati-semantic-OpenCUP-LD/
# oppure: cd web && npm run dev   (sviluppo, senza base path GH Pages)
```

**Non usare** `npx serve docs` dalla root: la build referenzia asset sotto
`/dati-semantic-OpenCUP-LD/...` (path del repo su github.io). `serve docs` li
cerca in `/assets/...` e restituisce 404. Usare `make web-preview` oppure
`cd web && npm run preview`.

### Pubblicazione su GitHub Pages

**Opzione A — cartella `/docs` sul branch principale**

1. `make web` e committare la cartella `docs/`
2. Repository → Settings → Pages → Source: branch `main`, folder `/docs`

**Opzione B — GitHub Actions**

Il workflow `.github/workflows/pages.yml` builda `web/` e pubblica `docs/` su ogni push.
Abilitare Pages con source **GitHub Actions**.

URL previsto: `https://<org>.github.io/dati-semantic-OpenCUP-LD/`

