import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { fetchJson } from "../api";
import { ChartData, GraphData, SubgraphData } from "../types";
import { CytoscapeGraph } from "../components/CytoscapeGraph";
import { GraphLegend } from "../components/GraphLegend";
import { GraphNodeList } from "../components/GraphNodeList";
import { ResourceLink } from "../components/ResourceLink";
import { DATASET_LABELS } from "../constants";
import { useCupQueryParam } from "../hooks/useCupQueryParam";
import { PageIntro } from "../components/PageIntro";
import { RegioneCupMap } from "../components/RegioneCupMap";
import { site } from "../content/site";
import monithonRaw from "../../content/monithon.md?raw";

interface MonithonCase {
  cup: string;
  report_id: number;
  title: string;
  report_url: string;
  opencoesione_url: string;
  comune?: string | null;
  regione?: string | null;
  titolare?: string | null;
  costo?: string | null;
  descrizione?: string | null;
  stato?: string | null;
  settore?: string | null;
  n_cig: number;
  sources: string[];
}

interface CasesIndex {
  default_cup: string;
  cases: MonithonCase[];
  license?: string;
  attribution_url?: string;
}

interface MonithonAnalytics {
  catalog: {
    n_reports: number;
    with_cup: number;
    with_cig: number;
    without_subject: number;
    with_issued: number;
  };
  hub: {
    cups: number;
    cigs: number;
    pairs: number;
    opencup_rows: number;
    opencoesione_progetti?: number;
    enti_ipa: number;
    n_anac_aggiudicazioni?: number;
    n_esiti?: number;
    cases: number;
    cases_with_monithon_report: number;
  };
  by_regione: ChartData;
  costo_by_regione: ChartData;
  by_settore: ChartData;
  by_natura: ChartData;
  by_stato: ChartData;
  sources_coverage: ChartData;
  top_cig_per_cup: ChartData;
}

type ViewMode = "separati" | "uniti";

type SortKey =
  | "regione"
  | "comune"
  | "cup"
  | "report"
  | "cig"
  | "costo"
  | "fonti";

type SortDir = "asc" | "desc";

const SOURCE_ORDER = [
  "monithon",
  "opencup",
  "opencoesione",
  "cupcig",
  "anac",
  "scp",
  "enti_ipa",
] as const;

const TABLE_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "regione", label: "Regione" },
  { key: "comune", label: "Comune" },
  { key: "cup", label: "CUP" },
  { key: "report", label: "Report" },
  { key: "cig", label: "CIG" },
  { key: "costo", label: "Costo" },
  { key: "fonti", label: "Fonti" },
];

function parseCosto(raw: string | null | undefined): number {
  if (raw == null || raw === "") return Number.NaN;
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : Number.NaN;
}

function compareCases(a: MonithonCase, b: MonithonCase, key: SortKey): number {
  switch (key) {
    case "regione":
      return (a.regione || "").localeCompare(b.regione || "", "it");
    case "comune":
      return (a.comune || "").localeCompare(b.comune || "", "it");
    case "cup":
      return a.cup.localeCompare(b.cup, "it");
    case "report":
      return a.report_id - b.report_id;
    case "cig":
      return a.n_cig - b.n_cig;
    case "costo": {
      const na = parseCosto(a.costo);
      const nb = parseCosto(b.costo);
      const aMissing = Number.isNaN(na);
      const bMissing = Number.isNaN(nb);
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;
      return na - nb;
    }
    case "fonti":
      return a.sources.length - b.sources.length ||
        a.sources.join(",").localeCompare(b.sources.join(","), "it");
    default:
      return 0;
  }
}

const BI = {
  primary: "#0066cc",
  analogue1: "#008758",
  analogue2: "#a66300",
  neutral: "#5b6f82",
};

function chartPoints(chart: ChartData | null | undefined, maxLen = 28) {
  if (!chart?.labels?.length) return [];
  return chart.labels.map((label, i) => ({
    name: label.length > maxLen ? `${label.slice(0, maxLen)}…` : label,
    fullLabel: label,
    value: chart.series[0]?.data[i] ?? 0,
  }));
}

