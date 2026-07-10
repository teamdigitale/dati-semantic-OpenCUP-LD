import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { Collection, Core, EdgeSingular, LayoutOptions } from "cytoscape";
import fcose from "cytoscape-fcose";
import { GraphData, GraphEdge, GraphNode, SubgraphData } from "../types";
import { DATASET_COLORS, DATASET_FILLS, DATASET_LABELS, TYPE_COLORS, TYPE_FILLS } from "../constants";
import {
  MERGE_DATASETS,
  MERGE_QUADRANTS,
  MERGE_SEPARATED_FIT_PADDING,
  canonicalCyNodeId,
  extractDatasetCupSlice,
  hubRadialPositions,
  joinNodeIdsFromEdges,
  makeCyNodeId,
  pickMergeAnchorId,
  quadrantSeparatedPositions,
  resolveMergeTargetId,
} from "../utils/graphCup";
import { cupCodeToUri } from "../utils/uri";
import { graphNodeDisplayLabel } from "../utils/graphLabels";
import {
  EDGE_LABEL_VISIBLE,
  EDGE_LINE_BASE,
  JOIN_NODE_STYLE_BOX,
  JOIN_NODE_STYLE_COMPACT,
  NODE_SHADOW_BOX,
  NODE_SHADOW_COMPACT,
  Z_INDEX_MANUAL,
} from "../utils/graphStyles";
import { GRAPH_FONT_FAMILY, normalizeDisplayText } from "../utils/text";

cytoscape.use(fcose);

const COMPACT_NODE_TYPES = new Set([
  "pi:Progetto_di_investimento_pubblico",
  "PCTR:Lot",
  "Literal",
]);

function nodeColors(dataset: string, type: string): { accent: string; fill: string } {
  const typeAccent = TYPE_COLORS[type];
  const typeFill = TYPE_FILLS[type];
  if (typeAccent && (dataset === "shared" || type === "skos:Concept")) {
    return { accent: typeAccent, fill: typeFill ?? "#ffffff" };
  }
  return {
    accent: DATASET_COLORS[dataset] ?? typeAccent ?? "#64748b",
    fill: DATASET_FILLS[dataset] ?? typeFill ?? "#ffffff",
  };
}

type Phase = "separated" | "merging" | "merged";

interface Props {
  cupCode: string;
  graphs: Record<string, GraphData>;
  merged: SubgraphData;
  height?: number;
}

