/** Caratteri C1 (0x80–0x9F) spesso derivano da Windows-1252 interpretato come UTF-8. */
const WIN1252_TO_UNICODE: Record<number, string> = {
  0x80: "€",
  0x82: "‚",
  0x83: "ƒ",
  0x84: "„",
  0x85: "…",
  0x86: "†",
  0x87: "‡",
  0x88: "ˆ",
  0x89: "‰",
  0x8a: "Š",
  0x8b: "‹",
  0x8c: "Œ",
  0x8e: "Ž",
  0x91: "'",
  0x92: "'",
  0x93: '"',
  0x94: '"',
  0x95: "•",
  0x96: "–",
  0x97: "—",
  0x98: "˜",
  0x99: "™",
  0x9a: "š",
  0x9b: "›",
  0x9c: "œ",
  0x9e: "ž",
  0x9f: "Ÿ",
};

const UNICODE_APOSTROPHE = new Set([0x2018, 0x2019, 0x02bc, 0x0060, 0x00b4]);
const UNICODE_QUOTE = new Set([0x201c, 0x201d, 0x00ab, 0x00bb]);

/** Normalizza testo per il canvas Cytoscape e per l'interfaccia. */
export function normalizeDisplayText(text: string): string {
  if (!text) return text;
  let out = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 0x80 && code <= 0x9f) {
      out += WIN1252_TO_UNICODE[code] ?? "";
      continue;
    }
    if (code < 0x20 && code !== 0x0a && code !== 0x0d) continue;
    if (UNICODE_APOSTROPHE.has(code)) {
      out += "'";
    } else if (UNICODE_QUOTE.has(code)) {
      out += '"';
    } else if (code === 0xa0) {
      out += " ";
    } else {
      out += ch;
    }
  }
  return out;
}

/** Font stack con buona copertura Unicode per etichette su canvas. */
export const GRAPH_FONT_FAMILY =
  '"Noto Sans", "Segoe UI", "DejaVu Sans", system-ui, sans-serif';