function MiniBar({
  title,
  data,
  color,
  euro = false,
}: {
  title: string;
  data: { name: string; fullLabel: string; value: number }[];
  color: string;
  euro?: boolean;
}) {
  if (!data.length) return null;
  const height = Math.max(220, data.length * 26);
  return (
    <section className="mb-4">
      <h3 className="h5">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            tick={{ fontSize: 12, fill: BI.neutral }}
            tickFormatter={(v) =>
              euro ? `${Number(v).toLocaleString("it")} €` : Number(v).toLocaleString("it")
            }
          />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fontSize: 12, fill: "#17324d" }}
            interval={0}
          />
          <Tooltip
            formatter={(v: number) =>
              euro
                ? `${Number(v).toLocaleString("it")} €`
                : Number(v).toLocaleString("it")
            }
            labelFormatter={(_, payload) =>
              (payload?.[0]?.payload as { fullLabel?: string })?.fullLabel ?? ""
            }
          />
          <Bar dataKey="value" fill={color} />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}

function formatEuro(raw: string | null | undefined): string {
  if (raw == null || raw === "") return "—";
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return String(raw);
  return `${n.toLocaleString("it")} €`;
}

export function Monithon() {
  const [cases, setCases] = useState<MonithonCase[]>([]);
  const [analytics, setAnalytics] = useState<MonithonAnalytics | null>(null);
  const [activeCup, setActiveCup] = useState("");
  const [view, setView] = useState<ViewMode>("uniti");
  const [activeSource, setActiveSource] = useState<string>("monithon");
  const [graph, setGraph] = useState<GraphData | SubgraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("regione");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const { selectCup } = useCupQueryParam(
    cases.map((c) => c.cup),
    activeCup,
    setActiveCup
  );

  useEffect(() => {
    Promise.all([
      fetchJson<CasesIndex>("monithon/cases.json"),
      fetchJson<MonithonAnalytics>("monithon/analytics.json").catch(() => null),
    ]).then(([d, a]) => {
      setCases(d.cases);
      setAnalytics(a);
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

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "cig" || key === "costo" || key === "fonti" ? "desc" : "asc");
    }
  };

  const tableRows = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...cases].sort((a, b) => {
      const primary = compareCases(a, b, sortKey) * dir;
      if (primary !== 0) return primary;
      if (sortKey !== "regione") {
        const byRegione = compareCases(a, b, "regione");
        if (byRegione !== 0) return byRegione;
      }
      if (sortKey !== "comune") {
        const byComune = compareCases(a, b, "comune");
        if (byComune !== 0) return byComune;
      }
      return a.cup.localeCompare(b.cup, "it");
    });
  }, [cases, sortKey, sortDir]);

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

      {analytics && (
        <section className="mb-4" aria-labelledby="monithon-stats">
          <h2 id="monithon-stats" className="h4">
            Conteggi del catalogo e del grafo
          </h2>
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <div className="callout callout-highlight h-100">
                <div className="callout-title">
                  <span className="text">Catalogo Monithon</span>
                </div>
                <ul className="mb-0">
                  <li>
                    <strong>{analytics.catalog.n_reports.toLocaleString("it")}</strong> report
                  </li>
                  <li>
                    con CUP: {analytics.catalog.with_cup} · con CIG:{" "}
                    {analytics.catalog.with_cig}
                  </li>
                  <li>
                    senza CUP o CIG espliciti: {analytics.catalog.without_subject}{" "}
                    <span className="text-secondary">
                      (in molti casi è indicato solo il codice OpenCoesione)
                    </span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="col-md-6">
              <div className="callout callout-note h-100">
                <div className="callout-title">
                  <span className="text">Grafo collegato</span>
                </div>
                <ul className="mb-0">
                  <li>
                    <strong>{analytics.hub.cups}</strong> CUP ·{" "}
                    <strong>{analytics.hub.cigs}</strong> CIG ·{" "}
                    {analytics.hub.pairs} coppie CUP↔CIG (ANAC)
                  </li>
                  <li>
                    OpenCUP: {analytics.hub.opencup_rows} righe · OpenCoesione:{" "}
                    {analytics.hub.opencoesione_progetti ?? 0} progetti ·
                    IndicePA: {analytics.hub.enti_ipa} enti
                  </li>
                  <li>
                    ANAC aggiudicazioni:{" "}
                    {analytics.hub.n_anac_aggiudicazioni ?? 0} · SCP esiti:{" "}
                    {analytics.hub.n_esiti ?? 0}
                  </li>
                  <li>
                    casi in questa pagina: {analytics.hub.cases} (con report
                    Monithon: {analytics.hub.cases_with_monithon_report})
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <section className="mb-4" aria-labelledby="monithon-mappa">
            <h3 id="monithon-mappa" className="h5">
              Distribuzione territoriale dei CUP
            </h3>
            <p className="text-secondary small">
              Numero di CUP (o costo OpenCUP associato) per regione nei casi
              Monithon collegati al grafo.
            </p>
            <RegioneCupMap
              chart={analytics.by_regione}
              euroChart={analytics.costo_by_regione}
              preferChart
              footerNote="Colori = CUP Monithon per regione (o costo OpenCUP in euro). Confini: openpolis / ISTAT."
            />
          </section>

          <div className="row g-3">
            <div className="col-lg-6">
              <MiniBar
                title={analytics.by_regione.title}
                data={chartPoints(analytics.by_regione)}
                color={BI.primary}
              />
            </div>
            <div className="col-lg-6">
              <MiniBar
                title={analytics.costo_by_regione.title}
                data={chartPoints(analytics.costo_by_regione)}
                color={BI.analogue1}
                euro
              />
            </div>
            <div className="col-lg-6">
              <MiniBar
                title={analytics.by_settore.title}
                data={chartPoints(analytics.by_settore, 36)}
                color={BI.analogue2}
              />
            </div>
            <div className="col-lg-6">
              <MiniBar
                title={analytics.sources_coverage.title}
                data={chartPoints(analytics.sources_coverage, 20)}
                color={BI.neutral}
              />
            </div>
          </div>

          <div className="table-responsive mb-4">
            <table className="table table-sm table-striped align-middle">
              <caption className="text-start">
                CUP del grafo Monithon — clicca l’intestazione per ordinare
                {` (${TABLE_COLUMNS.find((c) => c.key === sortKey)?.label ?? sortKey}, ${
                  sortDir === "asc" ? "crescente" : "decrescente"
                })`}
              </caption>
              <thead>
                <tr>
                  {TABLE_COLUMNS.map(({ key, label }) => {
                    const active = sortKey === key;
                    const ariaSort = active
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none";
                    return (
                      <th
                        key={key}
                        scope="col"
                        aria-sort={ariaSort}
                        className="monithon-sortable-th"
                      >
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 text-decoration-none text-dark fw-semibold monithon-sort-btn"
                          onClick={() => toggleSort(key)}
                          aria-label={
                            active
                              ? `Ordina per ${label}, attualmente ${
                                  sortDir === "asc" ? "crescente" : "decrescente"
                                }. Clicca per invertire.`
                              : `Ordina per ${label}`
                          }
                        >
                          {label}
                          <span
                            className={`monithon-sort-indicator${active ? " is-active" : ""}`}
                            aria-hidden="true"
                          >
                            {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((c) => (
                  <tr
                    key={c.cup}
                    className={c.cup === activeCup ? "table-primary" : undefined}
                  >
                    <td>{c.regione || "—"}</td>
                    <td>{c.comune || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 align-baseline"
                        onClick={() => selectCup(c.cup)}
                      >
                        {c.cup}
                      </button>
                    </td>
                    <td>
                      <a
                        href={c.report_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        #{c.report_id}
                      </a>
                    </td>
                    <td>{c.n_cig}</td>
                    <td>{formatEuro(c.costo)}</td>
                    <td className="small">
                      {c.sources
                        .map((s) => DATASET_LABELS[s] ?? s)
                        .join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <h2 className="h4">Grafo per CUP</h2>

      <div className="mb-3">
        <label className="form-label" htmlFor="monithonCase">
          Progetto (CUP e report Monithon)
        </label>
        <select
          id="monithonCase"
          className="form-select"
          value={activeCup}
          onChange={(e) => selectCup(e.target.value)}
        >
          {cases.map((c) => (
            <option key={c.cup} value={c.cup}>
              {c.regione ? `${c.regione} / ` : ""}
              {c.comune ? `${c.comune} — ` : ""}
              {c.title.length > 60 ? `${c.title.slice(0, 60)}…` : c.title} ({c.cup})
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
            {current.regione ? ` · ${current.regione}` : ""}
            {current.comune ? ` · ${current.comune}` : ""}
            {current.n_cig ? ` · ${current.n_cig} CIG ANAC` : ""}
            {current.costo ? ` · ${formatEuro(current.costo)}` : ""}
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
              schema:about / dct:subject → cup:
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
