export interface GraphNode {
  id: string;
  shortId: string;
  label: string;
  type: string;
  dataset: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

export interface GraphData {
  dataset: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  sample_note?: string;
  coverage?: "full" | "sample";
  sample_cups?: string[];
}

export interface ScopeData {
  title: string;
  definition: string;
  mode?: "full_raw" | "hub";
  filters: { step: string; rule: string; role: string }[];
  /** Full-source counts */
  opencup_cups?: number;
  opencup_rows?: number;
  anac_pairs?: number;
  anac_cups?: number;
  anac_cigs?: number;
  padigitale_raw_cups?: number;
  padigitale_rows?: number;
  enti_ipa?: number;
  scp_bandi_cigs_full?: number;
  scp_esiti_cigs_full?: number;
  /** Hub (intersection) comparison */
  hub_cups?: number;
  hub_cigs?: number;
  hub_pairs?: number;
  hub_opencup_cups?: number;
  hub_padigitale_cups?: number;
  hub_enti_ipa?: number;
  /** Legacy hub-filtered fields (may still appear) */
  padigitale_filtered_cups?: number;
  opencup_missing_from_hub?: number;
  scp_bandi_cigs?: number;
  scp_esiti_cigs?: number;
  hub_cigs_without_bando?: number;
  gaps?: string[];
}

export interface SubgraphData {
  id: string;
  title: string;
  sparql_note: string;
  datasets_involved: string[];
  join_edges: GraphEdge[];
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface FieldMapping {
  0: string;
  1: string;
  2: string;
  3: string;
}

export interface MappingsData {
  templates: { file: string; dataset: string }[];
  fieldMappings: [string, string, string, string][];
  semanticJoins: {
    id: string;
    label: string;
    uri: string;
    datasets: string[];
    note: string;
  }[];
}

export interface ChartData {
  title: string;
  labels: string[];
  /** Optional long titles / descriptions aligned with labels */
  details?: string[];
  series: { name: string; data: number[] }[];
}

export interface CountsData {
  cups: number;
  lots: number;
  orgs: number;
  triples: number;
  opencup_cups?: number;
  opencup_rows?: number;
  anac_pairs?: number;
  anac_cups?: number;
  anac_cigs?: number;
  padigitale_rows?: number;
  padigitale_cups?: number;
  enti_ipa?: number;
  hub_cups?: number;
  hub_cigs?: number;
  hub_pairs?: number;
  scp_bandi_cigs?: number;
  scp_esiti_cigs?: number;
}
