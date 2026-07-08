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
  filters: { step: string; rule: string; role: string }[];
  padigitale_raw_cups?: number;
  hub_cups?: number;
  hub_cigs?: number;
  padigitale_filtered_cups?: number;
  padigitale_rows?: number;
  opencup_cups?: number;
  opencup_missing_from_hub?: number;
  enti_ipa?: number;
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
  series: { name: string; data: number[] }[];
}

export interface CountsData {
  cups: number;
  lots: number;
  orgs: number;
  triples: number;
}
