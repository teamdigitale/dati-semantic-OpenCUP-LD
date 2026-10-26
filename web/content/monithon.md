# Monitoraggio civico Monithon

Questa sezione presenta un grafo Linked Data costruito a partire dai **report pubblici di Monithon**, collegati a CUP e CIG e arricchiti con **ANAC** (CUP↔CIG e aggiudicazioni: importi, date, esiti), **OpenCUP**, **OpenCoesione**, **IndicePA** e, ove presenti, gli esiti **SCP** (con aggiudicatario).

I codici progetto OpenCoesione indicati nelle pagine Monithon (`oc_code`) sono risolti in **CUP** tramite i dati aperti [Progetti OpenCoesione](https://opencoesione.gov.it/it/opendata/) (licenza CC BY). Il **CIG** non è contenuto in OpenCoesione: si ricava da ANAC a partire dal CUP. I progetti OpenCoesione i cui CUP rientrano in questo grafo sono modellati come nodi `oc:Progetto_di_coesione` (ontologia in `LD/opencoesione/`, allineata a Project-AP_IT e PublicInvestment), collegati al CUP con `oc:ha_cup`, `schema:about` e `dct:subject`, e classificati con vocabolari SKOS (tema, ciclo, stato e affini).

Il grafo unito è pubblicato in `LD/ttl/all_monithon.ttl`. Ogni report è un `schema:Report` / `foaf:Document` con `schema:about` (e `dct:subject`) verso il CUP o il lotto CIG; il produttore è l’organizzazione [Monithon](https://www.monithon.eu/) (`COV:Organization`).

In pagina: confronti tra catalogo Monithon e grafo collegato, mappa e grafici per regione, settore e copertura delle fonti (incluso OpenCoesione), elenco dei CUP e visualizzazione del sottografo per singolo caso (viste unite o separate).

Dati Monithon: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) — [Monithon](https://www.monithon.eu/). OpenCoesione: [CC BY 4.0](https://opencoesione.gov.it/).
