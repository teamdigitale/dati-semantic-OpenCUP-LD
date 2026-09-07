import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
import { PageIntro } from "../components/PageIntro";
import { ContentMarkdown } from "../components/ContentMarkdown";
import { parseYaml } from "../content/load";
import analisiRaw from "../../content/analisi.md?raw";
import insightsRaw from "../../content/analisi.insights.yml?raw";

const insights = parseYaml<Record<string, string>>(insightsRaw);

const BI = {
  primary: "#0066cc",
  analogue1: "#008758",
  analogue2: "#a66300",
  neutral: "#5b6f82",
  neutralLight: "#8a9ba8",
};

interface ChartPoint {
  name: string;
  fullLabel: string;
  value: number;
}

interface SubgraphIndex {
  sample_cups: string[];
  default_cup: string | null;
}

function toChartPoint(label: string, value: number, maxAxisLen?: number): ChartPoint {
  const name =
    maxAxisLen != null && label.length > maxAxisLen
      ? `${label.slice(0, maxAxisLen)}…`
      : label;
  return { name, fullLabel: label, value };
}

function AnalisiTooltip({
  active,
  payload,
  valueFormatter,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint; value: number }>;
  valueFormatter?: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const value = payload[0].value;
  return (
    <div className="analisi-chart-tooltip">
      <p className="analisi-chart-tooltip-label">{row.fullLabel}</p>
      <p className="analisi-chart-tooltip-value">
        {valueFormatter ? valueFormatter(value) : value.toLocaleString("it")}
      </p>
    </div>
  );
}

