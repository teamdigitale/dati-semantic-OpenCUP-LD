import { parseYaml } from "./load";
import siteRaw from "../../content/site.yml?raw";

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

export interface SiteContent {
  brand: {
    slim: string;
    title: string;
    tagline: string;
    footer_subtitle: string;
  };
  nav: NavItem[];
  aria: {
    nav: string;
    nav_toggle: string;
  };
  footer: {
    contents_title: string;
    contents_body: string;
    sources_title: string;
    sources_line: string;
    small_print: string;
  };
  cta: {
    detail: string;
  };
  loading: {
    default: string;
    map: string;
    map_level: string;
    graph: string;
    subgraph: string;
  };
  graph: {
    fit: string;
    detail_type: string;
    detail_dataset: string;
    detail_uri: string;
    sample_fallback: string;
    nodes_edges: string;
    source_aria: string;
    dataset_prefix: string;
    subgraph_stats: string;
  };
  dataset_labels: Record<string, string>;
}

export const site = parseYaml<SiteContent>(siteRaw);

export const DATASET_LABELS = site.dataset_labels;
