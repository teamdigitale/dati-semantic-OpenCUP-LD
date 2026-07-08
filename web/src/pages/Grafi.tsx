import { useEffect, useState } from "react";
import { fetchJson } from "../api";
import { GraphData } from "../types";
import { CytoscapeGraph } from "../components/CytoscapeGraph";
import { GraphNodeList } from "../components/GraphNodeList";
import { ResourceLink } from "../components/ResourceLink";
import { DATASET_COLORS, DATASET_LABELS } from "../constants";

const DATASETS = ["opencup", "candidature", "cupcig", "enti_ipa"] as const;

export function Grafi() {
  const [active, setActive] = useState<string>("opencup");
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchJson<GraphData>(`graphs/${active}.json`)
      .then(setGraph)
      .finally(() => setLoading(false));
  }, [active]);

  return (
    <div>
      <h1>Grafi separati</h1>
      <p className="lead">
        Ogni dataset RDF visualizzato in isolamento sullo{" "}
        <strong>stesso campione di 10 CUP</strong> (scelto in build da OpenCUP, ordinamento
        stabile). Le analisi in tab Analisi usano invece l&apos;intero <code>all.ttl</code>.
        {" "}
        {graph?.sample_note ?? "Campione statico."} ({graph?.nodes.length ?? "…"} nodi)
      </p>
      {graph?.sample_cups && graph.sample_cups.length > 0 && (
        <p className="stats">
          CUP:{" "}
          {graph.sample_cups.map((cup, i) => (
            <span key={cup}>
              {i > 0 && ", "}
              <ResourceLink value={`cup:${cup}`} />
            </span>
          ))}
        </p>
      )}

      <div className="tab-bar">
        {DATASETS.map((d) => (
          <button
            key={d}
            type="button"
            className={active === d ? "tab active" : "tab"}
            style={{ borderColor: DATASET_COLORS[d] }}
            onClick={() => setActive(d)}
          >
            {DATASET_LABELS[d]}
          </button>
        ))}
      </div>

      {loading && <p>Caricamento grafo…</p>}
      {graph && !loading && (
        <>
          <p className="stats">
            {graph.nodes.length} nodi · {graph.edges.length} archi
          </p>
          <CytoscapeGraph data={graph} />
          <GraphNodeList nodes={graph.nodes} />
          <div className="legend">
            {Object.entries(DATASET_COLORS).map(([k, c]) => (
              <span key={k} className="legend-item">
                <span className="dot" style={{ background: c }} />
                {DATASET_LABELS[k] ?? k}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
