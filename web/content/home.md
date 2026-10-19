---
eyebrow: OpenCUP · Linked Data · interoperabilità
title: Il CUP come chiave per leggere l’investimento pubblico
lead: >
  OpenCUP assegna a ogni progetto di investimento pubblico un Codice Unico di Progetto (CUP).
  Le altre banche dati — gare, avvisi digitali, enti, aggiudicazioni — descrivono lo stesso
  investimento con schemi e codici diversi. La semantica collega queste fonti: progetto,
  lotto, ente e classificazione diventano lo stesso oggetto ovunque compaiano, così le
  informazioni di fonti diverse si leggono insieme.
json_flat_title: JSON piatto (ANAC)
jsonld_title: JSON-LD (identità e relazione)
---

<div class="callout callout-primary mb-5">
  <div class="callout-title"><span class="text">In sintesi</span></div>
  <p class="mb-0">Il <strong>CUP</strong> è il codice che identifica un progetto di investimento pubblico.
  Nel formato Linked Data quel progetto — e insieme a esso i lotti di gara, gli enti e le classificazioni —
  hanno un <strong>URI</strong> stabile: lo stesso indirizzo in tutte le banche dati che li contengono.
  Così i collegamenti tra OpenCUP, gare, avvisi e enti non vanno ricostruiti a mano a ogni interrogazione:
  sono già nel modello dei dati.</p>
</div>

<!-- section:why -->

## 1. Perché la semantica

Nelle banche dati tradizionali le informazioni stanno in tabelle: righe e colonne. Per collegare OpenCUP alle gare o agli enti bisogna ogni volta confrontare i codici (CUP, CIG, codice fiscale).

Un **grafo** è un altro modo di organizzare le stesse informazioni: gli oggetti (progetto, lotto, ente) sono **nodi**; le relazioni tra di essi (questo lotto appartiene a questo progetto, questo ente è il titolare) sono **collegamenti**. Se due banche dati usano lo stesso indirizzo (URI) per lo stesso progetto, nel grafo c’è un solo nodo, non due righe da unire a mano.

I Linked Data usano proprio questo modello. Le ontologie e i vocabolari pubblicati su [schema.gov.it](https://schema.gov.it/semantic-assets/details?uri=https%3A%2F%2Fw3id.org%2Fitalia%2FPublicInvestment%2Fonto%2FPublicInvestment) (PublicInvestment, classificazione, natura, tipologia) fissano i tipi e i collegamenti possibili: stessi URI, stessi concetti, stesso grafo.

<!-- section:sources-intro -->

## 2. Le fonti intorno a OpenCUP

<!-- section:citizen -->

## 3. Cosa è possibile scoprire

- Quanti progetti risultano **attivi** o chiusi in OpenCUP.
- Dove si concentrano i CUP sul territorio (anche in **mappa**) e quanto finanziamento è stato assegnato nell’ambito dei fondi PNRR di PA Digitale.
- **A chi** sono state aggiudicate più spesso le gare.
- A cosa servono i progetti (settori e categorie di intervento).
- Come un singolo CUP collega OpenCUP, gare ANAC, avvisi PA Digitale ed enti IndicePA — nella [unione semantica](/unione).

I numeri nazionali sono in [Analisi](/analisi). I collegamenti tra fonti si esplorano nei [grafi](/grafi) e nell’[unione animata](/unione/animazione).

<!-- section:jsonld -->

## 4. Dal codice in tabella all’identità sul web

L’ANAC pubblica l’elenco dei collegamenti tra **CIG** (codice identificativo di gara, cioè il lotto) e **CUP** (il progetto). È una tabella con due colonne: per ogni riga, un CIG e il CUP a cui appartiene. Nel formato Linked Data la stessa informazione diventa un **lotto** collegato a un **progetto**: ciascuno ha il proprio URI e un tipo definito dall’ontologia. Sotto, a sinistra un estratto di quella tabella in JSON; a destra lo stesso legame espresso come Linked Data.

<!-- section:uri -->

## 5. L’URI come indirizzo condiviso

Quando due banche dati usano lo stesso URI, nel grafo c’è già *un* nodo: non due righe da confrontare a mano. Sotto, i pattern usati in questo sito per le entità principali (dove non esiste già un’URI ufficiale, ad esempio quella di IndicePA).

| Entità | Pattern URI | Fonti tipiche |
|--------|-------------|----------------|
| Progetto CUP | `https://w3id.org/italia/data/PublicInvestment/CUP/{codice}` | OpenCUP, PA Digitale, ANAC |
| Lotto CIG | `https://w3id.org/italia/data/PublicContract/Lot/{cig}` | ANAC, SCP |
| Esito di gara | `https://w3id.org/italia/data/PublicContract/Award/{id}` | SCP esiti |
| Bando | `https://w3id.org/italia/data/PublicContract/ContractNotice/{id_gara}` | SCP bandi |
| Ente IPA | `https://indicepa.gov.it/ente/{ipa}` *(URI ufficiale IndicePA)* | IndicePA |
| Codice fiscale / P.IVA | `https://w3id.org/italia/data/PublicInvestment/CodiceFiscale/{cf}` | OpenCUP, SCP, IndicePA |
| Concetto di classificazione | URI dei vocabolari controllati su schema.gov.it | PCM-DIPE |

Si può approfondire in [Mappature](/mappature), oppure nell’[unione animata](/unione/animazione).

<!-- section:explore -->

## 6. Altre sezioni del sito
