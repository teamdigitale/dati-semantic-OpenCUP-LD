/** Doppio bordo rosso: anello esterno (underlay) + fascia bianca + corpo nodo. */
export const JOIN_NODE_STYLE_COMPACT = {
  "border-width": 3,
  "border-color": "#ffffff",
  "border-opacity": 1,
  "underlay-opacity": 1,
  "underlay-padding": 7,
  "underlay-color": "#dc2626",
  "underlay-shape": "ellipse",
} as const;

export const JOIN_NODE_STYLE_BOX = {
  "border-width": 3,
  "border-color": "#ffffff",
  "border-opacity": 1,
  "underlay-opacity": 1,
  "underlay-padding": 7,
  "underlay-color": "#dc2626",
  "underlay-shape": "round-rectangle",
} as const;
