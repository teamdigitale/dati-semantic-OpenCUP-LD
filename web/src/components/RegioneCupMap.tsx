import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import type { Layer, PathOptions } from "leaflet";
import L from "leaflet";
import { feature as topoFeature } from "topojson-client";
import type { Topology } from "topojson-specification";
import { ChartData } from "../types";
import {
  normalizeRegion,
  padIstat,
  RegioneIndicatori,
  RegioneMapMode,
  TerritoryLevel,
  EntityKind,
  ValueKind,
  MapTerritoryData,
  TerritoryMetrics,
  cupsPer100k,
  cupsPerPilMld,
  pilMlnEuro,
  rawMetric,
  levelFromZoom,
} from "../utils/regions";
import "leaflet/dist/leaflet.css";

const BASE = import.meta.env.BASE_URL;
const GEO_REG = `${BASE}data/geo/regioni.geojson`;
const GEO_PROV = `${BASE}data/geo/province.geojson`;
const GEO_COM = `${BASE}data/geo/comuni.topo.json`;
const IND_URL = `${BASE}data/geo/regioni_indicatori.json`;
const MAP_URL = `${BASE}data/analytics/map_territory.json`;

type GeoProps = {
  reg_name?: string;
  prov_name?: string;
  prov_istat_code?: string;
  name?: string;
  com_istat_code?: string;
};

function FitItalyOnce({
  geo,
  didFitRef,
}: {
  geo: FeatureCollection;
  didFitRef: MutableRefObject<boolean>;
}) {
  const map = useMap();
  useEffect(() => {
    if (didFitRef.current) return;
    const b = L.geoJSON(geo).getBounds();
    if (b.isValid()) {
      map.fitBounds(b, { padding: [12, 12] });
      didFitRef.current = true;
    }
  }, [geo, map, didFitRef]);
  return null;
}

function ZoomWatcher({
  onZoom,
}: {
  onZoom: (z: number) => void;
}) {
  const map = useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
  });
  useEffect(() => {
    onZoom(map.getZoom());
  }, [map, onZoom]);
  return null;
}

function colorScale(value: number, max: number): string {
  if (!max || value <= 0) return "#e8eef4";
  const t = Math.min(1, value / max);
  const stops = ["#c5d9f0", "#7eb0e0", "#3d8ccd", "#0066cc", "#004d99"];
  const i = Math.min(stops.length - 1, Math.floor(t * stops.length));
  return stops[i];
}

function formatCompactEuro(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1).replace(".", ",")} mld €`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1).replace(".", ",")} M€`;
  if (v >= 1e3) return `${Math.round(v / 1e3).toLocaleString("it")} k€`;
  return `${Math.round(v).toLocaleString("it")} €`;
}

function formatDisplay(
  v: number,
  entity: EntityKind,
  value: ValueKind,
  scale: RegioneMapMode,
  level: TerritoryLevel
): string {
  const unit = entity === "cup" ? "CUP" : "CIG";
  if (value === "euro") {
    if (level === "regione" && scale === "per_abitante")
      return `${formatCompactEuro(v)} / 100k ab.`;
    if (level === "regione" && scale === "per_pil")
      return `${formatCompactEuro(v)} / mld € PIL`;
    return formatCompactEuro(v);
  }
  if (level === "regione" && scale === "per_abitante")
    return `${v.toLocaleString("it", { maximumFractionDigits: 0 })} ${unit} / 100k ab.`;
  if (level === "regione" && scale === "per_pil")
    return `${v.toLocaleString("it", { maximumFractionDigits: 1 })} ${unit} / mld € PIL`;
  return `${Math.round(v).toLocaleString("it")} ${unit}`;
}

function featureKey(level: TerritoryLevel, props: GeoProps): string {
  if (level === "regione") return normalizeRegion(props.reg_name ?? "");
  if (level === "provincia") return padIstat(props.prov_istat_code, 3);
  return padIstat(props.com_istat_code, 6);
}

function featureLabel(level: TerritoryLevel, props: GeoProps): string {
  if (level === "regione") return props.reg_name ?? "";
  if (level === "provincia") return props.prov_name ?? props.prov_istat_code ?? "";
  return props.name ?? props.com_istat_code ?? "";
}

