import { Link } from "react-router-dom";

const FLAT_CUPCIG = [
  { CIG: "9467132C76", CUP: "E31C22001170006" },
  { CIG: "998570721A", CUP: "C61F22001090006" },
];

const JSONLD_CUPCIG = {
  "@context": {
    pi: "https://w3id.org/italia/PublicInvestment/onto/PublicInvestment/",
    PCTR: "https://w3id.org/italia/onto/PublicContract/",
  },
  "@graph": [
    {
      "@id": "https://w3id.org/italia/data/Lot/9467132C76",
      "@type": "PCTR:Lot",
      "PCTR:hasProject": {
        "@id": "https://w3id.org/italia/PublicInvestment/data/CUP/E31C22001170006",
        "@type": "pi:Progetto_di_investimento_pubblico",
      },
    },
  ],
};

export function Home() {
  return (
    <div className="story">
      <header className="story-hero">
        <p className="story-kicker">Linked Data · OpenCUP · interoperabilità</p>
        <h1>Dai dati tabellari al grafo semantico</h1>
        <p className="lead">
          OpenCUP, ANAC, PA Digitale e IndicePA raccontano lo stesso investimento
          pubblico con chiavi diverse. Se usiamo ontologie e URI stabili, i
          collegamenti diventano evidenti senza join SQL ad hoc.
        </p>
      </header>

      <section className="story-section">
        <h2>1. Perché la semantica</h2>
        <p>
          Oggi i dataset si collegano con join su CUP, CIG, codice fiscale, codice
          IPA. Funziona, ma ogni nuovo uso richiede di re-imparare le chiavi e i
          vincoli. Con Linked Data lo stesso fatto (un progetto, un lotto, un ente)
          ha un&apos;identità unica sul web: se due fonti parlano dello stesso URI,
          il grafo si unisce da solo.
        </p>
        <p>
          Le ontologie e i vocabolari controllati pubblicati su{" "}
          <a
            href="https://schema.gov.it/semantic-assets/details?uri=https%3A%2F%2Fw3id.org%2Fitalia%2FPublicInvestment%2Fonto%2FPublicInvestment"
            target="_blank"
            rel="noopener noreferrer"
          >
            schema.gov.it
          </a>{" "}
          (PublicInvestment, classificazione intervento, natura, tipologia) sono
          il contratto condiviso.
        </p>
      </section>

      <section className="story-section">
        <h2>2. I dati di partenza</h2>
        <p>
          In questo repository partiamo da JSON filtrati sullo scope PA Digitale
          (progetti davvero collegabili tra le fonti):
        </p>
        <ul className="story-list">
          <li>
            <strong>OpenCUP</strong> — anagrafica CUP, costi, classificazione,
            titolare (CF)
          </li>
          <li>
            <strong>ANAC CUP↔CIG</strong> — lotti di gara collegati al CUP
          </li>
          <li>
            <strong>PA Digitale</strong> — avvisi PNRR e finanziamenti
          </li>
          <li>
            <strong>IndicePA</strong> — ente con codice IPA e{" "}
            <code>owl:sameAs</code> verso il CF
          </li>
        </ul>
        <p className="story-note">
          A tendere l&apos;obiettivo è usare <em>tutto</em> OpenCUP e i dati ANAC
          rilevanti (non solo il campione PA Digitale), caricandoli in un database
          a grafo per interrogazioni SPARQL su scala reale — vedi sezione 5.
        </p>
      </section>

      <section className="story-section">
        <h2>3. Da JSON a JSON-LD</h2>
        <p>
          JSON-LD aggiunge un <code>@context</code> che mappa chiavi → predicati
          ontologici. Il <strong>framing</strong> ristruttura un grafo già
          espandibile: non sostituisce l&apos;ETL. Per i JSON tabellari serve
          ancora un passo di <em>reshape</em> (mint degli <code>@id</code>,
          annidamento).
        </p>
        <p>
          Su <strong>CUP↔CIG</strong> quel reshape è meccanico: lo abbiamo
          sostituito a Handlebars con uno script context-first (
          <code>convert_cupcig_jsonld.py</code>). Expand + frame + compact (pyld)
          riproducono lo stesso grafo RDF. Per <strong>OpenCUP</strong> restano
          template/helper: URI composite dei CV, blank node intervento, tipi
          condizionali.
        </p>

        <div className="story-compare">
          <div>
            <h3>JSON piatto (ANAC)</h3>
            <pre>{JSON.stringify(FLAT_CUPCIG, null, 2)}</pre>
          </div>
          <div>
            <h3>JSON-LD (dopo reshape + context)</h3>
            <pre>{JSON.stringify(JSONLD_CUPCIG, null, 2)}</pre>
          </div>
        </div>
        <p className="story-note">
          Prova locale:{" "}
          <code>
            uv run python LD/scripts/convert_cupcig_jsonld.py --spike
          </code>
        </p>
      </section>

      <section className="story-section">
        <h2>4. URI e connessioni automatiche</h2>
        <p>Identità stabili usate nel grafo:</p>
        <ul className="story-list">
          <li>
            <code>cup:{"{CUP}"}</code> — progetto di investimento
          </li>
          <li>
            <code>lot:{"{CIG}"}</code> — lotto ANAC →{" "}
            <code>PCTR:hasProject</code> → CUP
          </li>
          <li>
            <code>ipa:{"{codiceIPA}"}</code> —{" "}
            <code>https://indicepa.gov.it/ente/…</code>
          </li>
          <li>
            <code>cf:{"{CF}"}</code> —{" "}
            <code>https://w3id.org/italia/data/CodiceFiscale/…</code>, collegato
            all&apos;IPA con <code>owl:sameAs</code>
          </li>
          <li>
            Concetti SKOS di classificazione / natura / tipologia su w3id →
            LodView schema.gov.it
          </li>
        </ul>
        <p>
          Le pagine di approfondimento mostrano queste connessioni in azione:
        </p>
        <div className="story-links">
          <Link to="/unione/animazione">Unione animata</Link>
          <Link to="/unione">Unione semantica</Link>
          <Link to="/grafi">Grafi separati</Link>
          <Link to="/mappature">Mappature campo → RDF</Link>
        </div>
      </section>

      <section className="story-section" id="roadmap-grafo">
        <h2>5. Verso il grafo completo</h2>
        <ol className="story-steps">
          <li>
            <strong>Scala dati</strong> — parametrizzare/rimuovere il filtro “solo
            CUP PA Digitale”; ingest completo OpenCUP + ANAC CUP↔CIG; poi bandi
            ed esiti SCP già presenti come JSON ma non ancora in LD.
          </li>
          <li>
            <strong>Store</strong> — caricare il grafo (TTL / N-Triples) su un
            endpoint SPARQL (es. Apache Jena Fuseki in Docker).
          </li>
          <li>
            <strong>Query demo</strong> — catalogo di interrogazioni:
            CUP→CIG→bando, ente IPA↔titolare CF, costi per settore CV, copertura
            PNRR, ecc.
          </li>
          <li>
            <strong>UI</strong> — i grafi Cytoscape restano su{" "}
            <em>campioni</em> leggibili; le query sul DB mostrano la potenza sul{" "}
            <em>grafo pieno</em>.
          </li>
        </ol>
        <pre className="story-pipeline">{`srcdata (JSON)
  → reshape + @context (+ frame dove utile)
  → JSON-LD → Turtle (all.ttl)
  → [prossimo] load su graph DB → SPARQL
  → web: racconto + campioni + (poi) query live`}</pre>
      </section>

      <section className="story-section">
        <h2>6. Approfondimenti</h2>
        <div className="card-grid">
          <Link to="/mappature" className="card">
            <h3>Mappature</h3>
            <p>Campi sorgente → proprietà ontologiche e join semantici.</p>
          </Link>
          <Link to="/grafi" className="card">
            <h3>Grafi separati</h3>
            <p>Ogni fonte in isolamento sul campione di CUP.</p>
          </Link>
          <Link to="/unione" className="card">
            <h3>Unione semantica</h3>
            <p>Sottografo per CUP con archi di join evidenziati.</p>
          </Link>
          <Link to="/analisi" className="card">
            <h3>Analisi</h3>
            <p>Statistiche SPARQL pre-calcolate su all.ttl.</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
