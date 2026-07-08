import { normalizeDisplayText } from "./text";

/** Etichetta compatta sul nodo; il testo completo resta nel pannello al click. */
export function graphNodeDisplayLabel(label: string, type: string): string {
  const text = normalizeDisplayText(label);

  if (type === "pi:Progetto_di_investimento_pubblico") return text;
  if (type === "PCTR:Lot") {
    if (text.startsWith("CIG ")) return text.length > 14 ? `${text.slice(0, 12)}…` : text;
    return `CIG ${text.slice(0, 8)}…`;
  }
  if (type === "pi:Intervento_di_investimento_pubblico") return "Intervento";
  if (type === "PRJ:Call") return text.length > 24 ? `${text.slice(0, 22)}…` : text;
  if (type === "COV:PublicOrganization") {
    const m = text.match(/Comune di ([^,-]+)/i);
    if (m) return `Comune di ${m[1].trim()}`;
    return text.length > 26 ? `${text.slice(0, 24)}…` : text;
  }
  if (type === "Literal") return text.length > 14 ? `${text.slice(0, 12)}…` : text;
  if (type === "PRJ:Programme") return text;

  return text.length > 28 ? `${text.slice(0, 26)}…` : text;
}
