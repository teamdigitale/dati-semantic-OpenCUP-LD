import { useEffect, useState } from "react";
import { fetchJson } from "../api";
import { GraphData, SubgraphData } from "../types";
import { MergeAnimationGraph } from "../components/MergeAnimationGraph";
import { GraphLegend } from "../components/GraphLegend";
import { ResourceLink } from "../components/ResourceLink";
import { MERGE_DATASETS } from "../utils/graphCup";
import { useCupQueryParam } from "../hooks/useCupQueryParam";
import { PageIntro } from "../components/PageIntro";
import unioneAnimRaw from "../../content/unione-animazione.md?raw";

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
  const { selectCup } = useCupQueryParam(sampleCups, activeCup, setActiveCup);

  useEffect(() => {
    fetchJson<SubgraphIndex>("subgraphs/index.json").then((d) => {
      setSampleCups(d.sample_cups);
      if (!activeCup) {
        setActiveCup(d.default_cup ?? d.sample_cups[0] ?? "");
      }
    });
    Promise.all(
      MERGE_DATASETS.map((ds) =>
        fetchJson<GraphData>(`graphs/${ds}.json`).then((g) => [ds, g] as const)
      )
    ).then((entries) => {
      setGraphs(Object.fromEntries(entries));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      <PageIntro raw={unioneAnimRaw} />
      <p className="text-secondary">
        Premi <strong>Unisci grafi</strong>: i nodi con lo stesso URI si
        sovrappongono — è il join semantico che le tabelle nascondono.
      </p>

      <div className="mb-3">
        <label className="form-label" htmlFor="cupSelectAnim">
          CUP
        </label>
        <select
          id="cupSelectAnim"
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
