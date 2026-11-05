import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchJson } from "../api";
import {
  SnaIndex,
  SnaMeta,
  SnaMetric,
  SnaNetwork,
  SnaNode,
  SnaQueriesDoc,
} from "../types";
import { PageIntro } from "../components/PageIntro";
import {
  COMMUNITY_PALETTE,
  KIND_COLORS,
  KIND_LABELS,
  METRIC_LABELS,
  SnaColorMode,
  SnaGraph,
} from "../components/SnaGraph";
import { SnaQueryCompare } from "../components/SnaQueryCompare";
import { site } from "../content/site";
import reteRaw from "../../content/rete.md?raw";

const BASE = import.meta.env.BASE_URL;

interface EgoEntry {
  id: string;
  kind: "ente" | "rup" | string;
  key: string;
  label: string;
  cf?: string | null;
  n_cig: number;
  n_cup: number;
  path: string;
  has_graph: boolean;
  ipa?: string | null;
}

interface EgoIndex {
  title: string;
  note: string;
  n_entries: number;
  n_with_graph: number;
  entries: EgoEntry[];
}

type ExploreMode = "seed" | "ego";

function safeMatchId(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase();
  return norm(a) === norm(b);
}

function formatEuro(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString("it", { maximumFractionDigits: 0 })} €`;
}

function formatMetric(metric: SnaMetric, v: number): string {
  if (metric === "degree") return v.toLocaleString("it");
  if (metric === "weighted_degree")
    return v.toLocaleString("it", { maximumFractionDigits: 0 });
  return v.toLocaleString("it", { maximumFractionDigits: 6 });
}

function metaFromEgo(
  entry: EgoEntry,
  net: SnaNetwork,
  fileMeta?: Partial<SnaMeta> & Record<string, unknown>
): SnaMeta {
  const kinds: Record<string, number> = {};
  for (const n of net.nodes) {
    kinds[n.kind] = (kinds[n.kind] || 0) + 1;
  }
  const rels: Record<string, number> = {};
  for (const e of net.edges) {
    rels[e.rel] = (rels[e.rel] || 0) + 1;
  }
  const ranked = [...net.nodes].sort(
    (a, b) => (b.pagerank || 0) - (a.pagerank || 0)
  );
  const top = ranked.slice(0, 15).map((n) => ({
    id: n.id,
    label: n.label,
    kind: n.kind,
    value: n.pagerank,
  }));
  return {
    id: String(fileMeta?.id || `ego-${entry.kind}-${entry.id}`),
    title: String(fileMeta?.title || `${entry.kind}: ${entry.label}`),
    description: String(
      fileMeta?.description ||
        `Ego-network nazionale per ${entry.kind} «${entry.label}».`
    ),
    sources_line: String(
      fileMeta?.sources_line ||
        "SCP MIT esiti · OpenCUP · cup_cig · OpenPNRR (flag)"
    ),
    n_nodes: net.nodes.length,
    n_edges: net.edges.length,
    n_communities: Number(fileMeta?.n_communities || 1),
    n_components: 1,
    density: 0,
    modularity: 0,
    kinds: (fileMeta?.kinds as Record<string, number>) || kinds,
    rels: (fileMeta?.rels as Record<string, number>) || rels,
    metrics: ["degree", "weighted_degree", "betweenness", "pagerank"],
    top_pagerank: top,
    top_betweenness: [...net.nodes]
      .sort((a, b) => (b.betweenness || 0) - (a.betweenness || 0))
      .slice(0, 15)
      .map((n) => ({
        id: n.id,
        label: n.label,
        kind: n.kind,
        value: n.betweenness,
      })),
    top_degree: [...net.nodes]
      .sort((a, b) => (b.degree || 0) - (a.degree || 0))
      .slice(0, 15)
      .map((n) => ({
        id: n.id,
        label: n.label,
        kind: n.kind,
        value: n.degree,
      })),
    graphml: "",
    network: entry.path,
  };
}

export function Rete() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [index, setIndex] = useState<SnaIndex | null>(null);
  const [egoIndex, setEgoIndex] = useState<EgoIndex | null>(null);
  const [mode, setMode] = useState<ExploreMode>("seed");
  const [seedId, setSeedId] = useState("");
  const [egoEntry, setEgoEntry] = useState<EgoEntry | null>(null);
  const [egoQuery, setEgoQuery] = useState("");
  const [meta, setMeta] = useState<SnaMeta | null>(null);
  const [network, setNetwork] = useState<SnaNetwork | null>(null);
  const [queries, setQueries] = useState<SnaQueriesDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [egoHint, setEgoHint] = useState<string | null>(null);

  const [metric, setMetric] = useState<SnaMetric>("pagerank");
  const [colorMode, setColorMode] = useState<SnaColorMode>("community");
  const [kinds, setKinds] = useState<Set<string>>(new Set());
  const [topN, setTopN] = useState(120);
  const [minDegree, setMinDegree] = useState(0);
  const [query, setQuery] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [selected, setSelected] = useState<SnaNode | null>(null);

  useEffect(() => {
    Promise.all([
      fetchJson<SnaIndex>("sna/index.json"),
      fetchJson<EgoIndex>("sna/ego_index.json").catch(() => null),
    ])
      .then(([idx, ego]) => {
        setIndex(idx);
        setEgoIndex(ego);
        const kind = searchParams.get("kind");
        const id = searchParams.get("id");
        const seed = searchParams.get("seed");
        if (kind && id && ego) {
          const hit = ego.entries.find(
            (e) => e.kind === kind && (e.id === id || e.key === id || e.cf === id)
          );
          if (hit) {
            setMode("ego");
            setEgoEntry(hit);
            setEgoQuery(hit.label);
            return;
          }
        }
        const preferred =
          seed ||
          idx.seeds.find((s) => s.id === "pa-digitale")?.id ||
          idx.seeds[0]?.id ||
          "";
        setSeedId(preferred);
        setMode("seed");
      })
      .catch((e) => setError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap from URL once
  }, []);

  useEffect(() => {
    if (mode !== "seed" || !seedId || !index) return;
    const entry = index.seeds.find((s) => s.id === seedId);
    if (!entry) return;
    setLoading(true);
    setError(null);
    setEgoHint(null);
    setSelected(null);
    setFocusId(null);
    setQuery("");
    const queriesPath =
      (entry as { queries?: string }).queries ?? `sna/${entry.id}/queries.json`;
    Promise.all([
      fetchJson<SnaMeta>(entry.meta),
      fetchJson<SnaNetwork>(entry.path),
      fetchJson<SnaQueriesDoc>(queriesPath).catch(() => null),
    ])
      .then(([m, n, q]) => {
        setMeta(m);
        setNetwork(n);
        setQueries(q);
        setKinds(new Set(Object.keys(m.kinds)));
        setTopN(m.n_nodes > 400 ? 120 : Math.min(200, m.n_nodes));
        setMinDegree(0);
        setSearchParams({ seed: seedId }, { replace: true });
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [seedId, index, mode, setSearchParams]);

  useEffect(() => {
    if (mode !== "ego" || !egoEntry) return;
    setLoading(true);
    setError(null);
    setSelected(null);
    setFocusId(null);
    setQuery("");
    setQueries(null);

    if (!egoEntry.has_graph) {
      setNetwork(null);
      setMeta(null);
      setEgoHint(
        `Grafo non ancora materializzato. Genera con: make sna-ego ${
          egoEntry.kind === "ente"
            ? `ENTE=${egoEntry.cf || egoEntry.key}`
            : `RUP='${egoEntry.key}'`
        }`
      );
      setLoading(false);
      setSearchParams(
        { kind: egoEntry.kind, id: egoEntry.id },
        { replace: true }
      );
      return;
    }

    const metaPath = egoEntry.path.replace(/network\.json$/, "meta.json");
    Promise.all([
      fetchJson<SnaNetwork>(egoEntry.path),
      fetchJson<Record<string, unknown>>(metaPath).catch(() => ({})),
    ])
      .then(([n, m]) => {
        const metaBuilt = metaFromEgo(egoEntry, n, m);
        setNetwork(n);
        setMeta(metaBuilt);
        setKinds(new Set(Object.keys(metaBuilt.kinds)));
        setTopN(Math.min(200, n.nodes.length));
        setMinDegree(0);
        setEgoHint(null);
        setSearchParams(
          { kind: egoEntry.kind, id: egoEntry.id },
          { replace: true }
        );
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [egoEntry, mode, setSearchParams]);

  const egoSuggestions = useMemo(() => {
    if (!egoIndex || egoQuery.trim().length < 2) return [];
    const q = egoQuery.trim().toLowerCase();
    return egoIndex.entries
      .filter(
        (e) =>
          e.label.toLowerCase().includes(q) ||
          (e.cf && e.cf.toLowerCase().includes(q)) ||
          e.key.toLowerCase().includes(q) ||
          (e.ipa && e.ipa.toLowerCase().includes(q))
      )
      .slice(0, 25);
  }, [egoIndex, egoQuery]);

  /** Se la ricerca sul seed non trova nulla, proponi enti/RUP nazionali. */
  const crossEgoHints = useMemo(() => {
    if (mode !== "seed" || !egoIndex || !network || query.trim().length < 3) {
      return [];
    }
    const q = query.trim().toLowerCase();
    const inSeed = network.nodes.some(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q) ||
        (n.cf && n.cf.toLowerCase().includes(q))
    );
    if (inSeed) return [];
    return egoIndex.entries
      .filter(
        (e) =>
          e.has_graph &&
          (e.label.toLowerCase().includes(q) ||
            (e.cf && e.cf.toLowerCase().includes(q)))
      )
      .slice(0, 8);
  }, [mode, egoIndex, network, query]);

  /** Ego nazionale precomputato per il nodo selezionato (ente/SA/RUP/impresa). */
  const selectedNationalEgo = useMemo(() => {
    if (!selected || !egoIndex) return null;
    const cf = (selected.cf || "").trim().toUpperCase();
    const label = (selected.label || "").trim();
    const kind = selected.kind;

    if ((kind === "ente" || kind === "sa" || kind === "beneficiario") && cf) {
      return (
        egoIndex.entries.find(
          (e) => e.kind === "ente" && e.has_graph && e.cf === cf
        ) || null
      );
    }
    if (kind === "impresa" && cf) {
      return (
        egoIndex.entries.find(
          (e) => e.kind === "impresa" && e.has_graph && e.cf === cf
        ) || null
      );
    }
    if (kind === "rup" && label) {
      const key = label.toUpperCase();
      return (
        egoIndex.entries.find(
          (e) =>
            e.kind === "rup" &&
            e.has_graph &&
            (e.key.toUpperCase() === key || e.label.toUpperCase() === key)
        ) || null
      );
    }
    // Match by node id suffix (ente:CF / rup:NAME)
    const id = selected.id || "";
    if (id.startsWith("ente:") || id.startsWith("sa:")) {
      const key = id.split(":")[1] || "";
      return (
        egoIndex.entries.find(
          (e) =>
            e.kind === "ente" &&
            e.has_graph &&
            (e.id === key || e.cf === key || safeMatchId(e.id, key))
        ) || null
      );
    }
    if (id.startsWith("rup:")) {
      const key = id.slice(4);
      return (
        egoIndex.entries.find(
          (e) =>
            e.kind === "rup" &&
            e.has_graph &&
            (e.id === key || safeMatchId(e.id, key))
        ) || null
      );
    }
    if (id.startsWith("impresa:")) {
      const key = id.slice(9);
      return (
        egoIndex.entries.find(
          (e) =>
            e.kind === "impresa" &&
            e.has_graph &&
            (e.id === key || e.cf === key || safeMatchId(e.id, key))
        ) || null
      );
    }
    return null;
  }, [selected, egoIndex]);

  const openNationalEgo = useCallback((entry: EgoEntry) => {
    setMode("ego");
    setEgoEntry(entry);
    setEgoQuery(entry.label);
    setFocusId(null);
    setSelected(null);
    setQuery("");
  }, []);

  const toggleKind = (kind: string) => {
    setKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const onSelectNode = useCallback((node: SnaNode | null) => {
    setSelected(node);
  }, []);

  const graphmlHref = useMemo(() => {
    if (!meta?.graphml) return null;
    return `${BASE}data/${meta.graphml}`;
  }, [meta]);

  const currentEntry = index?.seeds.find((s) => s.id === seedId);

  const topTable = useMemo(() => {
    if (!meta) return [];
    if (metric === "betweenness") return meta.top_betweenness;
    if (metric === "degree" || metric === "weighted_degree") return meta.top_degree;
    return meta.top_pagerank;
  }, [meta, metric]);

  return (
    <div className="sna-page">
      <PageIntro raw={reteRaw} />

      {error && (
        <div className="callout callout-danger mb-3">
          <div className="callout-title">
            <span className="text">Errore</span>
          </div>
          <p className="mb-0">{error}</p>
        </div>
      )}

      <section className="mb-3" aria-label="Modalità esplorazione">
        <div className="sna-chip-row" role="group">
          <button
            type="button"
            className={`sna-chip${mode === "seed" ? " is-active" : ""}`}
            onClick={() => {
              setMode("seed");
              setEgoEntry(null);
              setEgoHint(null);
            }}
          >
            Seed predefiniti
          </button>
          <button
            type="button"
            className={`sna-chip${mode === "ego" ? " is-active" : ""}`}
            onClick={() => setMode("ego")}
            disabled={!egoIndex}
          >
            Esplora ente / RUP
            {egoIndex
              ? ` (${egoIndex.n_with_graph.toLocaleString("it")} grafi)`
              : ""}
          </button>
        </div>
      </section>

      {mode === "ego" && egoIndex && (
        <section className="sna-seed-picker mb-4" aria-labelledby="sna-ego-heading">
          <h2 id="sna-ego-heading" className="h5 mb-2">
            Cerca un ente o un RUP (nazionale)
          </h2>
          <p className="text-secondary small mb-2">{egoIndex.note}</p>
          <label className="form-label" htmlFor="egoSearch">
            Nome, CF o codice IPA
          </label>
          <input
            id="egoSearch"
            type="search"
            className="form-control mb-2"
            placeholder="es. Comune di…, CF ente, cognome RUP…"
            value={egoQuery}
            onChange={(e) => setEgoQuery(e.target.value)}
            autoComplete="off"
          />
          {egoSuggestions.length > 0 && (
            <ul className="list-group mb-2" style={{ maxHeight: 280, overflow: "auto" }}>
              {egoSuggestions.map((e) => (
                <li key={`${e.kind}-${e.id}`} className="list-group-item p-0">
                  <button
                    type="button"
                    className="btn btn-link text-start w-100 text-decoration-none px-3 py-2"
                    onClick={() => {
                      setEgoEntry(e);
                      setEgoQuery(e.label);
                    }}
                  >
                    <span className="badge bg-primary me-2">
                      {e.kind === "ente"
                        ? "Ente"
                        : e.kind === "impresa"
                          ? "Impresa"
                          : "RUP"}
                    </span>
                    <strong>{e.label}</strong>
                    <span className="small text-secondary d-block">
                      {e.cf ? `CF ${e.cf} · ` : ""}
                      {e.n_cig} CIG · {e.n_cup} CUP
                      {e.has_graph ? "" : " · grafo da generare"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {egoHint && (
            <div className="callout callout-warning">
              <div className="callout-title">
                <span className="text">Grafo assente</span>
              </div>
              <p className="mb-0">
                <code>{egoHint}</code>
              </p>
            </div>
          )}
        </section>
      )}

      {mode === "seed" && index && (
        <section className="sna-seed-picker mb-4" aria-labelledby="sna-seed-heading">
          <h2 id="sna-seed-heading" className="h5 mb-2">
            Scegli il seed della rete
          </h2>
          <p className="text-secondary small mb-3">
            Ogni card è un perimetro diverso. Le comunità e le metriche sono
            calcolate su <em>tutta</em> la rete di quel seed; sotto puoi
            ridurre cosa disegnare.
          </p>
          <div
            className="sna-seed-grid"
            role="radiogroup"
            aria-label="Seed della rete"
          >
            {index.seeds.map((s) => {
              const active = s.id === seedId;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`sna-seed-card${active ? " is-active" : ""}`}
                  onClick={() => setSeedId(s.id)}
                >
                  <span className="sna-seed-card__title">{s.title}</span>
                  {s.blurb ? (
                    <span className="sna-seed-card__blurb">{s.blurb}</span>
                  ) : null}
                  <span className="sna-seed-card__stats">
                    {s.nodes.toLocaleString("it")} nodi ·{" "}
                    {s.edges.toLocaleString("it")} archi · {s.n_communities}{" "}
                    comunità
                  </span>
                </button>
              );
            })}
          </div>
          {currentEntry && (
            <p className="sna-seed-desc mt-3 mb-0">{currentEntry.description}</p>
          )}
        </section>
      )}

      {meta && (
        <div className="sna-stat-strip mb-4" aria-label="Sintesi rete selezionata">
          <div className="sna-stat">
            <span className="sna-stat__label">Nodi</span>
            <span className="sna-stat__value">{meta.n_nodes.toLocaleString("it")}</span>
          </div>
          <div className="sna-stat">
            <span className="sna-stat__label">Archi</span>
            <span className="sna-stat__value">{meta.n_edges.toLocaleString("it")}</span>
          </div>
          <div className="sna-stat">
            <span className="sna-stat__label">Comunità Louvain</span>
            <span className="sna-stat__value">
              {meta.n_communities.toLocaleString("it")}
            </span>
            <span className="sna-stat__hint">
              mod.{" "}
              {meta.modularity.toLocaleString("it", { maximumFractionDigits: 3 })}
            </span>
          </div>
          <div className="sna-stat">
            <span className="sna-stat__label">Densità</span>
            <span className="sna-stat__value">
              {meta.density.toLocaleString("it", { maximumFractionDigits: 4 })}
            </span>
            <span className="sna-stat__hint">
              {meta.n_components} componenti
            </span>
          </div>
          <div className="sna-stat sna-stat--wide">
            <span className="sna-stat__label">Fonti</span>
            <span className="sna-stat__hint sna-stat__hint--block">
              {meta.sources_line}
            </span>
          </div>
        </div>
      )}

      <section className="sna-controls mb-4" aria-labelledby="sna-controls-heading">
        <div className="sna-controls__head">
          <h2 id="sna-controls-heading" className="h5 mb-0">
            Controlli della vista
          </h2>
          <p className="text-secondary small mb-0">
            Non cambiano le metriche sul file: filtrano solo il disegno.
          </p>
        </div>

        <div className="sna-controls__grid">
          <div className="sna-control-block">
            <span className="sna-control-block__label">Dimensione nodo =</span>
            <div className="sna-chip-row" role="group" aria-label="Metrica dimensione">
              {(Object.keys(METRIC_LABELS) as SnaMetric[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`sna-chip${metric === m ? " is-active" : ""}`}
                  onClick={() => setMetric(m)}
                >
                  {METRIC_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          <div className="sna-control-block">
            <span className="sna-control-block__label">Colore nodo =</span>
            <div className="sna-chip-row" role="group" aria-label="Colore nodi">
              <button
                type="button"
                className={`sna-chip${colorMode === "community" ? " is-active" : ""}`}
                onClick={() => setColorMode("community")}
              >
                Comunità
              </button>
              <button
                type="button"
                className={`sna-chip${colorMode === "kind" ? " is-active" : ""}`}
                onClick={() => setColorMode("kind")}
              >
                Tipo soggetto
              </button>
            </div>
          </div>

          {meta && (
            <div className="sna-control-block sna-control-block--full">
              <span className="sna-control-block__label">Tipi soggetto in vista</span>
              <div className="sna-chip-row" role="group" aria-label="Filtra tipi">
                {Object.keys(meta.kinds).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`sna-chip sna-chip--kind${kinds.has(k) ? " is-active" : ""}`}
                    onClick={() => toggleKind(k)}
                    style={
                      kinds.has(k)
                        ? {
                            borderColor: KIND_COLORS[k]?.accent,
                            background: KIND_COLORS[k]?.fill,
                          }
                        : undefined
                    }
                  >
                    {KIND_LABELS[k] ?? k}
                    <span className="sna-chip__count">
                      {meta.kinds[k].toLocaleString("it")}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="sna-control-block">
            <label className="sna-control-block__label" htmlFor="snaTopN">
              Top N nodi disegnati (0 = tutti)
            </label>
            <input
              id="snaTopN"
              type="number"
              className="form-control form-control-sm sna-input"
              min={0}
              max={meta?.n_nodes ?? 20000}
              step={10}
              value={topN}
              onChange={(e) => {
                const v = Number(e.target.value);
                setTopN(Number.isFinite(v) ? Math.max(0, v) : 0);
              }}
            />
            <div className="sna-chip-row mt-2" role="group" aria-label="Preset vista">
              <button
                type="button"
                className={`sna-chip${topN === 0 ? " is-active" : ""}`}
                onClick={() => setTopN(0)}
              >
                Tutti i nodi filtrati
              </button>
              {meta?.kinds?.ente != null && (
                <button
                  type="button"
                  className={`sna-chip${
                    kinds.size === 1 && kinds.has("ente") && topN === 0
                      ? " is-active"
                      : ""
                  }`}
                  onClick={() => {
                    setKinds(new Set(["ente"]));
                    setTopN(0);
                    setMinDegree(0);
                    setFocusId(null);
                    setQuery("");
                    setColorMode("kind");
                  }}
                >
                  Solo enti (tutti, {meta.kinds.ente.toLocaleString("it")})
                </button>
              )}
            </div>
          </div>

          <div className="sna-control-block">
            <label className="sna-control-block__label" htmlFor="snaMinDeg">
              Grado minimo
            </label>
            <input
              id="snaMinDeg"
              type="number"
              className="form-control form-control-sm sna-input"
              min={0}
              max={50}
              value={minDegree}
              onChange={(e) => setMinDegree(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>

          <div className="sna-control-block sna-control-block--grow">
            <label className="sna-control-block__label" htmlFor="snaQuery">
              Cerca soggetto (label / CF) + vicini
            </label>
            <input
              id="snaQuery"
              type="search"
              className="form-control form-control-sm sna-input"
              placeholder="es. Crucianelli, Maggioli, Macerata…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {crossEgoHints.length > 0 && (
              <div className="callout callout-note mt-2 mb-0 py-2">
                <p className="small mb-1">
                  Non compare in questo seed (hub filtrato). Disponibile come
                  ego-network nazionale:
                </p>
                <ul className="mb-0 ps-3">
                  {crossEgoHints.map((e) => (
                    <li key={`${e.kind}-${e.id}`}>
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 align-baseline"
                        onClick={() => {
                          setMode("ego");
                          setEgoEntry(e);
                          setEgoQuery(e.label);
                          setQuery("");
                        }}
                      >
                        {e.kind === "ente" ? "Ente" : "RUP"}: {e.label}
                      </button>
                      <span className="small text-secondary">
                        {" "}
                        · {e.n_cig} CIG
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="sna-control-block sna-control-block--actions">
            {graphmlHref && (
              <a className="btn btn-sm btn-outline-primary" href={graphmlHref} download>
                Scarica GraphML
              </a>
            )}
          </div>
        </div>
      </section>

      {focusId && (
        <p className="small">
          Focus ego su <code>{focusId}</code>{" "}
          <button
            type="button"
            className="btn btn-link btn-sm p-0"
            onClick={() => setFocusId(null)}
          >
            rimuovi
          </button>
        </p>
      )}

      {loading && <p>{site.loading.graph}</p>}

      <div className="row g-3 mb-4">
        <div className="col-lg-8">
          {network && !loading && kinds.size > 0 && (
            <SnaGraph
              network={network}
              metric={metric}
              colorMode={colorMode}
              kinds={kinds}
              topN={topN}
              minDegree={minDegree}
              query={query}
              focusId={focusId}
              onSelectNode={onSelectNode}
            />
          )}
          {colorMode === "kind" && (
            <ul className="list-inline small mt-2 sna-legend">
              {Object.entries(KIND_COLORS).map(([k, c]) => (
                <li key={k} className="list-inline-item me-3">
                  <span
                    className="sna-swatch"
                    style={{ background: c.fill, borderColor: c.accent }}
                  />{" "}
                  {KIND_LABELS[k] ?? k}
                </li>
              ))}
            </ul>
          )}
          {colorMode === "community" && meta && (
            <p className="small text-secondary mt-2 mb-0">
              Colori = comunità Louvain (fino a {COMMUNITY_PALETTE.length} tinte
              cicliche). Bordo rosso = nodo seed / focus.
            </p>
          )}
        </div>
        <div className="col-lg-4">
          {selected ? (
            <div className="callout callout-note mb-3">
              <div className="callout-title">
                <span className="text">{selected.label}</span>
              </div>
              <ul className="mb-2 small">
                <li>
                  Tipo: {KIND_LABELS[selected.kind] ?? selected.kind}
                  {selected.seed ? " · seed" : ""}
                </li>
                {selected.cf ? <li>CF: {selected.cf}</li> : null}
                {selected.report_url ? (
                  <li>
                    <a
                      href={selected.report_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Apri report Monithon
                    </a>
                  </li>
                ) : null}
                <li>Comunità: {selected.community}</li>
                <li>Grado: {selected.degree}</li>
                <li>
                  Grado pesato:{" "}
                  {selected.weighted_degree.toLocaleString("it", {
                    maximumFractionDigits: 0,
                  })}
                </li>
                <li>Betweenness: {formatMetric("betweenness", selected.betweenness)}</li>
                <li>PageRank: {formatMetric("pagerank", selected.pagerank)}</li>
                <li>Importo aggregato: {formatEuro(selected.importo_tot)}</li>
              </ul>
              <p className="small text-secondary mb-2">
                Due modalità di ego-network:
              </p>
              <div className="d-flex flex-column gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => setFocusId(selected.id)}
                >
                  Ego 1 hop — solo nel grafo corrente
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={!selectedNationalEgo}
                  onClick={() => {
                    if (selectedNationalEgo) openNationalEgo(selectedNationalEgo);
                  }}
                >
                  Rete completa nazionale
                  {selectedNationalEgo
                    ? ` (${selectedNationalEgo.n_cig} CIG)`
                    : ""}
                </button>
                {!selectedNationalEgo &&
                  (selected.kind === "ente" ||
                    selected.kind === "sa" ||
                    selected.kind === "rup" ||
                    selected.kind === "impresa") && (
                    <p className="small text-secondary mb-0">
                      Rete nazionale non precomputata per questo soggetto.
                      {selected.cf
                        ? ` Genera con: make sna-ego ${
                            selected.kind === "rup"
                              ? `RUP='${selected.label}'`
                              : selected.kind === "impresa"
                                ? `IMPRESA=${selected.cf}`
                                : `ENTE=${selected.cf}`
                          }`
                        : selected.kind === "rup"
                          ? ` Genera con: make sna-ego RUP='${selected.label}'`
                          : ""}
                    </p>
                  )}
              </div>
            </div>
          ) : (
            <p className="text-secondary small">
              Clicca un nodo per il dettaglio e per aprire l’ego-network (1 hop
              nel grafo, oppure rete completa nazionale).
            </p>
          )}

          <h3 className="h6">Top nodi — {METRIC_LABELS[metric]}</h3>
          <div className="table-responsive">
            <table className="table table-sm table-striped align-middle">
              <thead>
                <tr>
                  <th scope="col">Soggetto</th>
                  <th scope="col">Tipo</th>
                  <th scope="col" className="text-end">
                    Valore
                  </th>
                </tr>
              </thead>
              <tbody>
                {topTable.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 align-baseline text-start"
                        onClick={() => {
                          setQuery(row.label || row.id);
                          setFocusId(null);
                          const node = network?.nodes.find((n) => n.id === row.id);
                          if (node) setSelected(node);
                        }}
                      >
                        {(row.label || row.id).length > 36
                          ? `${(row.label || row.id).slice(0, 34)}…`
                          : row.label || row.id}
                      </button>
                    </td>
                    <td className="small">{KIND_LABELS[row.kind ?? ""] ?? row.kind}</td>
                    <td className="text-end small">
                      {formatMetric(
                        metric === "weighted_degree" ? "degree" : metric,
                        Number(row.value)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {queries && !loading && mode === "seed" && <SnaQueryCompare doc={queries} />}
    </div>
  );
}
