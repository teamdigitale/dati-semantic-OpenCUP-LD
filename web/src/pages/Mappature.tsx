import { useEffect, useState } from "react";
import { fetchJson } from "../api";
import { MappingsData } from "../types";
import { DATASET_LABELS } from "../constants";
import { RdfMappingText } from "../components/ResourceLink";
import { PageIntro } from "../components/PageIntro";
import { parseMarkdown } from "../content/load";
import { site } from "../content/site";
import mappatureRaw from "../../content/mappature.md?raw";

const mappatureMeta = parseMarkdown(mappatureRaw).data;

export function Mappature() {
  const [data, setData] = useState<MappingsData | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchJson<MappingsData>("mappings.json").then(setData);
  }, []);

  if (!data) return <p>{site.loading.default}</p>;

  const headers = (mappatureMeta.table_headers ?? {}) as Record<string, string>;

  const rows =
    filter === "all"
      ? data.fieldMappings
      : data.fieldMappings.filter((r) => r[3] === filter);

  return (
    <div>
      <PageIntro raw={mappatureRaw} includeBody={false} />

      <section className="mb-5">
        <h2>{String(mappatureMeta.joins_heading ?? "")}</h2>
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
        <h2>{String(mappatureMeta.table_heading ?? "")}</h2>
        <div className="mb-3">
          <label className="form-label" htmlFor="datasetFilter">
            {String(mappatureMeta.filter_label ?? "")}
          </label>
          <select
            id="datasetFilter"
            className="form-select w-auto"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">{String(mappatureMeta.filter_all ?? "")}</option>
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
                <th scope="col">{headers.campo}</th>
                <th scope="col">{headers.proprieta}</th>
                <th scope="col">{headers.ruolo}</th>
                <th scope="col">{headers.dataset}</th>
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
