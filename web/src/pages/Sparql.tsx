import { useEffect, useMemo, useRef, useState } from "react";
import { fetchJson } from "../api";
import { PageIntro } from "../components/PageIntro";
import {
  ReteManifest,
  ReteManifestDataset,
  ReteOpenResult,
  ReteQueryResult,
  ReteTerm,
} from "../types";
import { PREFIXES } from "../utils/uri";
import { ReteSparqlClient, reteAssetUrl } from "../utils/reteSparqlClient";
import sparqlRaw from "../../content/sparql.md?raw";

const PAGE_SIZE = 50;
const SPARQL_PREFIXES: Record<string, string> = {
  ...PREFIXES,
  oc: "https://w3id.org/italia/draft/OpenCoesione/onto/OpenCoesione/",
  occv: "https://w3id.org/italia/draft/OpenCoesione/controlled-vocabulary/",
  schema: "https://schema.org/",
  dct: "http://purl.org/dc/terms/",
  foaf: "http://xmlns.com/foaf/0.1/",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
};

function formatBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 ** 2).toFixed(2)} MB`;
}

function compactUri(uri: string): string {
  const prefix = Object.entries(SPARQL_PREFIXES)
    .sort((a, b) => b[1].length - a[1].length)
    .find(([, ns]) => uri.startsWith(ns));
  if (!prefix) return uri;
  return `${prefix[0]}:${uri.slice(prefix[1].length)}`;
}

function TermValue({ term }: { term: ReteTerm | null | undefined }) {
  if (!term) return <span className="sparql-unbound">—</span>;
  if (term.kind === "iri") {
    const compact = compactUri(term.value);
    return (
      <a
        href={term.value}
        target="_blank"
        rel="noopener noreferrer"
        className="sparql-iri"
        title={term.value}
      >
        {compact}
      </a>
    );
  }
  return (
    <span className="sparql-literal" title={term.n3 || term.value}>
      {term.value}
      {term.lang && <span className="sparql-term-meta">@{term.lang}</span>}
      {term.datatype && !term.datatype.endsWith("#string") && (
        <span className="sparql-term-meta">
          ^{compactUri(term.datatype)}
        </span>
      )}
    </span>
  );
}

function ResultTable({
  result,
  paging,
  onPage,
}: {
  result: ReteQueryResult;
  paging: boolean;
  onPage: (offset: number) => void;
}) {
  if (result.form === "ask") {
    return (
      <div className="sparql-ask-result" role="status">
        Risultato ASK: <strong>{result.value ? "true" : "false"}</strong>
      </div>
    );
  }

  const start = result.total === 0 ? 0 : result.offset + 1;
  const end = result.offset + result.rows.length;
  const canPrev = result.offset > 0;
  const canNext = result.offset + result.limit < result.total;

  return (
    <div className="sparql-results">
      <div className="sparql-results-toolbar">
        <p className="sparql-results-count">
          Risultati {start.toLocaleString("it")}–{end.toLocaleString("it")} di{" "}
          {result.total.toLocaleString("it")}
          {result.streaming ? " · pagine decodificate nel worker" : ""}
        </p>
        <div className="btn-group" role="group" aria-label="Paginazione risultati SPARQL">
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            disabled={!canPrev || paging}
            onClick={() => onPage(Math.max(0, result.offset - result.limit))}
          >
            Precedenti
          </button>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            disabled={!canNext || paging}
            onClick={() => onPage(result.offset + result.limit)}
          >
            Successivi
          </button>
        </div>
      </div>
      {paging && <p className="small text-secondary">Caricamento pagina…</p>}
      <div className="table-responsive">
        <table className="table table-striped align-middle sparql-table">
          <thead>
            <tr>
              {result.vars.map((variable) => (
                <th scope="col" key={variable}>
                  ?{variable}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, index) => (
              <tr key={`${result.offset}-${index}`}>
                {result.vars.map((variable) => (
                  <td key={variable}>
                    <TermValue term={row[variable]} />
                  </td>
                ))}
              </tr>
            ))}
            {result.rows.length === 0 && (
              <tr>
                <td colSpan={Math.max(1, result.vars.length)} className="text-center text-secondary">
                  Nessun risultato
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DatasetCard({
  dataset,
  manifestVersion,
  openInfo,
}: {
  dataset: ReteManifestDataset;
  manifestVersion: string;
  openInfo: ReteOpenResult | null;
}) {
  const href = `${import.meta.env.BASE_URL}${dataset.path}`;
  const hash = (openInfo?.contentHash || dataset.content_hash || "").slice(0, 12);
  return (
    <section className="sparql-dataset-card" aria-labelledby="sparql-dataset-title">
      <div className="sparql-dataset-card__main">
        <h2 id="sparql-dataset-title" className="h4">{dataset.title}</h2>
        <p>{dataset.description}</p>
        <dl className="sparql-dataset-facts">
          <div>
            <dt>Triple/quads</dt>
            <dd>{dataset.quads.toLocaleString("it")}</dd>
          </div>
          <div>
            <dt>File</dt>
            <dd>{formatBytes(dataset.size_bytes)}</dd>
          </div>
          <div>
            <dt>Hash</dt>
            <dd><code>{hash || "—"}</code></dd>
          </div>
          <div>
            <dt>rete-graph</dt>
            <dd>{manifestVersion}</dd>
          </div>
        </dl>
        <p className="small text-secondary mb-2">{dataset.license_note}</p>
      </div>
      <div className="sparql-dataset-card__actions">
        <a className="btn btn-outline-primary btn-sm" href={href} download>
          Scarica .rete
        </a>
      </div>
    </section>
  );
}

export function Sparql() {
  const [manifest, setManifest] = useState<ReteManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [datasetId, setDatasetId] = useState("");
  const [openInfo, setOpenInfo] = useState<ReteOpenResult | null>(null);
  const [queryText, setQueryText] = useState("");
  const [selectedExampleId, setSelectedExampleId] = useState("");
  const [result, setResult] = useState<ReteQueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [running, setRunning] = useState(false);
  const [paging, setPaging] = useState(false);
  const clientRef = useRef<ReteSparqlClient | null>(null);
  const runSeq = useRef(0);

  const dataset = useMemo(
    () => manifest?.datasets.find((item) => item.id === datasetId) ?? null,
    [manifest, datasetId],
  );
  const datasetUrl = dataset ? reteAssetUrl(dataset.file) : "";
  const examples = dataset?.examples ?? [];

  function client(): ReteSparqlClient {
    if (!clientRef.current) clientRef.current = new ReteSparqlClient();
    return clientRef.current;
  }

  function currentRun(id: number): boolean {
    return id === runSeq.current;
  }

  async function openAndRun(
    nextDataset: ReteManifestDataset,
    initialQuery: string,
  ): Promise<void> {
    const id = ++runSeq.current;
    const url = reteAssetUrl(nextDataset.file);
    setError(null);
    setResult(null);
    setOpenInfo(null);
    setOpening(true);
    setRunning(false);
    try {
      const info = await client().openDataset(url);
      if (!currentRun(id)) return;
      setOpenInfo(info);
      setOpening(false);
      setRunning(true);
      const firstResult = await client().query(url, initialQuery, 0, PAGE_SIZE);
      if (!currentRun(id)) return;
      setResult(firstResult);
    } catch (err) {
      if (!currentRun(id)) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!currentRun(id)) return;
      setOpening(false);
      setRunning(false);
    }
  }

  async function executeQuery(offset = 0): Promise<void> {
    if (!dataset || !queryText.trim()) return;
    const id = ++runSeq.current;
    setError(null);
    setRunning(true);
    if (offset === 0) setPaging(false);
    try {
      const nextResult = await client().query(
        datasetUrl,
        queryText,
        offset,
        PAGE_SIZE,
      );
      if (!currentRun(id)) return;
      setResult(nextResult);
    } catch (err) {
      if (!currentRun(id)) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!currentRun(id)) return;
      setRunning(false);
    }
  }

  async function loadPage(offset: number): Promise<void> {
    if (!dataset || !result) return;
    const id = ++runSeq.current;
    setError(null);
    setPaging(true);
    try {
      const nextResult = result.streaming && result.resultId
        ? await client().page(result.resultId, offset, PAGE_SIZE)
        : await client().query(datasetUrl, queryText, offset, PAGE_SIZE);
      if (!currentRun(id)) return;
      setResult(nextResult);
    } catch (err) {
      if (!currentRun(id)) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!currentRun(id)) return;
      setPaging(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchJson<ReteManifest>("rete/index.json")
      .then((doc) => {
        if (cancelled) return;
        setManifest(doc);
        setDatasetId(doc.datasets[0]?.id ?? "");
      })
      .catch((err) => {
        if (!cancelled) setManifestError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!dataset) return;
    const firstExample = (dataset.examples ?? [])[0];
    const initialQuery = firstExample?.sparql || "SELECT * WHERE { ?s ?p ?o } LIMIT 20";
    setSelectedExampleId(firstExample?.id || "");
    setQueryText(initialQuery);
    void openAndRun(dataset, initialQuery);
  }, [dataset?.id]);

  useEffect(() => {
    return () => {
      runSeq.current += 1;
      clientRef.current?.dispose();
      clientRef.current = null;
    };
  }, []);

  const stats = result?.stats ?? openInfo?.stats ?? null;
  const busy = opening || running;

  return (
    <div>
      <PageIntro raw={sparqlRaw} />

      {manifestError && (
        <div className="alert alert-danger" role="alert">
          Impossibile caricare il manifest rete: {manifestError}
        </div>
      )}
      {!manifest && !manifestError && <p>Caricamento dataset rete…</p>}

      {manifest && dataset && (
        <>
          <div className="alert alert-warning sparql-format-notice" role="note">
            {manifest.pre_release_notice}
          </div>

          <div className="sparql-controls">
            <div className="sparql-control">
              <label htmlFor="sparql-dataset" className="form-label fw-semibold">
                Dataset
              </label>
              <select
                id="sparql-dataset"
                className="form-select"
                value={datasetId}
                disabled={busy}
                onChange={(event) => {
                  runSeq.current += 1;
                  setDatasetId(event.target.value);
                }}
              >
                {manifest.datasets.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>
            {examples.length > 0 && (
              <div className="sparql-control sparql-control--wide">
                <label htmlFor="sparql-example" className="form-label fw-semibold">
                  Query di esempio
                </label>
                <select
                  id="sparql-example"
                  className="form-select"
                  value={selectedExampleId}
                  disabled={busy}
                  onChange={(event) => {
                    const example = examples.find((item) => item.id === event.target.value);
                    setSelectedExampleId(event.target.value);
                    if (example) setQueryText(example.sparql);
                  }}
                >
                  {examples.map((example) => (
                    <option value={example.id || example.title || example.sparql} key={example.id || example.sparql}>
                      {example.title || example.question || "Query senza titolo"}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {examples.find((example) => example.id === selectedExampleId)?.question && (
            <p className="sparql-example-question">
              {examples.find((example) => example.id === selectedExampleId)?.question}
            </p>
          )}

          <DatasetCard
            dataset={dataset}
            manifestVersion={manifest.rete_graph_version}
            openInfo={openInfo}
          />

          <section className="sparql-editor-section" aria-labelledby="sparql-editor-title">
            <div className="sparql-editor-head">
              <h2 id="sparql-editor-title" className="h4">Editor SPARQL</h2>
              {stats && (
                <p className="sparql-fetch-stats">
                  Scaricati {formatBytes(stats.bytes)} di {formatBytes(stats.fileLength)} ·{" "}
                  {stats.requests.toLocaleString("it")} richieste Range
                </p>
              )}
            </div>
            <label htmlFor="sparql-query" className="visually-hidden">
              Query SPARQL
            </label>
            <textarea
              id="sparql-query"
              className="form-control sparql-editor"
              value={queryText}
              disabled={busy}
              spellCheck={false}
              rows={16}
              onChange={(event) => setQueryText(event.target.value)}
            />
            <div className="sparql-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !queryText.trim()}
                onClick={() => void executeQuery(0)}
              >
                {running ? "Esecuzione…" : "Esegui query"}
              </button>
              {opening && <span className="small text-secondary">Apertura dataset e motore WASM…</span>}
              {!opening && running && <span className="small text-secondary">Query in esecuzione…</span>}
            </div>
          </section>

          {error && (
            <div className="alert alert-danger sparql-error" role="alert">
              {error}
            </div>
          )}

          {result && result.warnings.length > 0 && (
            <div className="alert alert-warning" role="alert">
              <h2 className="h5">Warning SPARQL</h2>
              <ul className="mb-0">
                {result.warnings.slice(0, 5).map((warning, index) => (
                  <li key={index}>{warning.message || warning.hint || JSON.stringify(warning)}</li>
                ))}
              </ul>
            </div>
          )}

          {result && (
            <section aria-labelledby="sparql-results-title">
              <h2 id="sparql-results-title" className="h4">Risultati</h2>
              <ResultTable result={result} paging={paging} onPage={(offset) => void loadPage(offset)} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
