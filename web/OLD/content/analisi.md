---
title: Analisi
lead: >
  Questa pagina è la lente **database**: aggregati DuckDB sulle basi nazionali
  (*quanto*, *dove*, *a chi*). Non sostituisce il grafo: per *come* le fonti
  condividono lo stesso progetto/lotto/ente vai all'[unione semantica](/unione).
callout_title: Cosa vedi qui vs cosa vedi nel grafo
callout_body: >
  **Qui (DB):** classifiche e conteggi — «questo titolare ha X euro», «questa regione ha N CUP»,
  «questi sono i CUP con più CIG». Servono a capire la scala nazionale.

  **Nel grafo:** lo stesso CUP è un nodo condiviso tra OpenCUP e PA Digitale; ogni CIG è un lotto
  collegato; l'aggiudicatario SCP e l'ente IndicePA si agganciano senza riscrivere un JOIN.
  Il grafo non ricalcola i top-N nazionali: rende **espliciti e navigabili** i collegamenti
  che nel DB esistono solo se li scrivi tu nella query.
---
