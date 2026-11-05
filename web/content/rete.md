---
title: Analisi di rete
lead: >
  Seed predefiniti più **esplora ente / RUP** su base nazionale (SCP esiti).
  Reti tra soggetti (imprese, enti, SA, RUP, CUP). Metriche SNA sul grafo
  caricato; di default il canvas mostra i nodi più centrali (Top N), ma puoi
  scegliere **Tutti i nodi filtrati** o **Solo enti (tutti)**.
---

<div class="callout callout-highlight">
  <div class="callout-title"><span class="text">Esplora qualsiasi ente o RUP</span></div>
  <p>
    Nella modalità <strong>Esplora ente / RUP</strong> cerca per nome, CF o IPA.
    I grafi con almeno 10 CIG sono precomputati; gli altri compaiono in catalogo
    e si generano con <code>make sna-ego ENTE=…</code> / <code>RUP='…'</code> /
    <code>IMPRESA=…</code>.
    Deep-link: <code>?kind=ente&amp;id=CF</code> oppure <code>?kind=rup&amp;id=…</code>.
    Sul dettaglio nodo puoi scegliere <strong>ego 1 hop</strong> (solo nel grafo
    caricato) oppure <strong>rete completa nazionale</strong> di quel soggetto.
  </p>
</div>

<div class="callout callout-note">
  <div class="callout-title"><span class="text">Cosa non è questa pagina</span></div>
  <p>
    I seed predefiniti non sono un ranking su tutto OpenCUP nazionale, né i CUP
    campione di «Grafi» / «Unione». Ogni card seed delimita un perimetro
    (inchiesta, FOIA Marche, hub PA Digitale, Monithon). L’esplorazione ente/RUP
    usa invece gli esiti SCP nazionali.
  </p>
</div>

<div class="callout callout-highlight">
  <div class="callout-title"><span class="text">Archi impresa↔impresa</span></div>
  <p>
    Oltre a aggiudicazioni e RUP, le reti includono
    <code>co_aggiudicatario_cig</code>, <code>stesso_cup</code> e archi RTI
    (<code>rti_mandataria</code> / <code>rti_mandante</code>).
    Co-presenza su CIG/CUP non implica necessariamente un rapporto commerciale
    diretto; gli archi RTI riflettono i ruoli dichiarati negli esiti SCP.
  </p>
</div>

<div class="callout callout-note">
  <div class="callout-title"><span class="text">SQL e SPARQL a confronto</span></div>
  <p>
    <strong>Sotto la mappa</strong>, in un pannello chiuso di default, le stesse
    domande sono in <strong>SQL</strong> (tabelle <code>nodes</code>/<code>edges</code>)
    e in <strong>SPARQL</strong> sul <code>network.ttl</code>. Dove c’è un hub
    Linked Data (PA Digitale, Monithon) compare anche SPARQL sull’ontologia.
    In grafo conti i <em>pattern</em>; in SQL fai <em>JOIN</em> sulla relazione.
  </p>
</div>

<div class="callout callout-highlight">
  <div class="callout-title"><span class="text">Fonti open ufficiali</span></div>
  <p>
    Oltre a SCP MIT, OpenCUP, IndicePA e ANAC CUP↔CIG, le reti integrano
    <a href="https://opencoesione.gov.it/it/opendata/dataset/soggetti/">OpenCoesione Soggetti</a>
    e, se presente lo slice,
    <a href="https://dati.anticorruzione.it/opendata/opendata/dataset/aggiudicatari">ANAC Aggiudicatari</a>.
    Date di aggiornamento e candidati (dati.gov.it, ISTAT, OpenPNRR, TED, OCDS)
    sono in <a href="/fonti">Fonti</a>. Si privilegiano sempre i dump raw.
  </p>
</div>
