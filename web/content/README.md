# Contenuti editabili

I testi delle pagine del sito vivono qui, **non** nei componenti React.

## File

| File | Uso |
|------|-----|
| `home.md` | Home (sezioni narrative, callout HTML) |
| `home.sources.yml` | Card fonti |
| `home.explore.yml` | Card “Continua l’esplorazione” |
| `analisi.md` | Lead / callout Analisi |
| `analisi.insights.yml` | Didascalie sotto i grafici (chiave = nome file JSON senza `.json`) |
| `mappature.md`, `unione.md`, `unione-animazione.md`, `grafi.md` | Lead delle altre pagine |

## Convenzioni

- Markdown GFM (`**grassetto**`, liste, tabelle, link).
- Link interni al sito: `[Analisi](/analisi)` (path senza base GitHub Pages).
- Callout Bootstrap Italia: HTML nel markdown, ad es.

```html
<div class="callout callout-primary">
  <div class="callout-title"><span class="text">Titolo</span></div>
  <p>Testo…</p>
</div>
```

- Sezioni opzionali in un file: `<!-- section:id -->` tra i blocchi.
- Nei frontmatter YAML, stringhe con `:` vanno in blocco piegato (`lead: >`) o tra virgolette.

Dopo le modifiche: `cd web && npm run build` (o `npm run dev` in anteprima).
