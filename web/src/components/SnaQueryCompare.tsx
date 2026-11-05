import { useEffect, useId, useState } from "react";
import { SnaQueriesDoc, SnaQueryCard, SnaQueryResults } from "../types";

function QueryBlock({
  title,
  block,
}: {
  title: string;
  block: { text: string; note?: string; graph?: string; dialect?: string } | null;
}) {
  if (!block) return null;
  return (
    <div className="sna-query-col">
      <div className="sna-query-col__head">
        <span className="sna-query-col__title">{title}</span>
        {block.graph ? (
          <span className="sna-query-col__meta">{block.graph}</span>
        ) : null}
        {block.dialect ? (
          <span className="sna-query-col__meta">{block.dialect}</span>
        ) : null}
      </div>
      <pre className="sna-query-code">
        <code>{block.text}</code>
      </pre>
      {block.note ? <p className="sna-query-note">{block.note}</p> : null}
    </div>
  );
}

function ResultsTable({
  title,
  results,
}: {
  title: string;
  results: SnaQueryResults | undefined;
}) {
  if (!results?.columns?.length) return null;
  return (
    <div className="sna-query-results">
      <h4 className="h6">{title}</h4>
      <div className="table-responsive">
        <table className="table table-sm table-striped align-middle mb-0">
          <thead>
            <tr>
              {results.columns.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="small">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SnaQueryCompare({ doc }: { doc: SnaQueriesDoc }) {
  const collapseId = useId().replace(/:/g, "");
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(doc.queries[0]?.id ?? "");

  useEffect(() => {
    setActiveId(doc.queries[0]?.id ?? "");
    setOpen(false);
  }, [doc]);

  const card: SnaQueryCard | undefined =
    doc.queries.find((q) => q.id === activeId) ?? doc.queries[0];

  if (!card) return null;

  return (
    <section className="sna-query-panel mb-4" aria-labelledby="sna-query-heading">
      <button
        type="button"
        className="sna-query-toggle"
        aria-expanded={open}
        aria-controls={`sna-query-body-${collapseId}`}
        id="sna-query-heading"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sna-query-toggle__title">
          Come si chiede al grafo (SQL ↔ SPARQL)
        </span>
        <span className="sna-query-toggle__hint">
          {open ? "chiudi" : "apri — sotto la visualizzazione"}
        </span>
      </button>

      <div
        id={`sna-query-body-${collapseId}`}
        className={`collapse${open ? " show" : ""}`}
        role="region"
        aria-labelledby="sna-query-heading"
      >
        <div className="sna-query-panel__body">
          <p className="text-secondary small mb-3">{doc.note}</p>

          <div
            className="sna-chip-row mb-3"
            role="tablist"
            aria-label="Domande di esempio"
          >
            {doc.queries.map((q) => (
              <button
                key={q.id}
                type="button"
                role="tab"
                aria-selected={q.id === card.id}
                className={`sna-chip${q.id === card.id ? " is-active" : ""}`}
                onClick={() => setActiveId(q.id)}
              >
                {q.title}
              </button>
            ))}
          </div>

          <p className="sna-query-intent">{card.intent}</p>

          <div className="sna-query-grid">
            <QueryBlock title="SQL (relazionale)" block={card.sql} />
            <QueryBlock title="SPARQL (rete SNA)" block={card.sparql_sna} />
            <QueryBlock title="SPARQL (Linked Data)" block={card.sparql_ld} />
          </div>

          <ResultsTable title="Risultati (rete SNA)" results={card.results} />
          <ResultsTable
            title="Risultati (Linked Data)"
            results={card.results_ld}
          />
        </div>
      </div>
    </section>
  );
}
