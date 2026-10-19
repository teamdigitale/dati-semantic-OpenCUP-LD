---
title: Mappature
lead: >
  In questa pagina è visibile come i dati tabellari diventino Linked Data. Ogni banca dati
  (OpenCUP, ANAC, PA Digitale, IndicePA) ha colonne con nomi propri: CUP, codice fiscale,
  importo, settore di intervento. La mappatura dice a quale proprietà dell’ontologia
  PublicInvestment corrisponde ciascuna colonna, e con quale URI si identifica progetto,
  lotto o ente. Sotto si trovano i punti in cui le fonti si incontrano sullo stesso oggetto;
  in fondo, la tabella completa campo per campo.
callout_title: Come leggere questa pagina
callout_body: >
  Prima le card: sono i punti in cui due o più fonti parlano della stessa cosa (stesso CUP,
  stesso codice fiscale collegato a un ente IndicePA, stesso lotto CIG legato a un progetto).
  Poi la tabella: ogni riga è una colonna del dataset di partenza e la proprietà RDF in cui
  viene trasformata. Se due fonti usano lo stesso URI, nel grafo è già un solo nodo — è
  visibile anche nell’[unione animata](/unione/animazione), quando i nodi si sovrappongono.
joins_heading: Punti di incontro tra le fonti
table_heading: Dalla colonna alla proprietà dell’ontologia
filter_label: Dataset
filter_all: Tutti
table_headers:
  campo: Campo sorgente
  proprieta: Proprietà RDF
  ruolo: Ruolo
  dataset: Dataset
---
