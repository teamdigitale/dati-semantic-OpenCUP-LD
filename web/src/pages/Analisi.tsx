import { useEffect, useState } from "react";
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
import { ChartData, CountsData, ScopeData } from "../types";

export function Analisi() {
  const [byFunder, setByFunder] = useState<ChartData | null>(null);
  const [byCall, setByCall] = useState<ChartData | null>(null);
  const [byCupCig, setByCupCig] = useState<ChartData | null>(null);
  const [cupCigDist, setCupCigDist] = useState<ChartData | null>(null);
  const [bySettore, setBySettore] = useState<ChartData | null>(null);
  const [byTipologia, setByTipologia] = useState<ChartData | null>(null);
  const [counts, setCounts] = useState<CountsData | null>(null);
  const [scope, setScope] = useState<ScopeData | null>(null);

  useEffect(() => {
    Promise.all([
      fetchJson<ChartData>("analytics/cost_by_funder.json"),
      fetchJson<ChartData>("analytics/cost_by_call.json"),
      fetchJson<ChartData>("analytics/top_cup_cig.json"),
      fetchJson<ChartData>("analytics/cup_cig_distribution.json"),
      fetchJson<ChartData>("analytics/cups_by_settore.json"),
      fetchJson<ChartData>("analytics/cups_by_tipologia.json"),
      fetchJson<CountsData>("analytics/counts.json"),
      fetchJson<ScopeData>("analytics/scope.json"),
    ]).then(([f, c, cupCig, dist, settore, tipologia, n, s]) => {
      setByFunder(f);
      setByCall(c);
      setByCupCig(cupCig);
      setCupCigDist(dist);
      setBySettore(settore);
      setByTipologia(tipologia);
      setCounts(n);
      setScope(s);
    });
  }, []);

  const funderChart =
    byFunder?.labels.map((label, i) => ({
      name: label.length > 28 ? label.slice(0, 28) + "…" : label,
      value: byFunder.series[0]?.data[i] ?? 0,
    })) ?? [];

  const callChart =
    byCall?.labels.map((label, i) => ({
      name: label.length > 32 ? label.slice(0, 32) + "…" : label,
      value: byCall.series[0]?.data[i] ?? 0,
    })) ?? [];

  const cupCigChart =
    byCupCig?.labels.map((label, i) => ({
      name: label,
      value: byCupCig.series[0]?.data[i] ?? 0,
    })) ?? [];

  const cupCigDistChart =
    cupCigDist?.labels.map((label, i) => ({
      name: label,
      value: cupCigDist.series[0]?.data[i] ?? 0,
    })) ?? [];

  const settoreChart =
    bySettore?.labels.map((label, i) => ({
      name: label.length > 32 ? label.slice(0, 32) + "…" : label,
      value: bySettore.series[0]?.data[i] ?? 0,
    })) ?? [];

  const tipologiaChart =
    byTipologia?.labels.map((label, i) => ({
      name: label.length > 32 ? label.slice(0, 32) + "…" : label,
      value: byTipologia.series[0]?.data[i] ?? 0,
    })) ?? [];

  return (
    <div>
      <h1>Analisi</h1>
      <p className="lead">
        Statistiche SPARQL pre-calcolate sul grafo completo <code>all.ttl</code> (tutto lo scope
        PA Digitale collegato ad ANAC). I grafi separati mostrano invece un campione fisso di 10
        CUP condiviso tra tutte le fonti.
      </p>

      {scope && (
        <section className="info-box">
          <h2>{scope.title}</h2>
          <p>{scope.definition}</p>
          <div className="stat-grid">
            {scope.padigitale_raw_cups != null && (
              <div className="stat-card">
                <span className="stat-value">{scope.padigitale_raw_cups.toLocaleString("it")}</span>
                <span className="stat-label">CUP in PA Digitale (raw)</span>
              </div>
            )}
            {scope.hub_cups != null && (
              <div className="stat-card">
                <span className="stat-value">{scope.hub_cups}</span>
                <span className="stat-label">CUP nello scope collegato</span>
              </div>
            )}
            {scope.hub_cigs != null && (
              <div className="stat-card">
                <span className="stat-value">{scope.hub_cigs}</span>
                <span className="stat-label">CIG ANAC collegati</span>
              </div>
            )}
            {scope.scp_bandi_cigs != null && (
              <div className="stat-card">
                <span className="stat-value">{scope.scp_bandi_cigs}</span>
                <span className="stat-label">CIG con bando SCP</span>
              </div>
            )}
          </div>
          {scope.gaps && (
            <ul className="template-list">
              {scope.gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {counts && (
        <div className="stat-grid">
          <div className="stat-card">
            <span className="stat-value">{counts.cups}</span>
            <span className="stat-label">Progetti CUP (RDF)</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{counts.orgs}</span>
            <span className="stat-label">Organizzazioni</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{counts.lots}</span>
            <span className="stat-label">Lotti CIG</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{counts.triples.toLocaleString("it")}</span>
            <span className="stat-label">Triple RDF</span>
          </div>
        </div>
      )}

      <section className="chart-section">
        <h2>{bySettore?.title}</h2>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={settoreChart} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#94a3b8" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="chart-section">
        <h2>{byTipologia?.title}</h2>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={tipologiaChart} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#64748b" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="chart-section">
        <h2>{cupCigDist?.title}</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={cupCigDistChart}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="#d97706" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="chart-section">
        <h2>{byCupCig?.title}</h2>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={cupCigChart} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#d97706" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="chart-section">
        <h2>{byFunder?.title}</h2>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={funderChart} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k €`} />
            <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `${v.toLocaleString("it")} €`} />
            <Bar dataKey="value" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="chart-section">
        <h2>{byCall?.title}</h2>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={callChart} margin={{ bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => `${v.toLocaleString("it")} €`} />
            <Bar dataKey="value" fill="#059669" />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
