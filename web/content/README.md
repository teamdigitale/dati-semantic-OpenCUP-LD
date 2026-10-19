# Contenuti editabili

I testi delle pagine del sito vivono qui, **non** nei componenti React.

**Per revisionare i testi basta questa cartella** (`web/content/`): tutti i `.md` e `.yml`. Si può ignorare questo README se serve solo il copy destinato agli utenti.

## File

| File | Uso |
|------|-----|
| `home.md` | Home (sezioni narrative, callout HTML, titoli confronto JSON) |
| `home.sources.yml` | Card fonti |
| `home.explore.yml` | Card “Altre sezioni del sito” |
| `site.yml` | Brand, navigazione, footer, CTA, caricamento, etichette grafo, label dataset |
| `analisi.md` | Lead / callout Analisi + sezioni «Scala nazionale» / «Dal numero al grafo» |
| `analisi.ui.yml` | Ancore, StatCard, titoli chart, testo card CUP |
| `analisi.insights.yml` | Didascalie sotto i grafici (chiave = nome file JSON senza `.json`) |
| `analisi.gaps.yml` | Note su come leggere i numeri |
| `mappature.md` | Lead Mappature + titoli sezioni e header tabella |
| `mappa.yml` | Toolbar e piede della mappa territoriale |
| `legenda.yml` | Legenda colori / nodi e archi di incontro |
| `grafi.common.yml` | Lista URI + controlli unione animata |
| `unione.md`, `unione-animazione.md`, `grafi.md` | Lead delle altre pagine |

## Convenzioni

- **Prosa lunga** → `.md` (frontmatter + corpo; sezioni opzionali con `<!-- section:id -->`).
- **Etichette / liste / keyed UI** → `.yml`.
- Markdown GFM (`**grassetto**`, liste, tabelle, link).
- Link interni al sito: `[Analisi](/analisi)` (path senza base GitHub Pages).
- Callout Bootstrap Italia: HTML nel markdown, ad es.

```html
<div class="callout callout-primary">
  <div class="callout-title"><span class="text">Titolo</span></div>
  <p>Testo…</p>
</div>
```

- Nei frontmatter YAML, stringhe con `:` vanno in blocco piegato (`lead: >`) o tra virgolette.

## Voce editoriale

- Parlare di **OpenCUP**, del **CUP** e della **semantica** (URI, ontologie, banche dati collegate).
- Italiano naturale ed esplicativo (non telegrafico); sempre **«banca dati»**, mai «banca» da sola.
- Preferire «nel formato Linked Data»; «i dati di X»; non usare «fatto/i» nel senso tecnico inglese.
- **Non dare del tu:** stile impersonale («si vede», «è visibile», «si sceglie», «in questa pagina»).
- Il visitatore non deve leggere scelte di pipeline, nomi di script o roadmap di cantiere.

## Convenzione URI (per agenti e autori)

Quando un’URI **non è già ufficiale**, il pattern è:

```text
https://w3id.org/italia/data/{nomeontologia}/{nomeconcetto}/{nomeattributo}/{valore}
```

`{nomeattributo}` solo se l’URI è il valore di un attributo. Vedi anche il README di root e la tabella in Home §5.

Dopo le modifiche: `cd web && npm run build` (o `npm run dev` / `preview`).
