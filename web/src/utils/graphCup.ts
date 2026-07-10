import { GraphData, GraphEdge, GraphNode, SubgraphData } from "../types";
import { cupCodeToUri } from "./uri";

export function joinNodeIdsFromEdges(edges: GraphEdge[]): Set<string> {
  const ids = new Set<string>();
  for (const e of edges) {
    ids.add(e.source);
    ids.add(e.target);
  }
  return ids;
}

function leafAngles(count: number): number[] {
  if (count === 1) return [0];
  if (count === 2) return [Math.PI, 0];
  return Array.from({ length: count }, (_, i) => -Math.PI / 2 + (2 * Math.PI * i) / count);
}

function isOtherCupNode(nodeId: string, cupUri: string): boolean {
  return nodeId !== cupUri && /\/CUP\//.test(nodeId);
}

/** Termini SKOS condivisi tra molti CUP: non attraversarli in espansione. */
function isControlledVocabularyUri(nodeId: string): boolean {
  return /\/controlled-vocabulary\//.test(nodeId);
}

/** Nodi hub condivisi (avviso PNRR, programma): non usarli come ponti verso altri CUP. */
function isSharedHubUri(nodeId: string): boolean {
  return (
    isControlledVocabularyUri(nodeId) ||
    /\/data\/Call\//.test(nodeId) ||
    /\/data\/Programme\//.test(nodeId)
  );
}

function isCupInterventoEdge(
  edge: GraphEdge,
  cupUri: string,
  interventoId: string
): boolean {
  return (
    edge.label === "pi:ha_intervento_di_investimento_pubblico" &&
    edge.source === cupUri &&
    edge.target === interventoId
  );
}

/**
 * Sottografo del dataset per un solo CUP: solo nodi dell'unione presenti nel grafo
 * e vicini diretti del CUP (più CV dall'intervento), senza flood-fill su hub condivisi.
 */
