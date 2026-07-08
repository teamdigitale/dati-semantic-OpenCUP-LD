import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { Collection, Core, EdgeSingular, LayoutOptions } from "cytoscape";
import fcose from "cytoscape-fcose";
import { GraphData, SubgraphData } from "../types";
import { DATASET_COLORS, DATASET_FILLS, DATASET_LABELS, TYPE_COLORS, TYPE_FILLS } from "../constants";
import {
  MERGE_DATASETS,
  MERGE_QUADRANTS,
  buildLogicalToCyMap,
  extractDatasetCupSlice,
  hubRadialPositions,
  joinNodeIdsFromEdges,
  makeCyNodeId,
} from "../utils/graphCup";
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
  return {
    accent: DATASET_COLORS[dataset] ?? TYPE_COLORS[type] ?? "#64748b",
    fill: DATASET_FILLS[dataset] ?? TYPE_FILLS[type] ?? "#ffffff",
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

function runForceLayout(eles: Collection, randomize: boolean): Promise<void> {
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
    } as LayoutOptions);
    layout.on("layoutstop", () => resolve());
    layout.run();
  });
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
  const [phase, setPhase] = useState<Phase>("separated");

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

    animSignalRef.current.cancelled = true;
    animSignalRef.current = { cancelled: false };
    const signal = animSignalRef.current;

    const mergedPos = hubRadialPositions(merged.nodes, merged.edges, 0, 0, 1.35);
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
    ).then(() => {
      if (signal.cancelled) return;
      applyMergedView(cy);
      return layoutMergedGraph(cy);
    }).then(() => {
      if (signal.cancelled) return;
      setPhaseSafe("merged");
    });
  }, [merged]);

  const runSeparateAnimation = useCallback(() => {
    const cy = cyRef.current;
    if (!cy || phaseRef.current === "merging") return;

    animSignalRef.current.cancelled = true;
    animSignalRef.current = { cancelled: false };
    const signal = animSignalRef.current;

    setPhaseSafe("merging");
    cy.nodes().removeClass("dup-hidden");
    applySeparatedView(cy);

    void animateNodes(
      cy.nodes().toArray(),
      (node) => {
        const x = node.data("separatedX") as number;
        const y = node.data("separatedY") as number;
        if (typeof x !== "number" || typeof y !== "number") return null;
        return { x, y };
      },
      1100,
      signal
    ).then(() => {
      if (signal.cancelled) return;
      cy.fit(undefined, 55);
      setPhaseSafe("separated");
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    animSignalRef.current.cancelled = true;
    animSignalRef.current = { cancelled: false };

    const nodeElements: cytoscape.ElementDefinition[] = [];
    const edgeElements: cytoscape.ElementDefinition[] = [];
    const cyNodeIds = new Set<string>();
    const logicalToCy = buildLogicalToCyMap(graphs, merged, cupCode);

    const mergeTargetForCy = (cyId: string, sliceLogicalId: string): string => {
      for (const [mergedLogical, mappedCy] of logicalToCy) {
        if (mappedCy === cyId) return mergedLogical;
      }
      return sliceLogicalId;
    };

    const mergeTargetCounts = new Map<string, number>();

    for (const dataset of MERGE_DATASETS) {
      const graph = graphs[dataset];
      if (!graph) continue;
      const slice = extractDatasetCupSlice(graph, merged, cupCode);
      const localPos = hubRadialPositions(slice.nodes, slice.edges, 0, 0, 1.1);
      const offset = MERGE_QUADRANTS[dataset];

      for (const n of slice.nodes) {
        const cyId = makeCyNodeId(dataset, n.id);
        const mergeTargetId = mergeTargetForCy(cyId, n.id);
        mergeTargetCounts.set(mergeTargetId, (mergeTargetCounts.get(mergeTargetId) ?? 0) + 1);

        cyNodeIds.add(cyId);
        const p = localPos.get(n.id) ?? { x: 0, y: 0 };
        const position = { x: p.x + offset.x, y: p.y + offset.y };
        const canonicalDataset = canonicalDatasetFor(merged, mergeTargetId);
        const { accent, fill } = nodeColors(dataset, n.type);

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
              joinNodeIds.has(n.id) || joinNodeIds.has(mergeTargetId),
            isDuplicate: false,
          },
          position,
        });
      }

      slice.edges.forEach((e, i) => {
        const source = makeCyNodeId(dataset, e.source);
        const target = makeCyNodeId(dataset, e.target);
        if (!cyNodeIds.has(source) || !cyNodeIds.has(target)) return;
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

    const canonicalCyByLogical = new Map<string, string>();
    for (const el of nodeElements) {
      const d = el.data as Record<string, unknown>;
      if (d.isDuplicate) continue;
      canonicalCyByLogical.set(d.mergeTargetId as string, d.id as string);
    }

    merged.edges.forEach((e, i) => {
      const source = canonicalCyByLogical.get(e.source);
      const target = canonicalCyByLogical.get(e.target);
      if (!source || !target) return;
      edgeElements.push({
        data: {
          id: `merged-${i}`,
          source,
          target,
          label: normalizeDisplayText(e.label),
          phase: "merged",
          isJoin: joinEdgeKeys.has(`${e.source}|${e.target}|${e.label}`),
        },
      });
    });

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

    cy.fit(undefined, 55);
    cyRef.current = cy;

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
          disabled={phase === "merging" || phase === "merged"}
          onClick={runMergeAnimation}
        >
          Unisci grafi
        </button>
        <button
          type="button"
          className="graph-toolbar-btn"
          disabled={phase === "merging" || phase === "separated"}
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
              cy.fit(undefined, 55);
            }
          }}
        >
          Inquadra tutto
        </button>
        <span className="merge-phase-label">
          {phase === "separated" && "Vista separata — quattro dataset nei rispettivi quadranti"}
          {phase === "merging" && "Animazione in corso…"}
          {phase === "merged" &&
            "Vista unita — un nodo per URI, join rossi, duplicati nascosti"}
        </span>
      </div>

      <div className="merge-canvas-shell" style={{ height }}>
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