function resolveValue(
  metrics: TerritoryMetrics | undefined,
  entity: EntityKind,
  value: ValueKind,
  scale: RegioneMapMode,
  level: TerritoryLevel,
  regionKey: string | undefined,
  indicators: RegioneIndicatori | null
): number {
  const raw = rawMetric(metrics, entity, value);
  if (level !== "regione" || scale === "assoluti" || !regionKey || !indicators) {
    return raw;
  }
  const ind = indicators.regioni[regionKey];
  if (!ind) return raw;
  if (scale === "per_abitante") return cupsPer100k(raw, ind.popolazione);
  return cupsPerPilMld(raw, pilMlnEuro(ind));
}

/** Fallback: build region cups map from legacy chart if map_territory missing. */
function legacyFromChart(chart: ChartData | null): MapTerritoryData | null {
  if (!chart) return null;
  const regioni: Record<string, TerritoryMetrics> = {};
  chart.labels.forEach((lab, i) => {
    regioni[normalizeRegion(lab)] = {
      cups: chart.series[0]?.data[i] ?? 0,
      cup_euro: 0,
      cigs: 0,
      cig_euro: 0,
    };
  });
  return { source: "cups_by_regione", regioni, province: {}, comuni: {} };
}

export function RegioneCupMap({ chart }: { chart: ChartData | null }) {
  const [regGeo, setRegGeo] = useState<FeatureCollection | null>(null);
  const [provGeo, setProvGeo] = useState<FeatureCollection | null>(null);
  const [comGeo, setComGeo] = useState<FeatureCollection | null>(null);
  const [indicators, setIndicators] = useState<RegioneIndicatori | null>(null);
  const [territory, setTerritory] = useState<MapTerritoryData | null>(null);
  const [zoom, setZoom] = useState(5);
  const [levelOverride, setLevelOverride] = useState<"auto" | TerritoryLevel>(
    "auto"
  );
  const [entity, setEntity] = useState<EntityKind>("cup");
  const [valueKind, setValueKind] = useState<ValueKind>("count");
  const [scale, setScale] = useState<RegioneMapMode>("assoluti");
  const didFitRef = useRef(false);

  useEffect(() => {
    fetch(GEO_REG)
      .then((r) => r.json())
      .then(setRegGeo)
      .catch(() => setRegGeo(null));
    fetch(GEO_PROV)
      .then((r) => r.json())
      .then(setProvGeo)
      .catch(() => setProvGeo(null));
    fetch(GEO_COM)
      .then((r) => r.json())
      .then((topo: Topology) => {
        const obj = topo.objects.comuni ?? Object.values(topo.objects)[0];
        setComGeo(topoFeature(topo, obj) as FeatureCollection);
      })
      .catch(() => setComGeo(null));
    fetch(IND_URL)
      .then((r) => r.json())
      .then(setIndicators)
      .catch(() => setIndicators(null));
    fetch(MAP_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setTerritory(d ?? legacyFromChart(chart)))
      .catch(() => setTerritory(legacyFromChart(chart)));
  }, [chart]);

  const wantedLevel: TerritoryLevel =
    levelOverride === "auto" ? levelFromZoom(zoom) : levelOverride;

  /** Keep previous layer until the target geo is ready — never unmount the map. */
  const level: TerritoryLevel = useMemo(() => {
    if (wantedLevel === "comune") {
      if (comGeo) return "comune";
      if (provGeo) return "provincia";
      return "regione";
    }
    if (wantedLevel === "provincia") {
      if (provGeo) return "provincia";
      return "regione";
    }
    return "regione";
  }, [wantedLevel, comGeo, provGeo]);

  const layerPending = wantedLevel !== level;

  const activeGeo =
    level === "comune" ? comGeo : level === "provincia" ? provGeo : regGeo;

  const lookup = useMemo(() => {
    if (!territory) return new Map<string, TerritoryMetrics>();
    const src =
      level === "comune"
        ? territory.comuni
        : level === "provincia"
          ? territory.province
          : territory.regioni;
    return new Map(Object.entries(src));
  }, [territory, level]);

  const valueByKey = useMemo(() => {
    const m = new Map<string, number>();
    lookup.forEach((metrics, key) => {
      m.set(
        key,
        resolveValue(
          metrics,
          entity,
          valueKind,
          scale,
          level,
          level === "regione" ? key : undefined,
          indicators
        )
      );
    });
    return m;
  }, [lookup, entity, valueKind, scale, level, indicators]);

  const max = useMemo(() => {
    let m = 0;
    valueByKey.forEach((v) => {
      if (v > m) m = v;
    });
    return m;
  }, [valueByKey]);

  const canvasRenderer = useMemo(() => L.canvas({ padding: 0.5 }), []);

  if (!regGeo || !territory) {
    return <p className="text-secondary">Caricamento mappa…</p>;
  }

  const displayGeo = activeGeo ?? regGeo;

  const style = (feature?: Feature<Geometry, GeoProps>): PathOptions => {
    const props = feature?.properties ?? {};
    const key = featureKey(level, props);
    const v = valueByKey.get(key) ?? 0;
    return {
      fillColor: colorScale(v, max),
      weight: level === "comune" ? 0.4 : 1,
      opacity: 1,
      color: "#5b6f82",
      fillOpacity: 0.85,
    };
  };

  const onEach = (feature: Feature<Geometry, GeoProps>, layer: Layer) => {
    const props = feature.properties ?? {};
    const key = featureKey(level, props);
    const v = valueByKey.get(key) ?? 0;
    const label = featureLabel(level, props);
    const metrics = lookup.get(key);
    const extra =
      metrics && valueKind === "count"
        ? `<br/><span class="text-muted">${formatCompactEuro(
            entity === "cup" ? metrics.cup_euro : metrics.cig_euro
          )}</span>`
        : metrics && valueKind === "euro"
          ? `<br/><span class="text-muted">${Math.round(
              entity === "cup" ? metrics.cups : metrics.cigs
            ).toLocaleString("it")} ${entity === "cup" ? "CUP" : "CIG"}</span>`
          : "";
    layer.bindTooltip(
      `<strong>${label}</strong><br/>${formatDisplay(
        v,
        entity,
        valueKind,
        scale,
        level
      )}${extra}`,
      { sticky: true }
    );
  };

  return (
    <div className="regione-map-wrap">
      <div className="regione-map-toolbar d-flex flex-wrap gap-2 mb-2 align-items-center">
        <div className="btn-group" role="group" aria-label="Entità">
          {(
            [
              ["cup", "CUP"],
              ["cig", "CIG"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`btn btn-sm ${entity === id ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setEntity(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="btn-group" role="group" aria-label="Valore">
          {(
            [
              ["count", "Quantità"],
              ["euro", "Importo €"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`btn btn-sm ${valueKind === id ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setValueKind(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="btn-group" role="group" aria-label="Livello territoriale">
          {(
            [
              ["auto", "Auto (zoom)"],
              ["regione", "Regioni"],
              ["provincia", "Province"],
              ["comune", "Comuni"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`btn btn-sm ${levelOverride === id ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setLevelOverride(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {level === "regione" ? (
          <div className="btn-group" role="group" aria-label="Scala">
            {(
              [
                ["assoluti", "Assoluti"],
                ["per_abitante", "Per abitante"],
                ["per_pil", "Per PIL"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`btn btn-sm ${scale === id ? "btn-secondary" : "btn-outline-secondary"}`}
                onClick={() => setScale(id)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
        {layerPending ? (
          <span className="small text-secondary">
            Caricamento {wantedLevel}…
          </span>
        ) : null}
      </div>
      <MapContainer
        center={[42.5, 12.5]}
        zoom={5}
        scrollWheelZoom
        style={{ height: 480, width: "100%" }}
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON
          key={`${level}-${entity}-${valueKind}-${scale}`}
          data={displayGeo}
          style={style}
          onEachFeature={onEach}
          pathOptions={{ renderer: canvasRenderer }}
        />
        <FitItalyOnce geo={regGeo} didFitRef={didFitRef} />
        <ZoomWatcher onZoom={setZoom} />
      </MapContainer>
      <p className="small text-secondary mt-2 mb-0">
        Livello: <strong>{level}</strong>
        {levelOverride === "auto"
          ? ` (zoom ${zoom.toFixed(0)}: regioni sotto 7, province 7–8, comuni da 9)`
          : null}
        .{" "}
        {valueKind === "count"
          ? `Colori = numero di ${entity === "cup" ? "CUP" : "CIG"}.`
          : entity === "cup"
            ? "Colori = finanziamento OpenCUP (€)."
            : "Colori = importo di aggiudicazione SCP (€), geolocalizzato via CUP."}{" "}
        Confini: openpolis / ISTAT. Usa lo zoom o i pulsanti per province e comuni.
      </p>
    </div>
  );
}
