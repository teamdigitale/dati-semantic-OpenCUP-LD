---
eyebrow: Linked Data · OpenCUP · interoperabilità
title: Dai dati tabellari al grafo semantico
lead: >
  OpenCUP, ANAC, PA Digitale e IndicePA raccontano lo stesso investimento pubblico
  con chiavi diverse. Con ontologie e URI stabili i collegamenti diventano espliciti:
  non serve reinventare i join SQL a ogni uso.
---

<div class="callout callout-primary mb-5">
  <div class="callout-title"><span class="text">In sintesi</span></div>
  <p class="mb-0"><strong>Tabella</strong>: la stessa stringa CUP compare in colonne diverse e va confrontata a mano. <strong>Linked Data</strong>: lo stesso fatto ha lo stesso <code>@id</code> (URI); se due fonti lo usano, il grafo si unisce da solo.</p>
</div>

<!-- section:why -->

## 1. Perché la semantica

Oggi i dataset si collegano con join su CUP, CIG, codice fiscale, codice IPA. Funziona, ma ogni nuovo uso richiede di re-imparare chiavi e vincoli. Con Linked Data lo stesso fatto (progetto, lotto, ente) ha un'identità unica sul web.

Le ontologie e i vocabolari su [schema.gov.it](https://schema.gov.it/semantic-assets/details?uri=https%3A%2F%2Fw3id.org%2Fitalia%2FPublicInvestment%2Fonto%2FPublicInvestment) (PublicInvestment, classificazione, natura, tipologia) sono il contratto condiviso.

<!-- section:sources-intro -->

## 2. I dati di partenza

<!-- section:compare -->

## 3. Due modi di interrogare gli stessi dati

Stessa domanda umana, due lenti: le **tabelle** eccellono su aggregati e scala; il **grafo** su relazioni e «è la stessa cosa in fonti diverse?».

| Domanda | Lente tabella (Analisi) | Lente grafo (Unione) |
|---------|-------------------------|----------------------|
| A che punto sono i progetti? | Conteggi per stato OpenCUP (attivo / chiuso…) | Lo stato è legato al nodo CUP, navigabile con il resto |
| A chi sono andate le gare? | Top aggiudicatari SCP (quanti lotti / importi) | Il vincitore (CF) collegato al lotto CIG e al progetto |
| Dove si concentrano gli investimenti? | CUP e € PA Digitale per regione / comune | Comune e ente come nodi riusabili (ISTAT / IPA) |
| PA Digitale e ANAC sullo stesso CUP? | Serve un join esplicito sull'hub | Stesso URI → un solo nodo (lo vedi fondersi nell'unione animata) |

**In una frase:** le tabelle rispondono a «quanto / chi in classifica»; il grafo a «come sono collegati».

[Vai alle Analisi](/analisi) · [Unione animata](/unione/animazione)

<!-- section:citizen -->

## 4. Cosa puoi scoprire già ora (da cittadino)

- Quanti progetti sono ancora **attivi** vs chiusi (OpenCUP).
- Dove si concentrano i CUP e quanto arriva il **PNRR digitale** per regione e comune.
- **A chi** sono andate più spesso le aggiudicazioni (esiti SCP).
- A cosa servono i progetti (settori) e quanto pesano avvisi come cloud, pagoPA, esperienza del cittadino.

Dettaglio e grafici in [Analisi](/analisi). Prossimi ampliamenti: ribassi/CPV più ricchi, stati candidatura PA Digitale, comuni via ISTAT/Wikidata per mappe.

<!-- section:pipeline -->

## 5. Pipeline: da raw a Linked Data

Nel repository la trasformazione non è “magica”: è una catena di passi espliciti.

1. **Raw** (`srcdata/rawdata/`) — OpenCUP parquet, ANAC `cup_json`, candidature PA Digitale, IndicePA, SCP MIT (`v_od_bandi/esiti`).
2. **Filtro hub** (script `01`–`05`) — intersezione PA Digitale ∩ ANAC ∩ esiti → JSON in `srcdata/data/`.
3. **Reshape + `@context`** — mint degli `@id`, tipi, annidamento; CUP↔CIG e SCP con script Python; OpenCUP/candidature/IPA ancora Handlebars.
4. **JSON-LD → Turtle** — merge in `LD/ttl/all.ttl` (grafo hub, incluso Award/Notice SCP).
5. **Export web** — grafi campione + analytics nazionali (territorio, stati, aggiudicazioni).

<!-- section:jsonld -->

## 6. Esempio: JSON piatto → JSON-LD

Su CUP↔CIG il reshape è meccanico (script context-first). Stesso lotto, stessa relazione verso il progetto — ma esplicitata come arco RDF.

<!-- section:uri -->

## 7. URI come contratto di join

Join SQL = confrontare colonne. Join semantico = coincidenza di URI.

| Entità | URI / pattern | Fonti |
|--------|---------------|-------|
| Progetto CUP | `…/data/CUP/{code}` | OpenCUP, PA Digitale, ANAC |
| Lotto CIG | `…/data/Lot/{cig}` | ANAC, SCP |
| Esito / Award | `…/data/Award/{…}` | SCP esiti |
| Bando / Notice | `…/data/ContractNotice/{id_gara}` | SCP bandi |
| Ente IPA | `https://indicepa.gov.it/ente/{ipa}` | IndicePA |
| CF / P.IVA | `…/CodiceFiscale/{cf}` | OpenCUP, SCP, sameAs IPA |
| Concetto CV | `…/controlled-vocabulary/…` | classificazione PCM-DIPE |

Approfondisci in [Mappature](/mappature), oppure [guarda l'unione animata](/unione/animazione).

<!-- section:limits -->

## 8. Cosa resta tabellare (limiti)

<div class="callout callout-note">
  <div class="callout-title"><span class="text">Fuori dal RDF hub (oggi)</span></div>
  <ul class="mb-0">
    <li>SCP nazionale intero: in Analisi tabellari; nel grafo solo l'hub filtrato (bandi/esiti → Award/Notice).</li>
    <li>Le Analisi nazionali non equivalgono a un grafo RDF nazionale: il sito mostra campioni leggibili + aggregati tabellari.</li>
    <li>Mappe geografiche e arricchimento Wikidata (popolazione, coordinate via codice ISTAT) sono in roadmap.</li>
  </ul>
</div>

<!-- section:explore -->

## 9. Continua l'esplorazione
