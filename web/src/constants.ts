/** Accento (bordo) per dataset — toni leggermente desaturati. */
export const DATASET_COLORS: Record<string, string> = {
  opencup: "#3b82f6",
  candidature: "#10b981",
  cupcig: "#f59e0b",
  enti_ipa: "#8b5cf6",
  monithon: "#0d9488",
  shared: "#64748b",
};

/** Sfondo chiaro dei nodi per dataset. */
export const DATASET_FILLS: Record<string, string> = {
  opencup: "#eff6ff",
  candidature: "#ecfdf5",
  cupcig: "#fffbeb",
  enti_ipa: "#f5f3ff",
  monithon: "#f0fdfa",
  shared: "#f8fafc",
};

/** Etichette dataset: vedi `web/content/site.yml` (`dataset_labels`). */
export { DATASET_LABELS } from "./content/site";

export const TYPE_COLORS: Record<string, string> = {
  "pi:Progetto_di_investimento_pubblico": "#3b82f6",
  "pi:Intervento_di_investimento_pubblico": "#60a5fa",
  "COV:PublicOrganization": "#8b5cf6",
  "PCTR:Lot": "#f59e0b",
  "PCTR:Award": "#d97706",
  "PCTR:ContractNotice": "#b45309",
  "PRJ:Call": "#10b981",
  "schema:Report": "#0d9488",
  "cm:Report_di_monitoraggio_civico": "#0d9488",
  "cm:Gruppo_di_monitoraggio": "#14b8a6",
  "skos:Concept": "#94a3b8",
  "CLV:Address": "#22d3ee",
  Literal: "#e2e8f0",
  Resource: "#f1f5f9",
};

export const TYPE_FILLS: Record<string, string> = {
  "pi:Progetto_di_investimento_pubblico": "#eff6ff",
  "pi:Intervento_di_investimento_pubblico": "#f0f9ff",
  "COV:PublicOrganization": "#f5f3ff",
  "PCTR:Lot": "#fffbeb",
  "PCTR:Award": "#fff7ed",
  "PCTR:ContractNotice": "#ffedd5",
  "PRJ:Call": "#ecfdf5",
  "schema:Report": "#f0fdfa",
  "cm:Report_di_monitoraggio_civico": "#f0fdfa",
  "cm:Gruppo_di_monitoraggio": "#ccfbf1",
  "skos:Concept": "#f1f5f9",
  "CLV:Address": "#ecfeff",
  Literal: "#f8fafc",
  Resource: "#f8fafc",
};
