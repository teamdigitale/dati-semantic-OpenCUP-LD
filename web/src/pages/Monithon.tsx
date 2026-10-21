import { useEffect, useMemo, useState } from "react";
import { fetchJson } from "../api";
import { GraphData, SubgraphData } from "../types";
import { CytoscapeGraph } from "../components/CytoscapeGraph";
import { GraphLegend } from "../components/GraphLegend";
import { GraphNodeList } from "../components/GraphNodeList";
import { ResourceLink } from "../components/ResourceLink";
import { DATASET_LABELS } from "../constants";
import { useCupQueryParam } from "../hooks/useCupQueryParam";
import { PageIntro } from "../components/PageIntro";
import { site } from "../content/site";
import monithonRaw from "../../content/monithon.md?raw";

interface MonithonCase {
  cup: string;
  report_id: number;
  title: string;
  report_url: string;
  opencoesione_url: string;
  comune?: string | null;
  titolare?: string | null;
  costo?: string | null;
  descrizione?: string | null;
  n_cig: number;
  sources: string[];
}

interface CasesIndex {
  default_cup: string;
  cases: MonithonCase[];
  license?: string;
  attribution_url?: string;
}

type ViewMode = "separati" | "uniti";

const SOURCE_ORDER = ["monithon", "opencup", "cupcig", "enti_ipa"] as const;

export function Monithon() {
  const [cases, setCases] = useState<MonithonCase[]>([]);
  const [activeCup, setActiveCup] = useState("");
  const [view, setView] = useState<ViewMode>("uniti");
  const [activeSource, setActiveSource] = useState<string>("monithon");
  const [graph, setGraph] = useState<GraphData | SubgraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const { selectCup } = useCupQueryParam(
    cases.map((c) => c.cup),
    activeCup,
    setActiveCup
  );

  useEffect(() => {
    fetchJson<CasesIndex>("monithon/cases.json").then((d) => {
      setCases(d.cases);
      if (!activeCup) {
        setActiveCup(d.default_cup ?? d.cases[0]?.cup ?? "");
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const current = useMemo(
    () => cases.find((c) => c.cup === activeCup) ?? null,
    [cases, activeCup]
  );

  const availableSources = useMemo(() => {
    if (!current) return [] as string[];
    return SOURCE_ORDER.filter((s) => current.sources.includes(s));
  }, [current]);

  useEffect(() => {
    if (!current) return;
    if (!availableSources.includes(activeSource)) {
      setActiveSource(availableSources[0] ?? "monithon");
    }
  }, [current, availableSources, activeSource]);

  useEffect(() => {
    if (!activeCup) return;
    setLoading(true);
    const path =
      view === "uniti"
        ? `monithon/by_cup/${activeCup}/unione.json`
        : `monithon/by_cup/${activeCup}/${activeSource}.json`;
    fetchJson<GraphData | SubgraphData>(path)
      .then(setGraph)
      .finally(() => setLoading(false));
  }, [activeCup, view, activeSource]);

  const isUnione = view === "uniti" && graph && "join_edges" in graph;

  return (
    <div>
      <PageIntro raw={monithonRaw} />

      <div className="mb-3">
        <label className="form-label" htmlFor="monithonCase">
          Caso (CUP + report Monithon)
        </label>
        <select
          id="monithonCase"
          className="form-select"
          value={activeCup}
          onChange={(e) => selectCup(e.target.value)}
        >
          {cases.map((c) => (
            <option key={c.cup} value={c.cup}>
              {c.comune ? `${c.comune} — ` : ""}
              {c.title.length > 70 ? `${c.title.slice(0, 70)}…` : c.title} ({c.cup})
            </option>
          ))}
        </select>
      </div>

      {current && (
        <div className="callout callout-note mb-3">
          <div className="callout-title">
            <span className="text">{current.title}</span>
          </div>
          <p className="mb-2">
            CUP <ResourceLink value={`cup:${current.cup}`} />
            {current.comune ? ` · ${current.comune}` : ""}
            {current.n_cig ? ` · ${current.n_cig} CIG ANAC` : ""}
          </p>
          <p className="mb-0">
            <a href={current.report_url} target="_blank" rel="noopener noreferrer">
              Report Monithon #{current.report_id}
            </a>
            {" · "}
            <a
              href={current.opencoesione_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenCoesione
            </a>
            {" · "}
            <span className="text-secondary">
              cm:ha_progetto_monitorato → cup:
            </span>
          </p>
        </div>
      )}

      <div className="btn-group flex-wrap mb-3" role="group" aria-label="Vista grafo">
        <button
          type="button"
          className={`btn btn-sm ${view === "uniti" ? "btn-primary" : "btn-outline-primary"}`}
          onClick={() => setView("uniti")}
        >
          Uniti
        </button>
        <button
          type="button"
          className={`btn btn-sm ${view === "separati" ? "btn-primary" : "btn-outline-primary"}`}
          onClick={() => setView("separati")}
        >
          Separati
        </button>
      </div>

      {view === "separati" && (
        <div
          className="btn-group flex-wrap mb-3"
          role="group"
          aria-label={site.graph.source_aria}
        >
          {availableSources.map((d) => (
            <button
              key={d}
              type="button"
              className={`btn btn-sm ${activeSource === d ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setActiveSource(d)}
            >
              {DATASET_LABELS[d] ?? d}
            </button>
          ))}
        </div>
      )}

      {loading && <p>{site.loading.graph}</p>}
      {graph && !loading && (
        <>
          {isUnione && (
            <div className="callout callout-note mb-3">
              <div className="callout-title">
                <span className="text">{(graph as SubgraphData).title}</span>
              </div>
              <p>{(graph as SubgraphData).sparql_note}</p>
              <p className="mb-0">
                {site.graph.dataset_prefix}
                {(graph as SubgraphData).datasets_involved
                  .map((d) => DATASET_LABELS[d] ?? d)
                  .join(", ")}
                {" · "}
                {site.graph.subgraph_stats
                  .replace("{nodes}", String(graph.nodes.length))
                  .replace("{edges}", String(graph.edges.length))
                  .replace(
                    "{joins}",
                    String((graph as SubgraphData).join_edges.length)
                  )}
              </p>
            </div>
          )}
          {!isUnione && (
            <p className="text-secondary">
              {(graph as GraphData).sample_note}{" "}
              {site.graph.nodes_edges
                .replace("{nodes}", String(graph.nodes.length))
                .replace("{edges}", String(graph.edges.length))}
            </p>
          )}
          <CytoscapeGraph
            data={graph}
            highlightJoin={Boolean(isUnione)}
            height={620}
          />
          <GraphLegend
            datasets={
              isUnione
                ? (graph as SubgraphData).datasets_involved
                : [activeSource]
            }
            showJoinEdges={Boolean(isUnione)}
            showJoinNodes={Boolean(isUnione)}
          />
          <GraphNodeList nodes={graph.nodes} />
        </>
      )}
    </div>
  );
}
