import { GRAPH_FONT_FAMILY } from "./text";

/**
 * Non usare `z-index-compare: manual`: su alcuni browser/GitHub Pages
 * i layer canvas multipli restano vuoti (grafo «bianco» con nodi presenti nel modello).
 */

export const NODE_LABEL_FONT_SIZE = "12px";

/**
 * Dimensioni nodi «box» in base all’etichetta (da salvare in `data.boxW` / `data.boxH`).
 * Sostituisce `width`/`height: "label"` (deprecato; può dare nodi invisibili).
 */
export function measureBoxNodeSize(
  label: string,
  maxTextWidth = 118,
  padX = 28,
  padY = 28,
  lineHeight = 16
): { width: number; height: number } {
  const text = label || "·";
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) {
    const approx = Math.min(maxTextWidth, Math.max(40, text.length * 7));
    return {
      width: Math.max(72, approx + padX),
      height: Math.max(40, Math.ceil(text.length / 18) * lineHeight + padY),
    };
  }
  ctx.font = `500 ${NODE_LABEL_FONT_SIZE} ${GRAPH_FONT_FAMILY}`;

  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxTextWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  if (!lines.length) lines.push("·");

  const textW = Math.max(...lines.map((line) => ctx.measureText(line).width));
  return {
    width: Math.max(72, Math.min(maxTextWidth, textW) + padX),
    height: Math.max(40, lines.length * lineHeight + padY),
  };
}

/** Ombra morbida — forma va impostata per tipo nodo (ellipse vs round-rectangle). */
export const NODE_SHADOW_COMPACT = {
  "underlay-opacity": 0.4,
  "underlay-padding": 4,
  "underlay-color": "#d9e6f2",
  "underlay-shape": "ellipse",
} as const;

export const NODE_SHADOW_BOX = {
  "underlay-opacity": 0.45,
  "underlay-padding": 5,
  "underlay-color": "#d9e6f2",
  "underlay-shape": "round-rectangle",
} as const;

/** Evidenzia collegamenti tra fonti senza sovrascrivere i colori di dataset. */
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
  "arrow-scale": 0.9,
  width: 1.75,
  "line-color": "#8a9ba8",
  "target-arrow-color": "#8a9ba8",
  "line-opacity": 0.9,
} as const;

/** Etichette arco: leggibili in demo, sfondo che non copre la freccia. */
export const EDGE_LABEL_VISIBLE = {
  label: "data(label)",
  "font-size": "10px",
  "font-family": '"Noto Sans", "Segoe UI", system-ui, sans-serif',
  "text-rotation": "autorotate",
  "text-wrap": "wrap",
  "text-max-width": "120px",
  "text-margin-y": -10,
  color: "#17324d",
  "text-background-color": "#ffffff",
  "text-background-opacity": 0.92,
  "text-background-padding": "2px",
  "text-background-shape": "roundrectangle",
  "text-border-color": "#d9e6f2",
  "text-border-width": 1,
  "text-opacity": 1,
} as const;
