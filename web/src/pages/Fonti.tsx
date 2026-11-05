import { useEffect, useState } from "react";
import { fetchJson } from "../api";

interface SourceRow {
  id: string;
  title: string;
  publisher: string;
  url: string;
  license: string;
  graph_keys: string[];
  role: string;
  pipeline: string;
  note?: string;
  present?: boolean;
  updated_at?: string | null;
  bytes?: number | null;
  local?: string;
}

interface SourcesDoc {
  generated_at: string;
  manifest_generated_at?: string | null;
  sources: SourceRow[];
  counts: Record<string, number>;
}

interface EnrichmentDoc {
  generated_at: string;
  seed: {
    n_cups: number;
    n_cigs: number;
    n_our_cup_cig_pairs: number;
    by: Record<string, number>;
  };
  ondata_pnrr_cup_cig?: {
    present?: boolean;
    n_pairs_seed?: number;
    n_cups_hit?: number;
    n_new_pairs_vs_cup_cig_parquet?: number;
    n_italiadomani_only_new?: number;
    by_fonte?: Record<string, number>;
  };
  openpnrr_bandi?: {
    present?: boolean;
    n_cigs_seed_hit?: number;
    n_cigs_total_file?: number;
    flag_quota_counts?: Record<string, number>;
    misure_premiali_counts?: Record<string, number>;
  };
  istat_comuni?: {
    present?: boolean;
    n_comuni?: number;
  };
  highlights: string[];
}

const ROLE_LABEL: Record<string, string> = {
  in_use: "In uso",
  optional: "Opzionale",
  candidate: "Candidata",
  reference: "Riferimento",
};

function formatBytes(n?: number | null): string {
  if (n == null || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "n.d.";
  try {
    return new Date(iso).toLocaleString("it-IT", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Rome",
    });
  } catch {
    return iso;
  }
}

