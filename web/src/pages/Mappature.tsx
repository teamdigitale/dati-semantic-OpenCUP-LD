import { useEffect, useState } from "react";
import { fetchJson } from "../api";
import { MappingsData } from "../types";
import { DATASET_LABELS } from "../constants";
import { RdfMappingText } from "../components/ResourceLink";

export function Mappature() {
  const [data, setData] = useState<MappingsData | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchJson<MappingsData>("mappings.json").then(setData);
  }, []);

  if (!data) return <p>Caricamento…</p>;

  const rows =
    filter === "all"
      ? data.fieldMappings
      : data.fieldMappings.filter((r) => r[3] === filter);

  return (
    <div>
      <h1>Mappature</h1>
      <p className="lead">
        Trasformazione dai campi tabellari alle proprietà dell&apos;ontologia PublicInvestment.
      </p>

      <section>
        <h2>Template Handlebars</h2>
        <ul className="template-list">
          {data.templates.map((t) => (
            <li key={t.file}>
              <code>{t.file}</code> → {t.dataset}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Join semantici (automatici)</h2>
        <div className="join-grid">
          {data.semanticJoins.map((j) => (
            <div key={j.id} className="join-card">
              <h3>{j.label}</h3>
              <p>
                <RdfMappingText value={j.uri} />
              </p>
              <p className="datasets">
                {j.datasets.map((d) => DATASET_LABELS[d] ?? d).join(" ↔ ")}
              </p>
              <p>{j.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Campi → proprietà RDF</h2>
        <div className="filter-bar">
          <label>
            Dataset:{" "}
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Tutti</option>
              {Object.entries(DATASET_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Campo sorgente</th>
              <th>Proprietà RDF</th>
              <th>Ruolo</th>
              <th>Dataset</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td><code>{r[0]}</code></td>
                <td><RdfMappingText value={r[1]} /></td>
                <td>{r[2]}</td>
                <td>{DATASET_LABELS[r[3]] ?? r[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
