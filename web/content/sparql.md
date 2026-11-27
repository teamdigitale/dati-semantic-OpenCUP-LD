---
title: Interroga il grafo in SPARQL
lead: >
  Query SPARQL eseguite nel browser su file <strong>.rete</strong> ospitati come
  asset statici. Il motore scarica con richieste HTTP Range solo le porzioni
  del file necessarie alla query: non serve un triplestore né un endpoint
  server-side.
callout_title: Formato sperimentale
callout_body: >
  I file .rete sono artefatti derivati dai Turtle del repository con
  <code>rete-graph 0.7.8</code>, una versione pre-1.0. I TTL restano la fonte
  canonica; il formato binario può cambiare nelle versioni successive.
---

<div class="callout callout-highlight">
  <div class="callout-title"><span class="text">Cosa puoi fare</span></div>
  <p>
    Scegli l'hub OpenCUP / PA Digitale oppure l'hub Monithon / OpenCoesione,
    parti da una query di esempio e modificala. Le query sono eseguite localmente
    nel browser; le statistiche sotto l'editor mostrano quanti byte sono stati
    effettivamente scaricati rispetto alla dimensione del file.
  </p>
</div>

<div class="callout callout-note">
  <div class="callout-title"><span class="text">Perimetro dei dati</span></div>
  <p>
    Questi file contengono gli hub Linked Data descritti nel sito, non tutto il
    patrimonio nazionale OpenCUP, ANAC o OpenCoesione. Le licenze non sono
    uniformi: controlla sempre la pagina <a href="#/fonti">Fonti</a> prima del riuso.
  </p>
</div>
