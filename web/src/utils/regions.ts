/** Normalize OpenCUP / GeoJSON region names for matching. */
export function normalizeRegion(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/\/.*$/, "")
    .replace(/VALLE D.?AOSTA.*/i, "VALLE D'AOSTA")
    .replace(/TRENTINO.?ALTO.?ADIGE.*/i, "TRENTINO-ALTO ADIGE")
    .replace(/FRIULI.?VENEZIA.?GIULIA.*/i, "FRIULI-VENEZIA GIULIA")
    .replace(/EMILIA.?ROMAGNA.*/i, "EMILIA-ROMAGNA")
    .replace(/\s+/g, " ")
    .trim();
}

export function padIstat(code: string | number | undefined, len: number): string {
  if (code == null || code === "") return "";
  return String(code).replace(/\D/g, "").padStart(len, "0").slice(-len);
}

export interface RegioneIndicatori {
  source: string;
  notes?: string;
  regioni: Record<
    string,
    { popolazione: number; pil_pro_capite_euro: number; pil_mln_euro?: number }
  >;
}

export interface TerritoryMetrics {
  name?: string;
  cups: number;
  cup_euro: number;
  cigs: number;
  cig_euro: number;
}

export interface MapTerritoryData {
  source: string;
  notes?: string;
  regioni: Record<string, TerritoryMetrics>;
  province: Record<string, TerritoryMetrics>;
  comuni: Record<string, TerritoryMetrics>;
}

export type TerritoryLevel = "regione" | "provincia" | "comune";
export type EntityKind = "cup" | "cig";
export type ValueKind = "count" | "euro";
export type RegioneMapMode = "assoluti" | "per_abitante" | "per_pil";

export function pilMlnEuro(ind: {
  popolazione: number;
  pil_pro_capite_euro: number;
  pil_mln_euro?: number;
}): number {
  if (ind.pil_mln_euro != null) return ind.pil_mln_euro;
  return (ind.popolazione * ind.pil_pro_capite_euro) / 1e6;
}

export function cupsPer100k(cups: number, popolazione: number): number {
  if (!popolazione) return 0;
  return (cups / popolazione) * 100_000;
}

export function cupsPerPilMld(cups: number, pilMln: number): number {
  if (!pilMln) return 0;
  return cups / (pilMln / 1000);
}

export function rawMetric(
  m: TerritoryMetrics | undefined,
  entity: EntityKind,
  value: ValueKind
): number {
  if (!m) return 0;
  if (entity === "cup") return value === "count" ? m.cups : m.cup_euro;
  return value === "count" ? m.cigs : m.cig_euro;
}

export function levelFromZoom(zoom: number): TerritoryLevel {
  if (zoom >= 9) return "comune";
  if (zoom >= 7) return "provincia";
  return "regione";
}
