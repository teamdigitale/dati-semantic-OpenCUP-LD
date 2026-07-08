import { useEffect, useState } from "react";
import { fetchJson } from "../api";
import { GraphData, SubgraphData } from "../types";
import { MergeAnimationGraph } from "../components/MergeAnimationGraph";
import { GraphLegend } from "../components/GraphLegend";
import { ResourceLink } from "../components/ResourceLink";
import { MERGE_DATASETS } from "../utils/graphCup";

interface SubgraphIndex {
  sample_cups: string[];
  default_cup: string | null;
}

export function UnioneAnimazione() {
  const [sampleCups, setSampleCups] = useState<string[]>([]);
  const [activeCup, setActiveCup] = useState<string>("");
  const [graphs, setGraphs] = useState<Record<string, GraphData>>({});
  const [merged, setMerged] = useState<SubgraphData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchJson<SubgraphIndex>("subgraphs/index.json").then((d) => {
      setSampleCups(d.sample_cups);
      setActiveCup(d.default_cup ?? d.sample_cups[0] ?? "");
    });
    Promise.all(
      MERGE_DATASETS.map((ds) =>
        fetchJson<GraphData>(`graphs/${ds}.json`).then((g) => [ds, g] as const)
      )
    ).then((entries) => {
      setGraphs(Object.fromEntries(entries));
    });
  }, []);

  useEffect(() => {
    if (!activeCup) return;
    setLoading(true);
    fetchJson<SubgraphData>(`subgraphs/by_cup/${activeCup}.json`)
      .then(setMerged)
      .finally(() => setLoading(false));
  }, [activeCup]);

  const ready =
    merged && MERGE_DATASETS.every((ds) => graphs[ds]) && !loading;

  return (
    <div>
      <h1>Unione animata <span className="badge-demo">prova</span></h1>
      <p className="lead">
        Vista sperimentale: i quattro grafi del campione per un CUP sono mostrati
        separati nei quadranti. Premi <strong>Unisci grafi</strong> per animare i
        nodi con lo <strong>stesso URI</strong> fino a sovrapporsi, come nell&apos;unione
        semantica. I nodi coinvolti nei join hanno il doppio bordo rosso.
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

      {loading && <p>Caricamento…</p>}
      {ready && merged && (
        <>
          <MergeAnimationGraph
            cupCode={activeCup}
            graphs={graphs}
            merged={merged}
          />
          <GraphLegend datasets={merged.datasets_involved} showJoinEdges showJoinNodes />
        </>
      )}
    </div>
  );
}
