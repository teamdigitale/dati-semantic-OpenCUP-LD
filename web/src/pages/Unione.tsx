import { useEffect, useState } from "react";
import { fetchJson } from "../api";
import { SubgraphData } from "../types";
import { CytoscapeGraph } from "../components/CytoscapeGraph";
import { GraphLegend } from "../components/GraphLegend";
import { GraphNodeList } from "../components/GraphNodeList";
import { ResourceLink } from "../components/ResourceLink";
import { DATASET_LABELS } from "../constants";

interface SubgraphIndex {
  sample_cups: string[];
  default_cup: string | null;
}

export function Unione() {
  const [sampleCups, setSampleCups] = useState<string[]>([]);
  const [activeCup, setActiveCup] = useState<string>("");
  const [subgraph, setSubgraph] = useState<SubgraphData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchJson<SubgraphIndex>("subgraphs/index.json").then((d) => {
      setSampleCups(d.sample_cups);
      setActiveCup(d.default_cup ?? d.sample_cups[0] ?? "");
    });
  }, []);

  useEffect(() => {
    if (!activeCup) return;
    setLoading(true);
    fetchJson<SubgraphData>(`subgraphs/by_cup/${activeCup}.json`)
      .then(setSubgraph)
      .finally(() => setLoading(false));
  }, [activeCup]);

  return (
    <div>
      <h1>Unione semantica</h1>
      <p className="lead">
        Per ogni CUP del campione (gli stessi 10 dei grafi separati), vedi come OpenCUP,
        PA Digitale, ANAC e IndicePA si collegano automaticamente via URI. Gli archi{" "}
        <strong>rossi</strong> sono i join semantici.
      </p>

      <div className="filter-bar">
        <label>
          CUP:{" "}
          <select value={activeCup} onChange={(e) => setActiveCup(e.target.value)}>
            {sampleCups.map((cup) => (
              <option key={cup} value={cup}>
                {cup}
              </option>
            ))}
          </select>
        </label>
        {activeCup && (
          <span className="stats" style={{ marginLeft: "1rem" }}>
            <ResourceLink value={`cup:${activeCup}`} />
          </span>
        )}
      </div>

      <div className="tab-bar cup-tabs">
        {sampleCups.map((cup) => (
          <button
            key={cup}
            type="button"
            className={activeCup === cup ? "tab active" : "tab"}
            onClick={() => setActiveCup(cup)}
            title={cup}
          >
            {cup.slice(0, 4)}…{cup.slice(-4)}
          </button>
        ))}
      </div>

      {loading && <p>Caricamento sottografo…</p>}
      {subgraph && !loading && (
        <>
          <div className="info-box">
            <h2>{subgraph.title}</h2>
            <p>{subgraph.sparql_note}</p>
            <p className="datasets">
              Dataset coinvolti:{" "}
              {subgraph.datasets_involved.map((d) => DATASET_LABELS[d] ?? d).join(", ")}
            </p>
            <p className="stats">
              {subgraph.nodes.length} nodi · {subgraph.edges.length} archi ·{" "}
              {subgraph.join_edges.length} join semantici
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