export function extractDatasetCupSlice(
  graph: GraphData,
  merged: SubgraphData,
  cupCode: string
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const cupUri = cupCodeToUri(cupCode);
  const keep = new Set<string>();
  const graphIds = new Set(graph.nodes.map((n) => n.id));

  for (const n of merged.nodes) {
    if (graphIds.has(n.id)) keep.add(n.id);
  }

  const cupInGraph = graphIds.has(cupUri);
  if (cupInGraph) {
    keep.add(cupUri);
    for (const e of graph.edges) {
      if (e.source !== cupUri && e.target !== cupUri) continue;
      const other = e.source === cupUri ? e.target : e.source;
      if (isOtherCupNode(other, cupUri)) continue;
      keep.add(other);

      if (isCupInterventoEdge(e, cupUri, other)) {
        for (const e2 of graph.edges) {
          const cv =
            e2.source === other
              ? e2.target
              : e2.target === other
                ? e2.source
                : null;
          if (cv && isControlledVocabularyUri(cv)) keep.add(cv);
        }
      }
    }
  } else {
    const seeds = merged.nodes
      .filter((n) => n.dataset === graph.dataset && graphIds.has(n.id))
      .map((n) => n.id);

    for (const seed of seeds) {
      keep.add(seed);
      if (isSharedHubUri(seed)) continue;
      for (const e of graph.edges) {
        if (e.source !== seed && e.target !== seed) continue;
        const other = e.source === seed ? e.target : e.source;
        if (isOtherCupNode(other, cupUri)) continue;
        keep.add(other);
      }
    }
  }

  const nodes = graph.nodes.filter((n) => keep.has(n.id));
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = graph.edges.filter(
    (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
  );
  return { nodes, edges };
}

export function makeCyNodeId(dataset: string, logicalId: string): string {
  const safe = logicalId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${dataset}__${safe}`;
}

export function mergedInterventoId(merged: SubgraphData): string | undefined {
  return merged.nodes.find((n) => n.type === "pi:Intervento_di_investimento_pubblico")?.id;
}

/** mergeTargetId per animazione: alias intervento OpenCUP → id nell'unione. */
export function resolveMergeTargetId(
  node: GraphNode,
  dataset: string,
  merged: SubgraphData,
  cupCode: string,
  sliceEdges: GraphEdge[]
): string {
  const cupUri = cupCodeToUri(cupCode);
  if (
    node.type === "pi:Intervento_di_investimento_pubblico" &&
    dataset === "opencup" &&
    sliceEdges.some((e) => isCupInterventoEdge(e, cupUri, node.id))
  ) {
    const mergedIv = mergedInterventoId(merged);
    if (mergedIv) return mergedIv;
  }
  return node.id;
}

/**
 * Id Cytoscape canonico per un URI logico (dataset preferito dall'unione).
 * Ogni dataset mantiene il proprio nodo nella vista separata.
 */
export function canonicalCyNodeId(
  logicalId: string,
  merged: SubgraphData,
  cyNodes: {
    id: string;
    logicalId: string;
    mergeTargetId: string;
    dataset: string;
    isDuplicate?: boolean;
  }[]
): string | undefined {
  const canonicalDs = merged.nodes.find((n) => n.id === logicalId)?.dataset;
  const visible = cyNodes.filter(
    (n) =>
      !n.isDuplicate &&
      (n.logicalId === logicalId || n.mergeTargetId === logicalId)
  );
  if (visible.length === 0) return undefined;
  if (canonicalDs) {
    const preferred = visible.find((n) => n.dataset === canonicalDs);
    if (preferred) return preferred.id;
  }
  return visible[0]?.id;
}

/** Quanto il CUP è tirato verso il centro globale (0,0) nel riquadro separato. */
export const MERGE_CUP_CENTER_PULL = 0.42;

/** Scala layout locale nei quadranti separati. */
export const MERGE_SEPARATED_LAYOUT_SCALE = 0.78;

/** Punto lungo la direzione quadrante → centro globale (0,0). */
export function towardGlobalCenter(
  cx: number,
  cy: number,
  factor = MERGE_CUP_CENTER_PULL
): { x: number; y: number } {
  return { x: cx * (1 - factor), y: cy * (1 - factor) };
}

const MERGE_TYPE_SCORE: Record<string, number> = {
  "pi:Progetto_di_investimento_pubblico": 80,
  "COV:PublicOrganization": 60,
  "PCTR:Lot": 50,
  "PRJ:Call": 40,
  "skos:Concept": 10,
};

/**
 * Nodo da evidenziare al centro del riquadro: quello che si fonderà con altri dataset.
 * Se più candidati, sceglie il più importante (CUP > join > URI condiviso > grado).
 */
export function pickMergeAnchorId(
  nodes: GraphNode[],
  edges: GraphEdge[],
  dataset: string,
  merged: SubgraphData,
  cupCode: string,
  joinNodeIds: Set<string>,
  mergeTargetCounts: Map<string, number>
): string | undefined {
  if (nodes.length === 0) return undefined;
  const cupUri = cupCodeToUri(cupCode);

  let bestId: string | undefined;
  let bestScore = -1;

  for (const n of nodes) {
    const mergeTargetId = resolveMergeTargetId(
      n,
      dataset,
      merged,
      cupCode,
      edges
    );
    let score = 0;
    if (n.id === cupUri) score += 1000;
    if (joinNodeIds.has(n.id) || joinNodeIds.has(mergeTargetId)) score += 500;
    if ((mergeTargetCounts.get(mergeTargetId) ?? 0) > 1) score += 300;
    score += MERGE_TYPE_SCORE[n.type] ?? 0;
    const degree = edges.filter(
      (e) => e.source === n.id || e.target === n.id
    ).length;
    score += degree * 8;

    if (score > bestScore) {
      bestScore = score;
      bestId = n.id;
    }
  }
  return bestId;
}

/**
 * Posizioni iniziali per vista separata: ancoraggio merge al centro riquadro,
 * CUP verso il centro globale, resto su layout radiale (poi fcose).
 */
export function quadrantSeparatedPositions(
  nodes: GraphNode[],
  edges: GraphEdge[],
  cx: number,
  cy: number,
  cupCode: string,
  anchorId: string | undefined
): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return pos;

  const hubId = anchorId ?? nodes[0].id;
  const cupUri = cupCodeToUri(cupCode);
  const cupNode = nodes.find((n) => n.id === cupUri);

  if (cupNode && cupUri === hubId) {
    pos.set(hubId, towardGlobalCenter(cx, cy, 0.32));
  } else {
    pos.set(hubId, { x: cx, y: cy });
    if (cupNode) {
      pos.set(cupUri, towardGlobalCenter(cx, cy));
    }
  }

  const radial = hubRadialPositions(
    nodes,
    edges,
    cx,
    cy,
    MERGE_SEPARATED_LAYOUT_SCALE,
    hubId
  );
  for (const n of nodes) {
    if (!pos.has(n.id)) {
      pos.set(n.id, radial.get(n.id) ?? { x: cx, y: cy });
    }
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pos.values()) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const w = Math.max(maxX - minX, 1);
  const h = Math.max(maxY - minY, 1);
  const maxSpan =
    nodes.length > 8 ? MERGE_SEPARATED_MAX_SPAN + 50 : MERGE_SEPARATED_MAX_SPAN;
  const fit = Math.min(1.15, maxSpan / Math.max(w, h));
  if (fit < 1) {
    const anchorPos = pos.get(hubId) ?? { x: cx, y: cy };
    for (const [id, p] of pos) {
      pos.set(id, {
        x: anchorPos.x + (p.x - anchorPos.x) * fit,
        y: anchorPos.y + (p.y - anchorPos.y) * fit,
      });
    }
  }

  return pos;
}

/** Layout compatto per un singolo quadrante (bounding box ~520×320). */
export function quadrantLayoutPositions(
  nodes: GraphNode[],
  edges: GraphEdge[],
  cx: number,
  cy: number
): Map<string, { x: number; y: number }> {
  const local = hubRadialPositions(nodes, edges, 0, 0, MERGE_SEPARATED_LAYOUT_SCALE);
  const pos = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return pos;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const p = local.get(n.id) ?? { x: 0, y: 0 };
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  const w = Math.max(maxX - minX, 1);
  const h = Math.max(maxY - minY, 1);
  const maxSpan =
    nodes.length > 8 ? MERGE_SEPARATED_MAX_SPAN + 50 : MERGE_SEPARATED_MAX_SPAN;
  const fit = Math.min(1.15, maxSpan / Math.max(w, h));
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  for (const n of nodes) {
    const p = local.get(n.id) ?? { x: 0, y: 0 };
    pos.set(n.id, {
      x: cx + (p.x - midX) * fit,
      y: cy + (p.y - midY) * fit,
    });
  }
  return pos;
}

/** Layout radiale compatto per mini-grafi e posizioni target dell'unione. */
export function hubRadialPositions(
  nodes: GraphNode[],
  edges: GraphEdge[],
  cx = 0,
  cy = 0,
  scale = 1,
  explicitHubId?: string
): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return pos;

  if (nodes.length === 2) {
    const [a, b] = nodes;
    pos.set(a.id, { x: cx - 110 * scale, y: cy });
    pos.set(b.id, { x: cx + 110 * scale, y: cy });
    return pos;
  }

  const cup = nodes.find((n) => n.type === "pi:Progetto_di_investimento_pubblico");
  const hubId =
    explicitHubId ??
    cup?.id ??
    nodes.sort((a, b) => {
      const deg = (id: string) =>
        edges.filter((e) => e.source === id || e.target === id).length;
      return deg(b.id) - deg(a.id);
    })[0]?.id;
  if (!hubId) return pos;

  pos.set(hubId, { x: cx, y: cy });

  const neighbors = new Set<string>();
  for (const e of edges) {
    if (e.source === hubId) neighbors.add(e.target);
    if (e.target === hubId) neighbors.add(e.source);
  }
  const neighborArr = [...neighbors];
  const r1 =
    Math.max(120, Math.min(320, 100 + neighborArr.length * 20)) * scale;

  leafAngles(neighborArr.length).forEach((angle, i) => {
    const id = neighborArr[i];
    pos.set(id, { x: cx + r1 * Math.cos(angle), y: cy + r1 * Math.sin(angle) });
  });

  const placed = new Set([hubId, ...neighborArr]);
  for (const n of nodes) {
    if (placed.has(n.id)) continue;
    const anchorEdge = edges.find((e) => e.source === n.id || e.target === n.id);
    const anchorId =
      anchorEdge?.source === n.id ? anchorEdge.target : anchorEdge?.source;
    const anchor = anchorId ? pos.get(anchorId) : undefined;
    if (!anchor) {
      pos.set(n.id, { x: cx + 100 * scale, y: cy + 100 * scale });
      continue;
    }
    const angle = Math.atan2(anchor.y - cy, anchor.x - cx);
    const step = 88 * scale;
    pos.set(n.id, {
      x: anchor.x + step * Math.cos(angle),
      y: anchor.y + step * Math.sin(angle),
    });
  }

  return pos;
}

export const MERGE_DATASETS = ["opencup", "candidature", "cupcig", "enti_ipa"] as const;

export const MERGE_QUADRANTS: Record<
  (typeof MERGE_DATASETS)[number],
  { x: number; y: number }
> = {
  opencup: { x: -720, y: -420 },
  candidature: { x: 720, y: -420 },
  cupcig: { x: -720, y: 420 },
  enti_ipa: { x: 720, y: 420 },
};

/** Dimensione massima (px) di un mini-grafo nel quadrante prima del fcose. */
export const MERGE_SEPARATED_MAX_SPAN = 300;

/** Padding zoom vista separata (init e dopo «Separa»). */
export const MERGE_SEPARATED_FIT_PADDING = 52;