export function Fonti() {
  const [doc, setDoc] = useState<SourcesDoc | null>(null);
  const [enrich, setEnrich] = useState<EnrichmentDoc | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<SourcesDoc>("sources.json")
      .then(setDoc)
      .catch((e) => setErr(String(e)));
    fetchJson<EnrichmentDoc>("analytics/discovered_enrichment.json")
      .then(setEnrich)
      .catch(() => undefined);
  }, []);

  return (
    <div>
      <h1>Fonti dati</h1>
      <p className="lead">
        Per ogni dataset: editore, licenza, chiavi di join sul grafo, se il file
        raw/parquet è presente in pipeline e <strong>quando è stato aggiornato</strong>{" "}
        (mtime del file locale o MANIFEST dopo <code>convert-parquet</code>).
      </p>
      <p className="text-secondary small">
        Si privilegiano sempre i dump <em>raw</em> ufficiali; il Parquet è un
        derivato per le join. Catalogo discovery: candidati da dati.gov.it,
        ISTAT, Openpolis, onData, TED, OCDS — senza sostituire le fonti
        primarie.
      </p>

      {err && <p className="text-danger">Impossibile caricare sources.json: {err}</p>}
      {!doc && !err && <p>Caricamento catalogo fonti…</p>}

      {enrich && enrich.highlights?.length > 0 && (
        <section className="mb-4">
          <h2 className="h4">Risultati enrichment (seed hub)</h2>
          <p className="small text-secondary mb-2">
            Slice generato {formatDate(enrich.generated_at)} · seed{" "}
            {enrich.seed.n_cups} CUP · {enrich.seed.n_cigs} CIG ·{" "}
            {enrich.seed.n_our_cup_cig_pairs} coppie in cup_cig.parquet
          </p>
          <ul className="mb-3">
            {enrich.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <div className="row g-3">
            {enrich.ondata_pnrr_cup_cig?.present && (
              <div className="col-12 col-md-4">
                <div className="border rounded p-3 h-100">
                  <h3 className="h6">onData PNRR CUP↔CIG</h3>
                  <p className="mb-1 small">
                    {enrich.ondata_pnrr_cup_cig.n_pairs_seed} coppie sui seed (
                    {enrich.ondata_pnrr_cup_cig.n_cups_hit} CUP)
                  </p>
                  <p className="mb-1 small">
                    Nuove vs parquet:{" "}
                    {enrich.ondata_pnrr_cup_cig.n_new_pairs_vs_cup_cig_parquet} ·
                    solo Italia Domani:{" "}
                    {enrich.ondata_pnrr_cup_cig.n_italiadomani_only_new}
                  </p>
                  {enrich.ondata_pnrr_cup_cig.by_fonte && (
                    <p className="mb-0 small text-secondary">
                      Fonti:{" "}
                      {Object.entries(enrich.ondata_pnrr_cup_cig.by_fonte)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(", ")}
                    </p>
                  )}
                </div>
              </div>
            )}
            {enrich.openpnrr_bandi?.present && (
              <div className="col-12 col-md-4">
                <div className="border rounded p-3 h-100">
                  <h3 className="h6">OpenPNRR bandi</h3>
                  <p className="mb-1 small">
                    {enrich.openpnrr_bandi.n_cigs_seed_hit} CIG hub su{" "}
                    {enrich.openpnrr_bandi.n_cigs_total_file} CIG PNRR nel file
                  </p>
                  {enrich.openpnrr_bandi.flag_quota_counts && (
                    <p className="mb-1 small text-secondary">
                      Flag quota:{" "}
                      {Object.entries(enrich.openpnrr_bandi.flag_quota_counts)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(", ")}
                    </p>
                  )}
                  {enrich.openpnrr_bandi.misure_premiali_counts && (
                    <p className="mb-0 small text-secondary">
                      Misure premiali:{" "}
                      {Object.entries(enrich.openpnrr_bandi.misure_premiali_counts)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(", ")}
                    </p>
                  )}
                </div>
              </div>
            )}
            {enrich.istat_comuni?.present && (
              <div className="col-12 col-md-4">
                <div className="border rounded p-3 h-100">
                  <h3 className="h6">ISTAT comuni</h3>
                  <p className="mb-0 small">
                    {enrich.istat_comuni.n_comuni} comuni — anagrafica pronta
                    per normalizzazione territorio
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {doc && (
        <>
          <p className="small text-secondary">
            Catalogo generato: {formatDate(doc.generated_at)}
            {doc.manifest_generated_at
              ? ` · MANIFEST parquet: ${formatDate(doc.manifest_generated_at)}`
              : ""}
            {" · "}
            in uso {doc.counts.in_use} · opzionali {doc.counts.optional} ·
            candidate {doc.counts.candidate} · presenti in disco{" "}
            {doc.counts.present}
          </p>

          <div className="table-responsive">
            <table className="table table-striped align-middle">
              <thead>
                <tr>
                  <th scope="col">Dataset</th>
                  <th scope="col">Ruolo</th>
                  <th scope="col">Aggiornato</th>
                  <th scope="col">Size</th>
                  <th scope="col">Chiavi grafo</th>
                  <th scope="col">Locale</th>
                </tr>
              </thead>
              <tbody>
                {doc.sources.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="fw-semibold">
                        <a href={s.url} target="_blank" rel="noopener noreferrer">
                          {s.title}
                        </a>
                      </div>
                      <div className="small text-secondary">
                        {s.publisher}
                        {s.license ? ` · ${s.license}` : ""}
                      </div>
                      {s.note ? (
                        <div className="small mt-1">{s.note}</div>
                      ) : null}
                      <div className="small text-secondary mt-1">{s.pipeline}</div>
                    </td>
                    <td>
                      <span className="badge bg-primary">{ROLE_LABEL[s.role] ?? s.role}</span>
                      {s.present ? (
                        <div className="small text-success mt-1">presente</div>
                      ) : (
                        <div className="small text-secondary mt-1">assente</div>
                      )}
                    </td>
                    <td className="small text-nowrap">{formatDate(s.updated_at)}</td>
                    <td className="small">{formatBytes(s.bytes)}</td>
                    <td className="small">
                      {(s.graph_keys || []).map((k) => (
                        <code key={k} className="me-1">
                          {k}
                        </code>
                      ))}
                    </td>
                    <td className="small">
                      <code>{s.local || "—"}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
