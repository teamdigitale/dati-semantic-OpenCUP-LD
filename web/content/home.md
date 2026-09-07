---
eyebrow: Linked Data · OpenCUP · interoperabilità
title: Dai dati tabellari al grafo semantico
lead: >
  Le Analisi (database / DuckDB) rispondono a «quanto» su milioni di righe.
  Il grafo Linked Data risponde a «come sono la stessa cosa» tra OpenCUP, ANAC,
  PA Digitale, IndicePA e SCP — senza riscrivere i join a ogni domanda.
---

<div class="callout callout-primary mb-5">
  <div class="callout-title"><span class="text">Database ≠ grafo (in una frase)</span></div>
  <p class="mb-0"><strong>Il DB</strong> è fortissimo su conteggi, somme e classifiche nazionali.
  <strong>Il grafo</strong> rende <em>persistente e navigabile</em> il fatto che lo stesso progetto,
  lo stesso lotto o lo stesso ente siano <em>un solo nodo</em> (stesso URI) anche se arrivano da file diversi.
  Non sostituisce il DB: risolve un altro problema.</p>
</div>

<!-- section:why -->

## 1. Perché la semantica

Oggi i dataset si collegano con join su CUP, CIG, codice fiscale, codice IPA. Funziona, ma ogni nuovo uso richiede di re-imparare chiavi e vincoli. Con Linked Data lo stesso fatto (progetto, lotto, ente) ha un'identità unica sul web.

Le ontologie e i vocabolari su [schema.gov.it](https://schema.gov.it/semantic-assets/details?uri=https%3A%2F%2Fw3id.org%2Fitalia%2FPublicInvestment%2Fonto%2FPublicInvestment) (PublicInvestment, classificazione, natura, tipologia) sono il contratto condiviso.

<!-- section:sources-intro -->

## 2. I dati di partenza

<!-- section:compare -->

## 3. Cosa fa il database e cosa fa il grafo

Stessi dati grezzi, **due strumenti diversi**. Non è «grafo = DB più bello».

### Cosa fa bene il database (pagina Analisi)

- Aggregati su **basi nazionali** (milioni di CUP/CIG): quanti, dove, quanto €, chi in classifica.
- Domande tipo: «quanti CUP attivi?», «top regioni», «a chi sono andate più gare?».
- Output: tabelle e grafici a barre — numeri, non relazioni.

### Cosa aggiunge il grafo (Unione / Unione animata)

- **Identità condivisa**: se PA Digitale e OpenCUP usano lo stesso URI del CUP, nel grafo è già *un* progetto, non due righe da joinare.
- **Relazioni esplicite**: lotto CIG → progetto; aggiudicatario → lotto; ente IPA ↔ CF; settore come concetto SKOS riusabile.
- **Navigazione**: parti da un CUP e vedi intorno titolare, lotti, avviso PNRR, esito SCP — senza scrivere SQL.
- Limite onesto: sul sito il grafo è un **campione hub** (leggibile); il DB tiene la **scala nazionale**.

| Domanda | Solo DB / SQL | Grafo (URI) |
|---------|---------------|-------------|
| Quanti CUP per regione? | Ideale (GROUP BY) | Possibile ma non il punto di forza |
| A che punto sono i progetti? | Conteggi per stato | Lo stato è un fatto *sul* nodo CUP, con il resto intorno |
| A chi sono andate le gare? | Top aggiudicatari | Vincitore ↔ lotto ↔ CUP come percorso |
| PA Digitale e ANAC sullo stesso investimento? | Join esplicito ogni volta | Stesso URI → un nodo (lo vedi fondersi nell'unione animata) |
| Cos'è questo codice di classificazione? | Stringa in colonna | Concetto SKOS collegato a molti progetti |

**In due frasi:** il database ti dice *quanto c'è*. Il grafo ti fa *seguire i collegamenti* tra fonti senza reinventare i join — e rende quei collegamenti un contratto (URI + ontologia), non una query ad hoc.

[Vedi i numeri (Analisi)](/analisi) · [Vedi i collegamenti (Unione animata)](/unione/animazione)

<!-- section:citizen -->

## 4. Cosa puoi scoprire già ora (da cittadino)

- Quanti progetti sono ancora **attivi** vs chiusi (OpenCUP) — lente DB.
- Dove si concentrano i CUP (anche in **mappa**) e quanto arriva il **PNRR digitale** per regione e comune.
- **A chi** sono andate più spesso le aggiudicazioni (esiti SCP).
- A cosa servono i progetti (settori) e quanto pesano avvisi come cloud, pagoPA, esperienza del cittadino.
- Come un CUP collega fonti diverse — lente **grafo** ([unione](/unione)).

Dettaglio numerico in [Analisi](/analisi).

### Prossimi passi

1. Più mappe (PA Digitale €; comuni + centroidi ISTAT).
2. Arricchimento comuni via Wikidata (popolazione, coordinate).
3. Award SCP più presenti nei sottografi CUP campione; ribassi/CPV.
4. Stati candidatura PA Digitale (glossario).

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