function Insight({ children }: { children: React.ReactNode }) {
  if (typeof children === "string") {
    return (
      <div className="text-secondary mb-3">
        <ContentMarkdown source={children} />
      </div>
    );
  }
  return <p className="text-secondary mb-3">{children}</p>;
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="col-6 col-md-3">
      <div className="card-wrapper card-space h-100">
        <div className="card card-bg h-100">
          <div className="card-body text-center">
            <p className="h3 text-primary mb-1">{value}</p>
            <p className="mb-0 small">{label}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EuroAxisTick(v: number) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(0)}B €`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M €`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}k €`;
  return `${v} €`;
}

function ChartSection({
  title,
  insight,
  data,
  color,
  layout = "vertical",
  yWidth = 160,
  euro = false,
  height,
}: {
  title?: string;
  insight: React.ReactNode;
  data: ChartPoint[];
  color: string;
  layout?: "vertical" | "horizontal";
  yWidth?: number;
  euro?: boolean;
  height?: number;
}) {
  if (!title || data.length === 0) return null;
  const chartHeight =
    height ??
    (layout === "vertical" ? Math.max(360, data.length * 28) : 300);
  const tip = euro ? (
    <AnalisiTooltip valueFormatter={(v) => `${v.toLocaleString("it")} €`} />
  ) : (
    <AnalisiTooltip />
  );
  return (
    <section className="chart-section">
      <h2>{title}</h2>
      <Insight>{insight}</Insight>
      <ResponsiveContainer width="100%" height={chartHeight}>
        {layout === "vertical" ? (
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              allowDecimals={false}
              tickFormatter={euro ? EuroAxisTick : undefined}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={yWidth}
              tick={{ fontSize: 10 }}
              interval={0}
            />
            <Tooltip content={tip} />
            <Bar dataKey="value" fill={color} />
          </BarChart>
        ) : (
          <BarChart data={data} margin={{ bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
            <YAxis
              allowDecimals={false}
              tickFormatter={euro ? EuroAxisTick : undefined}
            />
            <Tooltip content={tip} />
            <Bar dataKey="value" fill={color} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </section>
  );
}

export function Analisi() {
  const [byFunder, setByFunder] = useState<ChartData | null>(null);
  const [byCall, setByCall] = useState<ChartData | null>(null);
  const [byCupCig, setByCupCig] = useState<ChartData | null>(null);
  const [cupCigDist, setCupCigDist] = useState<ChartData | null>(null);
  const [bySettore, setBySettore] = useState<ChartData | null>(null);
  const [byCategoria, setByCategoria] = useState<ChartData | null>(null);
  const [byRegione, setByRegione] = useState<ChartData | null>(null);
  const [byStato, setByStato] = useState<ChartData | null>(null);
  const [padRegione, setPadRegione] = useState<ChartData | null>(null);
  const [padComuni, setPadComuni] = useState<ChartData | null>(null);
  const [scpAwards, setScpAwards] = useState<ChartData | null>(null);
  const [scpAwardsEuro, setScpAwardsEuro] = useState<ChartData | null>(null);
  const [counts, setCounts] = useState<CountsData | null>(null);
  const [scope, setScope] = useState<ScopeData | null>(null);
  const [sampleCups, setSampleCups] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      fetchJson<ChartData>("analytics/cost_by_funder.json"),
      fetchJson<ChartData>("analytics/cost_by_call.json"),
      fetchJson<ChartData>("analytics/top_cup_cig.json"),
      fetchJson<ChartData>("analytics/cup_cig_distribution.json"),
      fetchJson<ChartData>("analytics/cups_by_settore.json"),
      fetchJson<ChartData>("analytics/cups_by_categoria.json"),
      fetchJson<ChartData>("analytics/cups_by_regione.json"),
      fetchJson<ChartData>("analytics/opencup_by_stato.json"),
      fetchJson<ChartData>("analytics/pad_cost_by_regione.json"),
      fetchJson<ChartData>("analytics/pad_top_comuni.json"),
      fetchJson<ChartData>("analytics/scp_top_aggiudicatari.json"),
      fetchJson<ChartData>("analytics/scp_top_aggiudicatari_euro.json"),
      fetchJson<CountsData>("analytics/counts.json"),
      fetchJson<ScopeData>("analytics/scope.json"),
      fetchJson<SubgraphIndex>("subgraphs/index.json"),
    ]).then(
      ([
        f,
        c,
        cupCig,
        dist,
        settore,
        categoria,
        regione,
        stato,
        padR,
        padC,
        scp,
        scpEuro,
        n,
        s,
        idx,
      ]) => {
        setByFunder(f);
        setByCall(c);
        setByCupCig(cupCig);
        setCupCigDist(dist);
        setBySettore(settore);
        setByCategoria(categoria);
        setByRegione(regione);
        setByStato(stato);
        setPadRegione(padR);
        setPadComuni(padC);
        setScpAwards(scp);
        setScpAwardsEuro(scpEuro);
        setCounts(n);
        setScope(s);
        setSampleCups(idx.sample_cups ?? []);
      }
    );
  }, []);

  const mapChart = (chart: ChartData | null, maxLen?: number) =>
    chart?.labels.map((label, i) =>
      toChartPoint(label, chart.series[0]?.data[i] ?? 0, maxLen)
    ) ?? [];

  const funderChart = mapChart(byFunder, 28);
  const callChart = mapChart(byCall, 32);
  const cupCigChart = mapChart(byCupCig);
  const cupCigDistChart = mapChart(cupCigDist);
  const settoreChart = mapChart(bySettore, 32);
  const categoriaChart = mapChart(byCategoria, 32);
  const regioneChart = mapChart(byRegione, 28);
  const statoChart = mapChart(byStato, 24);
  const padRegioneChart = mapChart(padRegione, 28);
  const padComuniChart = mapChart(padComuni, 28);
  const scpAwardsChart = mapChart(scpAwards, 28);
  const scpAwardsEuroChart = mapChart(scpAwardsEuro, 28);

  return (
    <div>
      <PageIntro raw={analisiRaw} />

      {scope && (
        <section className="mb-5">
          <h2>{scope.title}</h2>
          <p>{scope.definition}</p>

          <h3 className="h5 mt-4">Basi complete (quanto)</h3>
          <div className="row g-3 mb-3">
            {scope.opencup_cups != null && (
              <StatCard
                value={scope.opencup_cups.toLocaleString("it")}
                label="CUP OpenCUP"
              />
            )}
            {scope.anac_cigs != null && (
              <StatCard
                value={scope.anac_cigs.toLocaleString("it")}
                label="CIG ANAC"
              />
            )}
            {scope.padigitale_raw_cups != null && (
              <StatCard
                value={scope.padigitale_raw_cups.toLocaleString("it")}
                label="CUP PA Digitale"
              />
            )}
            {scope.enti_ipa != null && (
              <StatCard
                value={scope.enti_ipa.toLocaleString("it")}
                label="Enti IndicePA"
              />
            )}
          </div>

          <h3 className="h5 mt-4">Hub interop (dove nasce il grafo)</h3>
          <Insight>
            Solo ~{scope.hub_cups?.toLocaleString("it") ?? "…"} CUP sono nello
            scope in cui PA Digitale, ANAC ed esiti SCP si incontrano. Da lì
            deriva il RDF hub. Le visualizzazioni a grafo usano un campione di
            CUP leggibile, non le basi nazionali intere.
          </Insight>
          <div className="row g-3">
            {scope.hub_cups != null && (
              <StatCard
                value={scope.hub_cups.toLocaleString("it")}
                label="CUP hub"
              />
            )}
            {scope.hub_cigs != null && (
              <StatCard
                value={scope.hub_cigs.toLocaleString("it")}
                label="CIG hub"
              />
            )}
            {counts && (
              <StatCard
                value={counts.triples.toLocaleString("it")}
                label="Triple RDF (hub)"
              />
            )}
            {sampleCups.length > 0 && (
              <StatCard value={String(sampleCups.length)} label="CUP nel grafo UI" />
            )}
          </div>
        </section>
      )}

      <section className="mb-5">
        <h2>Dal numero al grafo</h2>
        <p>
          Questi CUP sono tra i più ricchi nell&apos;unione semantica. Aprili
          nell&apos;unione per vedere relazioni che una classifica non mostra.
        </p>
        <div className="row g-3">
          {sampleCups.map((cup) => (
            <div className="col-12 col-md-6" key={cup}>
              <div className="card-wrapper card-space h-100">
                <div className="card card-bg h-100">
                  <div className="card-body">
                    <h3 className="h5 card-title">
                      <code>{cup}</code>
                    </h3>
                    <p className="card-text">
                      Stesso URI in OpenCUP e PA Digitale; lotti CIG,
                      classificazione, ponte IndicePA.
                    </p>
                    <div className="d-flex flex-wrap gap-2">
                      <Link
                        className="btn btn-primary btn-sm"
                        to={`/unione?cup=${cup}`}
                      >
                        Unione semantica
                      </Link>
                      <Link
                        className="btn btn-outline-primary btn-sm"
                        to={`/unione/animazione?cup=${cup}`}
                      >
                        Unione animata
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <ChartSection
        title={byStato?.title}
        insight={insights.opencup_by_stato}
        data={statoChart}
        color={BI.analogue1}
        layout="horizontal"
        height={280}
      />

      <ChartSection
        title={byRegione?.title}
        insight={insights.cups_by_regione}
        data={regioneChart}
        color={BI.primary}
        yWidth={140}
      />

      <ChartSection
        title={padRegione?.title}
        insight={insights.pad_cost_by_regione}
        data={padRegioneChart}
        color={BI.analogue1}
        euro
        yWidth={140}
      />

      <ChartSection
        title={padComuni?.title}
        insight={insights.pad_top_comuni}
        data={padComuniChart}
        color={BI.analogue1}
        euro
        yWidth={140}
      />

      <ChartSection
        title={scpAwards?.title}
        insight={insights.scp_top_aggiudicatari}
        data={scpAwardsChart}
        color={BI.analogue2}
        yWidth={170}
      />

      <ChartSection
        title={scpAwardsEuro?.title}
        insight={insights.scp_top_aggiudicatari_euro}
        data={scpAwardsEuroChart}
        color={BI.analogue2}
        euro
        yWidth={170}
      />

      <ChartSection
        title={bySettore?.title}
        insight={insights.cups_by_settore}
        data={settoreChart}
        color={BI.neutralLight}
        yWidth={180}
      />

      <ChartSection
        title={byCategoria?.title}
        insight={insights.cups_by_categoria}
        data={categoriaChart}
        color={BI.neutral}
        yWidth={180}
      />

      <ChartSection
        title={cupCigDist?.title}
        insight={insights.cup_cig_distribution}
        data={cupCigDistChart}
        color={BI.analogue2}
        layout="horizontal"
        height={300}
      />

      <ChartSection
        title={byCupCig?.title}
        insight={insights.top_cup_cig}
        data={cupCigChart}
        color={BI.analogue2}
        yWidth={120}
      />

      <ChartSection
        title={byFunder?.title}
        insight={insights.cost_by_funder}
        data={funderChart}
        color={BI.primary}
        euro
        yWidth={160}
      />

      <ChartSection
        title={byCall?.title}
        insight={insights.cost_by_call}
        data={callChart}
        color={BI.analogue1}
        euro
        yWidth={200}
      />

      {scope?.gaps && (
        <section className="mt-4">
          <h2 className="h5">Note e lacune</h2>
          <ul>
            {scope.gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