function canonicalDatasetFor(merged: SubgraphData, logicalId: string): string | null {
  return merged.nodes.find((n) => n.id === logicalId)?.dataset ?? null;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function animateNodes(
  nodes: cytoscape.NodeSingular[],
  targetFor: (node: cytoscape.NodeSingular) => { x: number; y: number } | null,
  duration: number,
  signal: { cancelled: boolean }
): Promise<void> {
  const moves = nodes
    .map((node) => {
      const target = targetFor(node);
      if (!target) return null;
      const start = { ...node.position() };
      if (Math.hypot(start.x - target.x, start.y - target.y) < 1) return null;
      return { node, start, target };
    })
    .filter(Boolean) as {
    node: cytoscape.NodeSingular;
    start: { x: number; y: number };
    target: { x: number; y: number };
  }[];

  if (moves.length === 0) return Promise.resolve();

  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (now: number) => {
      if (signal.cancelled) {
        resolve();
        return;
      }
      const t = Math.min(1, (now - t0) / duration);
      const e = easeInOutCubic(t);
      for (const { node, start, target } of moves) {
        node.position({
          x: start.x + (target.x - start.x) * e,
          y: start.y + (target.y - start.y) * e,
        });
      }
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

function logicalEdgeKey(source: string, target: string, label: string): string {
  return `${source}|${target}|${label}`;
}

function buildCyToMergeTarget(
  nodeElements: cytoscape.ElementDefinition[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const el of nodeElements) {
    const d = el.data as Record<string, unknown>;
    map.set(d.id as string, d.mergeTargetId as string);
  }
  return map;
}

function appendPromotedMergedEdges(
  edgeElements: cytoscape.ElementDefinition[],
  cyToMergeTarget: Map<string, string>,
  merged: SubgraphData,
  cyNodeRecords: {
    id: string;
    logicalId: string;
    mergeTargetId: string;
    dataset: string;
    isDuplicate?: boolean;
  }[],
  joinEdgeKeys: Set<string>,
  existingKeys: Set<string>
): void {
  let promo = 0;
  for (const el of edgeElements) {
    const d = el.data as Record<string, unknown>;
    if (d.phase !== "separated") continue;

    const srcLogical = cyToMergeTarget.get(d.source as string);
    const tgtLogical = cyToMergeTarget.get(d.target as string);
    if (!srcLogical || !tgtLogical) continue;

    const srcCanon = canonicalCyNodeId(srcLogical, merged, cyNodeRecords);
    const tgtCanon = canonicalCyNodeId(tgtLogical, merged, cyNodeRecords);
    if (!srcCanon || !tgtCanon) continue;

    const label = String(d.label ?? "");
    const key = logicalEdgeKey(srcLogical, tgtLogical, label);
    if (existingKeys.has(key)) continue;

    existingKeys.add(key);
    edgeElements.push({
      data: {
        id: `merged-promo-${promo}`,
        source: srcCanon,
        target: tgtCanon,
        label,
        phase: "merged",
        isJoin: joinEdgeKeys.has(key),
      },
    });
    promo += 1;
  }
}

function buildExtendedMergedLayout(
  merged: SubgraphData,
  nodeElements: cytoscape.ElementDefinition[],
  edgeElements: cytoscape.ElementDefinition[],
  cyToMergeTarget: Map<string, string>
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodesById = new Map(merged.nodes.map((n) => [n.id, n]));
  const edges = [...merged.edges];
  const edgeKeys = new Set(edges.map((e) => logicalEdgeKey(e.source, e.target, e.label)));

  for (const el of nodeElements) {
    const d = el.data as Record<string, unknown>;
    if (d.isDuplicate) continue;
    const mt = d.mergeTargetId as string;
    const nodeType = String(d.type ?? "Resource");
    if (
      nodeType === "pi:Intervento_di_investimento_pubblico" &&
      [...nodesById.values()].some((n) => n.type === "pi:Intervento_di_investimento_pubblico")
    ) {
      continue;
    }
    if (nodesById.has(mt)) continue;
    nodesById.set(mt, {
      id: mt,
      shortId: String(d.logicalId ?? mt),
      label: String(d.fullLabel ?? d.label ?? mt),
      type: String(d.type ?? "Resource"),
      dataset: String(d.dataset ?? "shared"),
    });
  }

  for (const el of edgeElements) {
    const d = el.data as Record<string, unknown>;
    if (d.phase !== "merged") continue;
    const srcLogical = cyToMergeTarget.get(d.source as string);
    const tgtLogical = cyToMergeTarget.get(d.target as string);
    if (!srcLogical || !tgtLogical) continue;
    const label = String(d.label ?? "");
    const key = logicalEdgeKey(srcLogical, tgtLogical, label);
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    edges.push({ source: srcLogical, target: tgtLogical, label });
  }

  return { nodes: [...nodesById.values()], edges };
}

function applySeparatedView(cy: Core): void {
  cy.nodes().removeClass("dup-hidden");
  cy.edges('[phase = "separated"]').style("opacity", 1);
  cy.edges('[phase = "merged"]').style("opacity", 0);
}

function applyMergedView(cy: Core): void {
  cy.edges('[phase = "separated"]').style("opacity", 0);
  cy.edges('[phase = "merged"][?isJoin]').style("opacity", 1);
  cy.edges('[phase = "merged"][!isJoin]').style("opacity", 0.45);
  cy.nodes().forEach((node) => {
    if (node.data("isDuplicate")) node.addClass("dup-hidden");
    else node.removeClass("dup-hidden");
  });
}

function idealEdgeLength(edge: EdgeSingular): number {
  const label = String(edge.data("label") ?? "");
  const lines = Math.max(1, Math.ceil(label.length / 18));
  const labelRoom = Math.min(180, lines * 38 + label.length * 1.4);
  return 72 + labelRoom;
}

function saveSeparatedSnapshot(
  cy: Core,
  snapshot: Map<string, { x: number; y: number }>
): void {
  snapshot.clear();
  cy.nodes().forEach((node) => {
    const p = node.position();
    snapshot.set(node.id(), { x: p.x, y: p.y });
  });
}

function applySeparatedSnapshot(
  cy: Core,
  snapshot: Map<string, { x: number; y: number }>
): void {
  cy.nodes().forEach((node) => {
    const target = separatedTargetFor(node, snapshot);
    if (target) node.position(target);
  });
}

function separatedTargetFor(
  node: cytoscape.NodeSingular,
  snapshot: Map<string, { x: number; y: number }>
): { x: number; y: number } | null {
  const fromSnapshot = snapshot.get(node.id());
  if (fromSnapshot) return fromSnapshot;
  const x = node.data("separatedX") as number;
  const y = node.data("separatedY") as number;
  if (typeof x === "number" && typeof y === "number") return { x, y };
  return null;
}

function fitSeparatedView(cy: Core): void {
  cy.fit(undefined, MERGE_SEPARATED_FIT_PADDING);
}

function revealSeparatedLayout(cy: Core): void {
  cy.resize();
  fitSeparatedView(cy);
}

function runForceLayout(
  eles: Collection,
  randomize: boolean,
  fixedNodeConstraint: { nodeId: string; x: number; y: number }[] = []
): Promise<void> {
  const nodeCount = eles.nodes().length;
  const scale = nodeCount > 20 ? 1.15 : 1;

  return new Promise((resolve) => {
    const layout = eles.layout({
      name: "fcose",
      fit: false,
      animate: false,
      randomize,
      quality: "proof",
      nodeDimensionsIncludeLabels: true,
      uniformNodeDimensions: false,
      packComponents: false,
      nodeSeparation: 95 * scale,
      nodeRepulsion: () => 8500 * scale,
      idealEdgeLength,
      edgeElasticity: () => 0.42,
      nestingFactor: 0.1,
      gravity: 0.18,
      numIter: nodeCount > 30 ? 3500 : 2800,
      padding: 48,
      tile: false,
      fixedNodeConstraint,
    } as LayoutOptions);
    layout.on("layoutstop", () => resolve());
    layout.run();
  });
}

async function layoutSeparatedQuadrants(cy: Core, cupCode: string): Promise<void> {
  const cupUri = cupCodeToUri(cupCode);
  for (const dataset of MERGE_DATASETS) {
    const nodes = cy.nodes(`[dataset = "${dataset}"]`);
    if (nodes.length < 2) continue;

    const fixedNodeConstraint: { nodeId: string; x: number; y: number }[] = [];

    const anchor = nodes.filter((n) => n.data("isMergeAnchor"));
    if (anchor.length > 0) {
      const a = anchor[0];
      fixedNodeConstraint.push({
        nodeId: a.id(),
        x: a.data("separatedX") as number,
        y: a.data("separatedY") as number,
      });
    }

    const cupNodes = nodes.filter((n) => n.data("logicalId") === cupUri);
    if (cupNodes.length > 0 && !cupNodes[0].data("isMergeAnchor")) {
      fixedNodeConstraint.push({
        nodeId: cupNodes[0].id(),
        x: cupNodes[0].data("separatedX") as number,
        y: cupNodes[0].data("separatedY") as number,
      });
    }

    const subgraph = nodes.union(nodes.connectedEdges());
    await runForceLayout(subgraph, false, fixedNodeConstraint);

    for (const c of fixedNodeConstraint) {
      cy.getElementById(c.nodeId).position({ x: c.x, y: c.y });
    }
  }
}

function layoutMergedGraph(cy: Core): Promise<void> {
  const visible = cy.nodes().not(".dup-hidden");
  const mergedEdges = cy.edges('[phase = "merged"]');
  const subgraph = visible.union(mergedEdges);
  if (subgraph.nodes().length === 0) return Promise.resolve();
  return runForceLayout(subgraph, false).then(() => {
    if (!visible.empty()) cy.fit(visible, 70);
  });
}

export function MergeAnimationGraph({
  cupCode,
  graphs,
  merged,
  height = 680,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const phaseRef = useRef<Phase>("separated");
  const animSignalRef = useRef({ cancelled: false });
  const mergedLayoutRef = useRef<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const separatedSnapshotRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const layoutGenRef = useRef(0);
  const [phase, setPhase] = useState<Phase>("separated");
  const [separatedLayoutReady, setSeparatedLayoutReady] = useState(false);

  const setPhaseSafe = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const joinEdgeKeys = useMemo(
    () => new Set(merged.join_edges.map((e) => `${e.source}|${e.target}|${e.label}`)),
    [merged.join_edges]
  );
  const joinNodeIds = useMemo(
    () => joinNodeIdsFromEdges(merged.join_edges),
    [merged.join_edges]
  );

  const runMergeAnimation = useCallback(() => {
    const cy = cyRef.current;
    if (!cy || phaseRef.current === "merging") return;

    layoutGenRef.current += 1;
    animSignalRef.current.cancelled = true;
    animSignalRef.current = { cancelled: false };
    const signal = animSignalRef.current;

    const layoutGraph = mergedLayoutRef.current ?? {
      nodes: merged.nodes,
      edges: merged.edges,
    };
    const mergedPos = hubRadialPositions(layoutGraph.nodes, layoutGraph.edges, 0, 0, 1.35);
    setPhaseSafe("merging");
    applySeparatedView(cy);

    void animateNodes(
      cy.nodes().toArray(),
      (node) => {
        const mergeTargetId = node.data("mergeTargetId") as string;
        return mergedPos.get(mergeTargetId) ?? null;
      },
      1100,
      signal
    )
      .then(() => {
        if (signal.cancelled) return;
        applyMergedView(cy);
        return layoutMergedGraph(cy);
      })
      .then(() => {
        if (signal.cancelled) return;
        setPhaseSafe("merged");
      })
      .catch(() => {
        if (!signal.cancelled) setPhaseSafe("merged");
      });
  }, [merged]);

  const runSeparateAnimation = useCallback(() => {
    const cy = cyRef.current;
    if (!cy || phaseRef.current === "merging") return;

    layoutGenRef.current += 1;
    animSignalRef.current.cancelled = true;
    animSignalRef.current = { cancelled: false };
    const signal = animSignalRef.current;
    const snapshot = separatedSnapshotRef.current;

    setPhaseSafe("merging");
    cy.nodes().removeClass("dup-hidden");
    applySeparatedView(cy);

    void animateNodes(
      cy.nodes().toArray(),
      (node) => separatedTargetFor(node, snapshot),
      1100,
      signal
    )
      .then(() => {
        if (signal.cancelled) return;
        applySeparatedSnapshot(cy, snapshot);
        applySeparatedView(cy);
        revealSeparatedLayout(cy);
      })
      .finally(() => {
        if (!signal.cancelled) setPhaseSafe("separated");
      });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    setSeparatedLayoutReady(false);
    animSignalRef.current.cancelled = true;
    animSignalRef.current = { cancelled: false };

    const nodeElements: cytoscape.ElementDefinition[] = [];
    const edgeElements: cytoscape.ElementDefinition[] = [];
    const mergeTargetCounts = new Map<string, number>();
    const slices = new Map<
      string,
      { nodes: GraphNode[]; edges: GraphEdge[] }
    >();

    for (const dataset of MERGE_DATASETS) {
      const graph = graphs[dataset];
      if (!graph) continue;
      const slice = extractDatasetCupSlice(graph, merged, cupCode);
      slices.set(dataset, slice);
      for (const n of slice.nodes) {
        const mergeTargetId = resolveMergeTargetId(
          n,
          dataset,
          merged,
          cupCode,
          slice.edges
        );
        mergeTargetCounts.set(
          mergeTargetId,
          (mergeTargetCounts.get(mergeTargetId) ?? 0) + 1
        );
      }
    }

    for (const dataset of MERGE_DATASETS) {
      const slice = slices.get(dataset);
      if (!slice) continue;
      const offset = MERGE_QUADRANTS[dataset];
      const anchorId = pickMergeAnchorId(
        slice.nodes,
        slice.edges,
        dataset,
        merged,
        cupCode,
        joinNodeIds,
        mergeTargetCounts
      );
      const localPos = quadrantSeparatedPositions(
        slice.nodes,
        slice.edges,
        offset.x,
        offset.y,
        cupCode,
        anchorId
      );

      for (const n of slice.nodes) {
        const cyId = makeCyNodeId(dataset, n.id);
        const mergeTargetId = resolveMergeTargetId(
          n,
          dataset,
          merged,
          cupCode,
          slice.edges
        );
        mergeTargetCounts.set(mergeTargetId, (mergeTargetCounts.get(mergeTargetId) ?? 0) + 1);

        const p = localPos.get(n.id) ?? offset;
        const position = { x: p.x, y: p.y };
        const canonicalDataset = canonicalDatasetFor(merged, mergeTargetId);
        const { accent, fill } = nodeColors(dataset, n.type);
        const isMergeAnchor = n.id === anchorId;

        nodeElements.push({
          data: {
            id: cyId,
            logicalId: n.id,
            mergeTargetId,
            separatedX: position.x,
            separatedY: position.y,
            canonicalDataset,
            label: graphNodeDisplayLabel(n.label, n.type),
            type: n.type,
            dataset,
            accentColor: accent,
            fillColor: fill,
            isCompact: COMPACT_NODE_TYPES.has(n.type),
            isJoinNode:
              isMergeAnchor ||
              joinNodeIds.has(n.id) ||
              joinNodeIds.has(mergeTargetId),
            isMergeAnchor,
            isDuplicate: false,
          },
          position,
        });
      }

      slice.edges.forEach((e, i) => {
        const source = makeCyNodeId(dataset, e.source);
        const target = makeCyNodeId(dataset, e.target);
        edgeElements.push({
          data: {
            id: `sep-${dataset}-${i}`,
            source,
            target,
            label: normalizeDisplayText(e.label),
            phase: "separated",
            isJoin: false,
          },
        });
      });
    }

    for (const el of nodeElements) {
      const d = el.data as Record<string, unknown>;
      const mt = d.mergeTargetId as string;
      const canonical = d.canonicalDataset as string | null;
      const ds = d.dataset as string;
      d.isDuplicate =
        (mergeTargetCounts.get(mt) ?? 0) > 1 && canonical !== null && ds !== canonical;
    }

    const cyNodeIds = new Set(
      nodeElements.map((el) => (el.data as Record<string, unknown>).id as string)
    );
    for (let i = edgeElements.length - 1; i >= 0; i -= 1) {
      const d = edgeElements[i].data as Record<string, unknown>;
      if (d.phase !== "separated") continue;
      if (!cyNodeIds.has(d.source as string) || !cyNodeIds.has(d.target as string)) {
        edgeElements.splice(i, 1);
      }
    }

    const cyNodeRecords = nodeElements.map((el) => {
      const d = el.data as Record<string, unknown>;
      return {
        id: d.id as string,
        logicalId: d.logicalId as string,
        mergeTargetId: d.mergeTargetId as string,
        dataset: d.dataset as string,
        isDuplicate: Boolean(d.isDuplicate),
      };
    });

    const mergedEdgeKeys = new Set<string>();
    merged.edges.forEach((e, i) => {
      const source = canonicalCyNodeId(e.source, merged, cyNodeRecords);
      const target = canonicalCyNodeId(e.target, merged, cyNodeRecords);
      if (!source || !target) return;
      const key = logicalEdgeKey(e.source, e.target, e.label);
      mergedEdgeKeys.add(key);
      edgeElements.push({
        data: {
          id: `merged-${i}`,
          source,
          target,
          label: normalizeDisplayText(e.label),
          phase: "merged",
          isJoin: joinEdgeKeys.has(key),
        },
      });
    });

    appendPromotedMergedEdges(
      edgeElements,
      buildCyToMergeTarget(nodeElements),
      merged,
      cyNodeRecords,
      joinEdgeKeys,
      mergedEdgeKeys
    );

    const cyToMergeTarget = buildCyToMergeTarget(nodeElements);
    mergedLayoutRef.current = buildExtendedMergedLayout(
      merged,
      nodeElements,
      edgeElements,
      cyToMergeTarget
    );

    setPhaseSafe("separated");

    cyRef.current?.destroy();
    const cy = cytoscape({
      container: containerRef.current,
      minZoom: 0.12,
      maxZoom: 2.5,
      elements: [...nodeElements, ...edgeElements],
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "background-color": "data(fillColor)",
            "border-color": "data(accentColor)",
            color: "#1e293b",
            "font-weight": 500,
            "text-outline-width": 0,
            "font-size": "10px",
            "font-family": GRAPH_FONT_FAMILY,
            "text-wrap": "wrap",
            "text-valign": "center",
            "text-halign": "center",
            "border-width": 2,
            ...Z_INDEX_MANUAL,
            "z-index": 1,
            "transition-property": "opacity",
            "transition-duration": 300,
          },
        },
        {
          selector: "node[?isCompact]",
          style: { ...NODE_SHADOW_COMPACT },
        },
        {
          selector: "node[!isCompact]",
          style: { ...NODE_SHADOW_BOX },
        },
        {
          selector: "node.dup-hidden",
          style: {
            opacity: 0,
            "events": "no",
            "z-index": 0,
          },
        },
        {
          selector: "node[?isCompact]",
          style: { shape: "ellipse", width: 72, height: 72, "text-max-width": "64px" },
        },
        {
          selector: "node[!isCompact]",
          style: {
            shape: "round-rectangle",
            width: "label",
            height: "label",
            padding: "12px",
            "corner-radius": "8",
            "text-max-width": "100px",
          },
        },
        {
          selector: "node[?isJoinNode][?isCompact]",
          style: JOIN_NODE_STYLE_COMPACT,
        },
        {
          selector: "node[?isJoinNode][!isCompact]",
          style: JOIN_NODE_STYLE_BOX,
        },
        {
          selector: 'edge[phase = "separated"]',
          style: {
            ...Z_INDEX_MANUAL,
            ...EDGE_LABEL_VISIBLE,
            ...EDGE_LINE_BASE,
            opacity: 1,
            "z-index": 100,
          },
        },
        {
          selector: 'edge[phase = "merged"][!isJoin]',
          style: {
            ...EDGE_LABEL_VISIBLE,
            ...EDGE_LINE_BASE,
            width: 1.5,
            opacity: 0,
            "z-index": 80,
          },
        },
        {
          selector: 'edge[phase = "merged"][?isJoin]',
          style: {
            ...EDGE_LABEL_VISIBLE,
            ...EDGE_LINE_BASE,
            width: 2.25,
            "line-color": "#f87171",
            "target-arrow-color": "#f87171",
            color: "#b91c1c",
            "text-background-color": "#fff1f2",
            "text-border-color": "#fecdd3",
            opacity: 0,
            "z-index": 140,
          },
        },
      ],
    });

    applySeparatedView(cy);
    cyRef.current = cy;

    const layoutGen = ++layoutGenRef.current;
    separatedSnapshotRef.current.clear();
    void layoutSeparatedQuadrants(cy, cupCode).then(() => {
      if (layoutGen !== layoutGenRef.current || cy.destroyed()) return;
      saveSeparatedSnapshot(cy, separatedSnapshotRef.current);
      revealSeparatedLayout(cy);
      setSeparatedLayoutReady(true);
    });

    return () => {
      animSignalRef.current.cancelled = true;
      cy.destroy();
      cyRef.current = null;
    };
  }, [cupCode, graphs, merged, joinEdgeKeys, joinNodeIds]);

  const duplicateCount = useMemo(() => {
    const byLogical = new Map<string, number>();
    for (const dataset of MERGE_DATASETS) {
      const graph = graphs[dataset];
      if (!graph) continue;
      for (const n of extractDatasetCupSlice(graph, merged, cupCode).nodes) {
        byLogical.set(n.id, (byLogical.get(n.id) ?? 0) + 1);
      }
    }
    return [...byLogical.values()].filter((c) => c > 1).length;
  }, [graphs, merged, cupCode]);

  return (
    <div className="merge-animation-wrap">
      <div className="graph-toolbar merge-toolbar">
        <button
          type="button"
          className="graph-toolbar-btn"
          disabled={!separatedLayoutReady || phase === "merging" || phase === "merged"}
          onClick={runMergeAnimation}
        >
          Unisci grafi
        </button>
        <button
          type="button"
          className="graph-toolbar-btn"
          disabled={!separatedLayoutReady || phase === "merging" || phase === "separated"}
          onClick={runSeparateAnimation}
        >
          Separa grafi
        </button>
        <button
          type="button"
          className="graph-toolbar-btn"
          onClick={() => {
            const cy = cyRef.current;
            if (!cy) return;
            if (phaseRef.current === "merged") {
              const visible = cy.nodes().not(".dup-hidden");
              cy.fit(visible.empty() ? undefined : visible, 70);
            } else {
              fitSeparatedView(cy);
            }
          }}
        >
          Inquadra tutto
        </button>
        <span className="merge-phase-label">
          {phase === "separated" &&
            "Vista separata — nodo di fusione al centro di ogni riquadro, CUP verso il centro"}
          {phase === "merging" && "Animazione in corso…"}
          {phase === "merged" &&
            "Vista unita — un nodo per URI, join rossi, duplicati nascosti"}
        </span>
      </div>

      <div
        className={`merge-canvas-shell${separatedLayoutReady ? "" : " merge-canvas-shell--layouting"}`}
        style={{ height }}
      >
        {!separatedLayoutReady && (
          <p className="merge-canvas-layout-status" aria-live="polite">
            Layout grafi in corso…
          </p>
        )}
        <div
          className={`merge-quadrant-labels${phase === "merged" ? " merge-quadrant-labels--hidden" : ""}`}
          aria-hidden
        >
          {MERGE_DATASETS.map((ds) => (
            <span
              key={ds}
              className={`merge-q-label merge-q-${ds}`}
              style={{ borderColor: DATASET_COLORS[ds] }}
            >
              {DATASET_LABELS[ds]}
            </span>
          ))}
        </div>
        <div ref={containerRef} className="cytoscape-canvas merge-canvas" style={{ height: "100%" }} />
      </div>

      <p className="stats merge-stats">
        {duplicateCount} URI condivisi tra dataset · {merged.join_edges.length} join
        semantici evidenziati in rosso
      </p>
    </div>
  );
}
