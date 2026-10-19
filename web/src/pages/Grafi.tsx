import { useEffect, useState } from "react";
import { fetchJson } from "../api";
import { GraphData } from "../types";
import { CytoscapeGraph } from "../components/CytoscapeGraph";
import { GraphNodeList } from "../components/GraphNodeList";
import { GraphLegend } from "../components/GraphLegend";
import { ResourceLink } from "../components/ResourceLink";
import { DATASET_LABELS } from "../constants";
import { PageIntro } from "../components/PageIntro";
import { site } from "../content/site";
import grafiRaw from "../../content/grafi.md?raw";

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
      <PageIntro raw={grafiRaw} />
      <p className="text-secondary">
        {graph?.sample_note ?? site.graph.sample_fallback}{" "}
        {graph
          ? site.graph.nodes_edges
              .replace("{nodes}", String(graph.nodes.length))
              .replace("{edges}", String(graph.edges.length))
          : ""}
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

      <div className="btn-group flex-wrap mb-3" role="group" aria-label={site.graph.source_aria}>
        {DATASETS.map((d) => (
          <button
            key={d}
            type="button"
            className={`btn btn-sm ${active === d ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setActive(d)}
          >
            {DATASET_LABELS[d]}
          </button>
        ))}
      </div>

      {loading && <p>{site.loading.graph}</p>}
      {graph && !loading && (
        <>
          <CytoscapeGraph data={graph} />
          <GraphLegend datasets={[active]} />
          <GraphNodeList nodes={graph.nodes} />
        </>
      )}
    </div>
  );
}
