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
import { ChartData, ScopeData } from "../types";
import { PageIntro } from "../components/PageIntro";
import { ContentMarkdown } from "../components/ContentMarkdown";
import { RegioneCupMap } from "../components/RegioneCupMap";
import { parseMarkdown, parseYaml, splitSections } from "../content/load";
import analisiRaw from "../../content/analisi.md?raw";
import insightsRaw from "../../content/analisi.insights.yml?raw";
import gapsRaw from "../../content/analisi.gaps.yml?raw";
import analisiUiRaw from "../../content/analisi.ui.yml?raw";
import {
  cupsPer100k,
  cupsPerPilMld,
  normalizeRegion,
  pilMlnEuro,
  RegioneIndicatori,
} from "../utils/regions";

const insights = parseYaml<Record<string, string>>(insightsRaw);
const gapsDoc = parseYaml<{ title: string; items: string[] }>(gapsRaw);
const analisiUi = parseYaml<{
  anchors_aria: string;
  anchors: { href: string; label: string }[];
  stats: {
    opencup: string;
    anac: string;
    padigitale: string;
    enti_ipa: string;
  };
  sample_card: {
    body: string;
    link_unione: string;
    link_animazione: string;
  };
  charts: {
    per_100k: string;
    per_pil: string;
    map: string;
  };
}>(analisiUiRaw);
const analisiSections = splitSections(parseMarkdown(analisiRaw).content);

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
  detail?: string;
  value: number;
}

interface SubgraphIndex {
  sample_cups: string[];
  default_cup: string | null;
}

