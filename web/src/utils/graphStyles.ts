/** Nodi sotto gli archi così le etichette degli edge restano leggibili. */
export const Z_INDEX_MANUAL = {
  "z-index-compare": "manual",
} as const;

/** Ombra morbida — forma va impostata per tipo nodo (ellipse vs round-rectangle). */
export const NODE_SHADOW_COMPACT = {
  "underlay-opacity": 0.4,
  "underlay-padding": 4,
  "underlay-color": "#cbd5e1",
  "underlay-shape": "ellipse",
} as const;

export const NODE_SHADOW_BOX = {
  "underlay-opacity": 0.45,
  "underlay-padding": 5,
  "underlay-color": "#cbd5e1",
  "underlay-shape": "round-rectangle",
} as const;

/** Evidenzia join senza sovrascrivere i colori di dataset (fill/bordo da data). */
export const JOIN_NODE_STYLE_COMPACT = {
  "border-width": 3,
  "underlay-opacity": 0.85,
  "underlay-padding": 5,
  "underlay-color": "#f87171",
  "underlay-shape": "ellipse",
} as const;

export const JOIN_NODE_STYLE_BOX = {
  "border-width": 3,
  "underlay-opacity": 0.85,
  "underlay-padding": 5,
  "underlay-color": "#f87171",
  "underlay-shape": "round-rectangle",
} as const;

export const EDGE_LINE_BASE = {
  "curve-style": "bezier",
  "edge-distances": "intersection",
  "target-arrow-shape": "vee",
  "arrow-scale": 0.85,
  width: 1.5,
  "line-color": "#cbd5e1",
  "target-arrow-color": "#cbd5e1",
  "line-opacity": 0.9,
} as const;

export const EDGE_LABEL_VISIBLE = {
  label: "data(label)",
  "font-size": "7.5px",
  "font-family": '"Noto Sans", "Segoe UI", system-ui, sans-serif',
  "text-rotation": "autorotate",
  "text-wrap": "wrap",
  "text-max-width": "108px",
  "text-margin-y": 12,
  color: "#475569",
  "text-background-color": "#f8fafc",
  "text-background-opacity": 0.95,
  "text-background-padding": "3px",
  "text-background-shape": "roundrectangle",
  "text-border-color": "#e2e8f0",
  "text-border-width": 1,
  "text-opacity": 1,
  "z-index": 200,
} as const;
