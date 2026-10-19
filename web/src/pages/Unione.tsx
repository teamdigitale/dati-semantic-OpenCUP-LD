import { useEffect, useState } from "react";
import { fetchJson } from "../api";
import { SubgraphData } from "../types";
import { CytoscapeGraph } from "../components/CytoscapeGraph";
import { GraphLegend } from "../components/GraphLegend";
import { GraphNodeList } from "../components/GraphNodeList";
import { ResourceLink } from "../components/ResourceLink";
import { DATASET_LABELS } from "../constants";
import { useCupQueryParam } from "../hooks/useCupQueryParam";
import { PageIntro } from "../components/PageIntro";
import { site } from "../content/site";
import unioneRaw from "../../content/unione.md?raw";

interface SubgraphIndex {
  sample_cups: string[];
  default_cup: string | null;
}

export function Unione() {
  const [sampleCups, setSampleCups] = useState<string[]>([]);
  const [activeCup, setActiveCup] = useState<string>("");
  const [subgraph, setSubgraph] = useState<SubgraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const { selectCup } = useCupQueryParam(sampleCups, activeCup, setActiveCup);

  useEffect(() => {
    fetchJson<SubgraphIndex>("subgraphs/index.json").then((d) => {
      setSampleCups(d.sample_cups);
      if (!activeCup) {
        setActiveCup(d.default_cup ?? d.sample_cups[0] ?? "");
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeCup) return;
    setLoading(true);
    fetchJson<SubgraphData>(`subgraphs/by_cup/${activeCup}.json`)
      .then(setSubgraph)
      .finally(() => setLoading(false));
  }, [activeCup]);

  return (
    <div>
      <PageIntro raw={unioneRaw} />

      <div className="mb-3">
        <label className="form-label" htmlFor="cupSelect">
          CUP
        </label>
        <select
          id="cupSelect"
          className="form-select w-auto d-inline-block"
          value={activeCup}
          onChange={(e) => selectCup(e.target.value)}
        >
          {sampleCups.map((cup) => (
            <option key={cup} value={cup}>
              {cup}
            </option>
          ))}
        </select>
        {activeCup && (
          <span className="ms-3">
            <ResourceLink value={`cup:${activeCup}`} />
          </span>
        )}
      </div>

      {loading && <p>{site.loading.subgraph}</p>}
      {subgraph && !loading && (
        <>
          <div className="callout callout-note mb-3">
            <div className="callout-title">
              <span className="text">{subgraph.title}</span>
            </div>
            <p>{subgraph.sparql_note}</p>
            <p className="mb-0">
              {site.graph.dataset_prefix}
              {subgraph.datasets_involved.map((d) => DATASET_LABELS[d] ?? d).join(", ")}
              {" · "}
              {site.graph.subgraph_stats
                .replace("{nodes}", String(subgraph.nodes.length))
                .replace("{edges}", String(subgraph.edges.length))
                .replace("{joins}", String(subgraph.join_edges.length))}
            </p>
          </div>
          <CytoscapeGraph data={subgraph} highlightJoin height={620} />
          <GraphLegend
            datasets={subgraph.datasets_involved}
            showJoinEdges
            showJoinNodes
          />
          <GraphNodeList nodes={subgraph.nodes} />
        </>
      )}
    </div>
  );
}
