import { DATASET_COLORS, DATASET_LABELS } from "../constants";

const DATASET_DESCRIPTIONS: Record<string, string> = {
  opencup:
    "Progetto CUP, intervento, ente titolare — dati da OpenCUP.parquet",
  candidature:
    "Avviso PNRR e importi — dati da PA Digitale (candidature comuni finanziate)",
  cupcig:
    "Lotto CIG ANAC collegato al CUP — ponte verso gli appalti pubblici",
  enti_ipa:
    "Ente da IndicePA (codice IPA) — collegato al titolare via owl:sameAs",
  shared: "Letterale o risorsa senza dataset di provenienza",
};

interface Props {
  /** Dataset presenti nel grafo; se omesso mostra tutti. */
  datasets?: string[];
  /** Mostra la voce per gli archi join semantici (rossi). */
  showJoinEdges?: boolean;
  /** Mostra la voce per i nodi join (doppio bordo). */
  showJoinNodes?: boolean;
}

export function GraphLegend({
  datasets,
  showJoinEdges = false,
  showJoinNodes = false,
}: Props) {
  const keys = datasets?.length
    ? datasets
    : Object.keys(DATASET_COLORS).filter((k) => k !== "shared");

  return (
    <section className="graph-legend" aria-label="Legenda colori grafo">
      <h2>Legenda</h2>
      <div className="graph-legend-grid">
        <div className="graph-legend-section">
          <h3>Colori dei nodi — provenienza dataset</h3>
          <p className="graph-legend-hint">
            Ogni nodo è colorato in base al grafo RDF da cui proviene. Lo stesso CUP
            può comparire in più dataset con lo <strong>stesso URI</strong>: il colore
            indica la fonte dei dati che arricchiscono quel nodo.
          </p>
          <ul className="graph-legend-list">
            {keys.map((key) => (
              <li key={key}>
                <span className="dot" style={{ background: DATASET_COLORS[key] }} />
                <span className="graph-legend-label">{DATASET_LABELS[key] ?? key}</span>
                <span className="graph-legend-desc">
                  {DATASET_DESCRIPTIONS[key] ?? ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {showJoinNodes && (
          <div className="graph-legend-section">
            <h3>Nodi con doppio bordo — ancoraggio join</h3>
            <p className="graph-legend-hint">
              Nodi che partecipano a un join semantico tra dataset: stesso URI
              condiviso, ponte owl:sameAs o estremità di proprietà ontologiche.
            </p>
            <ul className="graph-legend-list">
              <li>
                <span className="join-node-sample" />
                <span className="graph-legend-label">Nodo join</span>
                <span className="graph-legend-desc">
                  CUP condiviso, ente titolare, lotto CIG, avviso PNRR, …
                </span>
              </li>
            </ul>
          </div>
        )}
        {showJoinEdges && (
          <div className="graph-legend-section">
            <h3>Archi rossi — join semantico</h3>
            <p className="graph-legend-hint">
              Collegamenti automatici tra dataset: stesso URI, owl:sameAs o proprietà
              ontologiche (es. PCTR:hasProject). Non sono join SQL tra tabelle.
            </p>
            <ul className="graph-legend-list">
              <li>
                <span className="legend-edge-sample" />
                <span className="graph-legend-label">Join semantico</span>
                <span className="graph-legend-desc">
                  PRJ:hasCall, pi:ha_soggetto_titolare, owl:sameAs, PCTR:hasProject
                </span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
