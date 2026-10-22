# Monitoraggio civico Monithon

Hub Linked Data **seedato da Monithon** (non da PA Digitale): report pubblici collegati a CUP/CIG, poi espansi con **ANAC**, **OpenCUP**, **IndicePA** e **SCP** quando disponibili.

I codici progetto OpenCoesione presenti nelle pagine Monithon (`oc_code`) vengono risolti in **CUP** tramite il dump open data [Progetti OpenCoesione](https://opencoesione.gov.it/it/opendata/) (CC BY). Il **CIG** non è in OpenCoesione: si ricava da ANAC a partire dal CUP.

Il grafo unito è `LD/ttl/all_monithon.ttl`. Ogni report è un `schema:Report` / `foaf:Document` con `schema:about` (e `dct:subject`) verso il CUP o il lotto CIG; produttore `COV:Organization` = [Monithon](https://www.monithon.eu/).

In pagina: conteggi del catalogo scrape vs hub collegabile, grafici per regione/settore/copertura fonti, tabella dei CUP, e drill-down del sottografo per caso.

Dati Monithon: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) — [Monithon](https://www.monithon.eu/). Join CUP: [OpenCoesione](https://opencoesione.gov.it/) CC BY 4.0.
