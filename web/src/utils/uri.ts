/** Prefissi RDF usati nei grafi — per espandere shortId in URI dereferenziabili. */
export const PREFIXES: Record<string, string> = {
  cup: "https://w3id.org/italia/PublicInvestment/data/CUP/",
  po: "https://w3id.org/italia/data/PublicOrganization/",
  lot: "https://w3id.org/italia/data/Lot/",
  call: "https://w3id.org/italia/data/Call/",
  pi: "https://w3id.org/italia/PublicInvestment/onto/PublicInvestment/",
  picv: "https://w3id.org/italia/PublicInvestment/controlled-vocabulary/",
  COV: "https://w3id.org/italia/onto/COV/",
  CLV: "https://w3id.org/italia/onto/CLV/",
  PRJ: "https://w3id.org/italia/onto/Project/",
  PCTR: "https://w3id.org/italia/onto/PublicContract/",
  owl: "http://www.w3.org/2002/07/owl#",
  skos: "http://www.w3.org/2004/02/skos/core#",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
};

export function isHttpUri(value: string): boolean {
  return /^https?:\/\//.test(value);
}

/** Nodi literal sintetici (es. cup|pi:costo) — non dereferenziabili. */
export function isSyntheticNodeId(id: string): boolean {
  return !isHttpUri(id) && id.includes("|");
}

export function expandPrefixedName(term: string): string | null {
  if (!term || term.includes("{")) return null;
  const colon = term.indexOf(":");
  if (colon <= 0) return null;
  const prefix = term.slice(0, colon);
  const local = term.slice(colon + 1);
  const ns = PREFIXES[prefix];
  if (!ns || !local) return null;
  return ns + local;
}

/** Restituisce l'URI HTTP(S) per dereferenziazione, o null se non applicabile. */
export function resolveHref(value: string): string | null {
  if (!value || value.includes("{") || isSyntheticNodeId(value)) return null;
  if (isHttpUri(value)) return value;
  return expandPrefixedName(value);
}

/** CUP code (senza prefisso) → URI progetto. */
export function cupCodeToUri(code: string): string {
  return `${PREFIXES.cup}${code}`;
}

const TERM_RE = /[A-Za-z][\w]*:[\w%.-]+/g;

/** Spezza una stringa di mapping in token linkabili e testo. */
export function tokenizeRdfMapping(text: string): { text: string; href: string | null }[] {
  const tokens: { text: string; href: string | null }[] = [];
  let last = 0;
  for (const match of text.matchAll(TERM_RE)) {
    const idx = match.index ?? 0;
    if (idx > last) {
      tokens.push({ text: text.slice(last, idx), href: null });
    }
    const term = match[0];
    tokens.push({ text: term, href: resolveHref(term) });
    last = idx + term.length;
  }
  if (last < text.length) {
    tokens.push({ text: text.slice(last), href: null });
  }
  return tokens.length ? tokens : [{ text, href: null }];
}