function toChartPoint(
  label: string,
  value: number,
  maxAxisLen?: number,
  detail?: string
): ChartPoint {
  const name =
    maxAxisLen != null && label.length > maxAxisLen
      ? `${label.slice(0, maxAxisLen)}…`
      : label;
  return { name, fullLabel: label, detail, value };
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
      {row.detail ? (
        <p className="analisi-chart-tooltip-detail">{row.detail}</p>
      ) : null}
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

function CompactAxisTick(v: number) {
  const n = (x: number, d: number) => x.toFixed(d).replace(".", ",");
  if (Math.abs(v) >= 1e9) return `${n(v / 1e9, v >= 1e10 ? 0 : 1)}B`;
  if (Math.abs(v) >= 1e6) return `${n(v / 1e6, v >= 1e7 ? 0 : 1)}M`;
  if (Math.abs(v) >= 1e3) return `${n(v / 1e3, 0)}k`;
  return String(Math.round(v));
}

function EuroAxisTick(v: number) {
  return `${CompactAxisTick(v)} €`;
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
  valueDecimals = false,
}: {
  title?: string;
  insight: React.ReactNode;
  data: ChartPoint[];
  color: string;
  layout?: "vertical" | "horizontal";
  yWidth?: number;
  euro?: boolean;
  height?: number;
  valueDecimals?: boolean;
}) {
  if (!title || data.length === 0) return null;
  const chartHeight =
    height ??
    (layout === "vertical" ? Math.max(360, data.length * 28) : 300);
  const axisFmt = euro ? EuroAxisTick : CompactAxisTick;
  const tip = euro ? (
    <AnalisiTooltip valueFormatter={(v) => `${v.toLocaleString("it")} €`} />
  ) : (
    <AnalisiTooltip
      valueFormatter={(v) =>
        v.toLocaleString("it", {
          maximumFractionDigits: valueDecimals ? 1 : 0,
        })
      }
    />
  );
  return (
    <section className="chart-section">
      <h2>{title}</h2>
      <Insight>{insight}</Insight>
      <ResponsiveContainer width="100%" height={chartHeight}>
        {layout === "vertical" ? (
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 12, right: 24, top: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              allowDecimals={valueDecimals}
              tickFormatter={axisFmt}
              tick={{ fontSize: 12, fill: "#5b6f82" }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={yWidth}
              tick={{ fontSize: 12, fill: "#17324d" }}
              interval={0}
            />
            <Tooltip content={tip} />
            <Bar dataKey="value" fill={color} />
          </BarChart>
        ) : (
          <BarChart
            data={data}
            margin={{ left: 56, right: 16, top: 8, bottom: 48 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: "#17324d" }}
              interval={0}
            />
            <YAxis
              allowDecimals={valueDecimals}
              width={52}
              tickFormatter={axisFmt}
              tick={{ fontSize: 12, fill: "#5b6f82" }}
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
  const [privCat, setPrivCat] = useState<ChartData | null>(null);
  const [scope, setScope] = useState<ScopeData | null>(null);
  const [sampleCups, setSampleCups] = useState<string[]>([]);
  const [regionInd, setRegionInd] = useState<RegioneIndicatori | null>(null);

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
      fetchJson<ChartData>("analytics/soggetto_privato_by_categoria.json"),
      fetchJson<ScopeData>("analytics/scope.json"),
      fetchJson<SubgraphIndex>("subgraphs/index.json"),
      fetchJson<RegioneIndicatori>("geo/regioni_indicatori.json"),
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
        priv,
        s,
        idx,
        ind,
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
        setPrivCat(priv);
        setScope(s);
        setSampleCups(idx.sample_cups ?? []);
        setRegionInd(ind);
      }
    );
  }, []);

  const mapChart = (chart: ChartData | null, maxLen?: number) =>
    chart?.labels.map((label, i) =>
      toChartPoint(
        label,
        chart.series[0]?.data[i] ?? 0,
        maxLen,
        chart.details?.[i]
      )
    ) ?? [];

  const funderChart = mapChart(byFunder, 28);
  const callChart = mapChart(byCall, 32);
  const cupCigChart = mapChart(byCupCig);
  const cupCigDistChart = mapChart(cupCigDist);
  const settoreChart = mapChart(bySettore, 32);
  const categoriaChart = mapChart(byCategoria, 32);
  const regioneChart = mapChart(byRegione, 28);
  const regionePer100kChart: ChartPoint[] =
    byRegione && regionInd
      ? byRegione.labels
          .map((label, i) => {
            const cups = byRegione.series[0]?.data[i] ?? 0;
            const ind = regionInd.regioni[normalizeRegion(label)];
            if (!ind) return null;
            return toChartPoint(
              label,
              cupsPer100k(cups, ind.popolazione),
              28
            );
          })
          .filter((p): p is ChartPoint => p != null)
          .sort((a, b) => b.value - a.value)
      : [];
  const regionePerPilChart: ChartPoint[] =
    byRegione && regionInd
      ? byRegione.labels
          .map((label, i) => {
            const cups = byRegione.series[0]?.data[i] ?? 0;
            const ind = regionInd.regioni[normalizeRegion(label)];
            if (!ind) return null;
            return toChartPoint(
              label,
              cupsPerPilMld(cups, pilMlnEuro(ind)),
              28
            );
          })
          .filter((p): p is ChartPoint => p != null)
          .sort((a, b) => b.value - a.value)
      : [];
  const statoChart = mapChart(byStato, 24);
  const padRegioneChart = mapChart(padRegione, 28);
  const padComuniChart = mapChart(padComuni, 28);
  const scpAwardsChart = mapChart(scpAwards, 28);
  const scpAwardsEuroChart = mapChart(scpAwardsEuro, 28);
  const privCatChart = mapChart(privCat, 32);

  return (
    <div>
      <PageIntro raw={analisiRaw} includeBody={false} />

      <nav aria-label={analisiUi.anchors_aria}>
        <ul className="analisi-anchors">
          {analisiUi.anchors.map((a) => (
            <li key={a.href}>
              <a href={a.href}>{a.label}</a>
            </li>
          ))}
        </ul>
      </nav>

      {scope && (
        <section className="mb-5">
          {analisiSections["scala-nazionale"] && (
            <ContentMarkdown source={analisiSections["scala-nazionale"]} />
          )}
          <div className="row g-3">
            {scope.opencup_cups != null && (
              <StatCard
                value={scope.opencup_cups.toLocaleString("it")}
                label={analisiUi.stats.opencup}
              />
            )}
            {scope.anac_cigs != null && (
              <StatCard
                value={scope.anac_cigs.toLocaleString("it")}
                label={analisiUi.stats.anac}
              />
            )}
            {scope.padigitale_raw_cups != null && (
              <StatCard
                value={scope.padigitale_raw_cups.toLocaleString("it")}
                label={analisiUi.stats.padigitale}
              />
            )}
            {scope.enti_ipa != null && (
              <StatCard
                value={scope.enti_ipa.toLocaleString("it")}
                label={analisiUi.stats.enti_ipa}
              />
            )}
          </div>
        </section>
      )}

      {sampleCups.length > 0 && (
        <section className="mb-5">
          {analisiSections["dal-numero-al-grafo"] && (
            <ContentMarkdown source={analisiSections["dal-numero-al-grafo"]} />
          )}
          <div className="row g-3">
            {sampleCups.map((cup) => (
              <div className="col-12 col-md-6" key={cup}>
                <div className="card-wrapper card-space h-100">
                  <div className="card card-bg h-100">
                    <div className="card-body">
                      <h3 className="h5 card-title">
                        <code>{cup}</code>
                      </h3>
                      <p className="card-text">{analisiUi.sample_card.body}</p>
                      <div className="d-flex flex-wrap gap-2">
                        <Link
                          className="btn btn-primary btn-sm"
                          to={`/unione?cup=${cup}`}
                        >
                          {analisiUi.sample_card.link_unione}
                        </Link>
                        <Link
                          className="btn btn-outline-primary btn-sm"
                          to={`/unione/animazione?cup=${cup}`}
                        >
                          {analisiUi.sample_card.link_animazione}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div id="analisi-stato">
        <ChartSection
          title={byStato?.title}
          insight={insights.opencup_by_stato}
          data={statoChart}
          color={BI.analogue1}
          layout="horizontal"
          height={280}
        />
      </div>

      <div id="analisi-territorio">
        <ChartSection
          title={byRegione?.title}
          insight={insights.cups_by_regione}
          data={regioneChart}
          color={BI.primary}
          yWidth={140}
        />

        <ChartSection
          title={analisiUi.charts.per_100k}
          insight={insights.cups_by_regione_per_100k}
          data={regionePer100kChart}
          color={BI.primary}
          yWidth={140}
          valueDecimals
        />

        <ChartSection
          title={analisiUi.charts.per_pil}
          insight={insights.cups_by_regione_per_pil}
          data={regionePerPilChart}
          color={BI.primary}
          yWidth={140}
          valueDecimals
        />
      </div>

      <section className="chart-section" id="analisi-mappa">
        <h2>{analisiUi.charts.map}</h2>
        <Insight>{insights.cups_by_regione_map}</Insight>
        <RegioneCupMap chart={byRegione} />
      </section>

      <div id="analisi-pnrr">
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
          title={byCall?.title}
          insight={insights.cost_by_call}
          data={callChart}
          color={BI.analogue1}
          euro
          yWidth={200}
        />
      </div>

      <div id="analisi-gare">
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
      </div>

      <div id="analisi-classificazione">
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
      </div>

      <div id="analisi-titolari">
        <ChartSection
          title={byFunder?.title}
          insight={insights.cost_by_funder}
          data={funderChart}
          color={BI.primary}
          euro
          yWidth={160}
        />

        <ChartSection
          title={privCat?.title}
          insight={insights.soggetto_privato_by_categoria}
          data={privCatChart}
          color={BI.neutral}
          euro
          yWidth={200}
        />
      </div>

      {gapsDoc?.items?.length ? (
        <section className="mt-4">
          <h2 className="h5">{gapsDoc.title}</h2>
          <ul className="analisi-gaps">
            {gapsDoc.items.map((g) => (
              <li key={g.slice(0, 48)}>
                <ContentMarkdown source={g.trim()} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
