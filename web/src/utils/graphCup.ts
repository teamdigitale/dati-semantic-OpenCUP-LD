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

/** Nodi e archi del dataset collegati al CUP (o presenti nell'unione per quel dataset). */
export function extractDatasetCupSlice(
  graph: GraphData,
  merged: SubgraphData,
  cupCode: string
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const cupUri = cupCodeToUri(cupCode);
  const keep = new Set(
    merged.nodes.filter((n) => n.dataset === graph.dataset).map((n) => n.id)
  );
  if (graph.nodes.some((n) => n.id === cupUri)) keep.add(cupUri);

  let changed = true;
  while (changed) {
    changed = false;
    for (const e of graph.edges) {
      if (keep.has(e.source) && !keep.has(e.target)) {
        keep.add(e.target);
        changed = true;
      }
      if (keep.has(e.target) && !keep.has(e.source)) {
        keep.add(e.source);
        changed = true;
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

/**
 * Mappa id logici dell'unione → id Cytoscape nella vista separata.
 * Gestisce alias (es. intervento con id sintetico diverso nel grafo isolato).
 */
export function buildLogicalToCyMap(
  graphs: Record<string, GraphData>,
  merged: SubgraphData,
  cupCode: string
): Map<string, string> {
  const cupUri = cupCodeToUri(cupCode);
  const map = new Map<string, string>();

  for (const dataset of ["opencup", "candidature", "cupcig", "enti_ipa"] as const) {
    const graph = graphs[dataset];
    if (!graph) continue;
    const slice = extractDatasetCupSlice(graph, merged, cupCode);
    for (const n of slice.nodes) {
      map.set(n.id, makeCyNodeId(dataset, n.id));
    }
  }

  for (const mn of merged.nodes) {
    if (map.has(mn.id)) continue;
    const graph = graphs[mn.dataset];
    if (!graph) continue;
    const slice = extractDatasetCupSlice(graph, merged, cupCode);

    if (mn.type === "pi:Intervento_di_investimento_pubblico") {
      const alt = slice.nodes.find(
        (n) =>
          n.type === mn.type &&
          slice.edges.some(
            (e) =>
              (e.source === cupUri && e.target === n.id) ||
              (e.target === cupUri && e.source === n.id)
          )
      );
      if (alt) map.set(mn.id, makeCyNodeId(mn.dataset, alt.id));
    }
  }

  return map;
}

export function resolveMergedCyEndpoints(
  edge: GraphEdge,
  logicalToCy: Map<string, string>,
  cyNodeIds: Set<string>
): { source: string; target: string } | null {
  const srcCy = logicalToCy.get(edge.source);
  const tgtCy = logicalToCy.get(edge.target);
  if (!srcCy || !tgtCy || !cyNodeIds.has(srcCy) || !cyNodeIds.has(tgtCy)) {
    return null;
  }
  return { source: srcCy, target: tgtCy };
}

/** Layout radiale compatto per mini-grafi e posizioni target dell'unione. */
export function hubRadialPositions(
  nodes: GraphNode[],
  edges: GraphEdge[],
  cx = 0,
  cy = 0,
  scale = 1
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
  const hubId = cup?.id ?? nodes.sort((a, b) => {
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
  const r1 = Math.max(200, 95 + neighborArr.length * 28) * scale;

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
    const step = 95 * scale;
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
  opencup: { x: -480, y: -280 },
  candidature: { x: 480, y: -280 },
  cupcig: { x: -480, y: 280 },
  enti_ipa: { x: 480, y: 280 },
};
