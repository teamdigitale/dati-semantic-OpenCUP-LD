import { useEffect, useState } from "react";
import { fetchJson } from "../api";
import { MappingsData } from "../types";
import { DATASET_LABELS } from "../constants";
import { RdfMappingText } from "../components/ResourceLink";
import { PageIntro } from "../components/PageIntro";
import mappatureRaw from "../../content/mappature.md?raw";

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
      <PageIntro raw={mappatureRaw} />

      <section className="mb-5">
        <h2>Template e convertitori</h2>
        <ul className="list-group list-group-flush border rounded">
          {data.templates.map((t) => (
            <li className="list-group-item" key={t.file}>
              <code>{t.file}</code>
              <span className="text-secondary"> → {t.dataset}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-5">
        <h2>Join semantici (automatici)</h2>
        <div className="row g-3">
          {data.semanticJoins.map((j) => (
            <div className="col-12 col-md-6" key={j.id}>
              <div className="card-wrapper card-space h-100">
                <div className="card card-bg h-100">
                  <div className="card-body">
                    <h3 className="h5 card-title">{j.label}</h3>
                    <p>
                      <RdfMappingText value={j.uri} />
                    </p>
                    <p className="text-success fw-semibold">
                      {j.datasets.map((d) => DATASET_LABELS[d] ?? d).join(" ↔ ")}
                    </p>
                    <p className="card-text mb-0">{j.note}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Campi → proprietà RDF</h2>
        <div className="mb-3">
          <label className="form-label" htmlFor="datasetFilter">
            Dataset
          </label>
          <select
            id="datasetFilter"
            className="form-select w-auto"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Tutti</option>
            {Array.from(new Set(data.fieldMappings.map((r) => r[3]))).map((k) => (
              <option key={k} value={k}>
                {DATASET_LABELS[k] ?? k}
              </option>
            ))}
          </select>
        </div>
        <div className="table-responsive">
          <table className="table table-striped table-hover table-bordered">
            <thead>
              <tr>
                <th scope="col">Campo sorgente</th>
                <th scope="col">Proprietà RDF</th>
                <th scope="col">Ruolo</th>
                <th scope="col">Dataset</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    <code>{r[0]}</code>
                  </td>
                  <td>
                    <RdfMappingText value={r[1]} />
                  </td>
                  <td>{r[2]}</td>
                  <td>{DATASET_LABELS[r[3]] ?? r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
