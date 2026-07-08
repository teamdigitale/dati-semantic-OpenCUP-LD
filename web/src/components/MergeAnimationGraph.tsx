import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { Core } from "cytoscape";
import { GraphData, SubgraphData } from "../types";
import { DATASET_COLORS, DATASET_LABELS, TYPE_COLORS } from "../constants";
import {
  MERGE_DATASETS,
  MERGE_QUADRANTS,
  buildLogicalToCyMap,
  extractDatasetCupSlice,
  hubRadialPositions,
  joinNodeIdsFromEdges,
  makeCyNodeId,
  resolveMergedCyEndpoints,
} from "../utils/graphCup";
import { JOIN_NODE_STYLE_BOX, JOIN_NODE_STYLE_COMPACT } from "../utils/graphStyles";
import { GRAPH_FONT_FAMILY, normalizeDisplayText } from "../utils/text";

const COMPACT_NODE_TYPES = new Set([
  "pi:Progetto_di_investimento_pubblico",
  "PCTR:Lot",
  "Literal",
]);

const EDGE_LABEL_STYLE = {
  "font-size": "8px",
  "font-family": GRAPH_FONT_FAMILY,
  "text-rotation": "autorotate",
  "text-wrap": "wrap",
  "text-max-width": "100px",
  "text-margin-y": 10,
  color: "#1e293b",
  "text-background-color": "#ffffff",
  "text-background-opacity": 1,
  "text-background-padding": "3px",
  "text-background-shape": "roundrectangle",
} as const;

type Phase = "separated" | "merging" | "merged";

interface Props {
  cupCode: string;
  graphs: Record<string, GraphData>;
  merged: SubgraphData;
  height?: number;
}

function shortNodeLabel(label: string, type: string): string {
  const text = normalizeDisplayText(label);
  if (type === "pi:Progetto_di_investimento_pubblico") return text;
  if (text.length > 36) return `${text.slice(0, 34)}…`;
  return text;
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

function canonicalDatasetFor(merged: SubgraphData, logicalId: string): string | null {
  return merged.nodes.find((n) => n.id === logicalId)?.dataset ?? null;
}

function applySeparatedView(cy: Core): void {
  cy.nodes().removeClass("dup-hidden");
  cy.edges('[phase = "separated"]').style("opacity", 1);
  cy.edges('[phase = "merged"]').style("opacity", 0);
}

function applyMergedView(cy: Core): void {
  cy.edges('[phase = "separated"]').style("opacity", 0);
  cy.edges('[phase = "merged"][?isJoin]').style("opacity", 1);
  cy.edges('[phase = "merged"][!isJoin]').style("opacity", 0.35);
  cy.nodes().forEach((node) => {
    if (node.data("isDuplicate")) node.addClass("dup-hidden");
    else node.removeClass("dup-hidden");
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
      const visible = cy.nodes().not(".dup-hidden");
      if (!visible.empty()) cy.fit(visible, 70);
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

        nodeElements.push({
          data: {
            id: cyId,
            logicalId: n.id,
            mergeTargetId,
            separatedX: position.x,
            separatedY: position.y,
            canonicalDataset,
            label: shortNodeLabel(n.label, n.type),
            type: n.type,
            dataset,
            color: DATASET_COLORS[dataset] ?? TYPE_COLORS[n.type] ?? "#94a3b8",
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

    merged.edges.forEach((e, i) => {
      const endpoints = resolveMergedCyEndpoints(e, logicalToCy, cyNodeIds);
      if (!endpoints) return;
      edgeElements.push({
        data: {
          id: `merged-${i}`,
          source: endpoints.source,
          target: endpoints.target,
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
            "background-color": "data(color)",
            color: "#ffffff",
            "text-outline-color": "#1e293b",
            "text-outline-width": 1.5,
            "font-size": "9px",
            "font-family": GRAPH_FONT_FAMILY,
            "text-wrap": "wrap",
            "text-valign": "center",
            "text-halign": "center",
            "border-width": 2,
            "border-color": "#1e40af",
            "z-index": 1,
            "transition-property": "opacity",
            "transition-duration": 300,
          },
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
            label: "data(label)",
            "curve-style": "bezier",
            "edge-distances": "intersection",
            "target-arrow-shape": "triangle",
            width: 2,
            "line-color": "#94a3b8",
            "target-arrow-color": "#94a3b8",
            opacity: 1,
            "z-index": 50,
            ...EDGE_LABEL_STYLE,
          },
        },
        {
          selector: 'edge[phase = "merged"][!isJoin]',
          style: {
            "curve-style": "bezier",
            "edge-distances": "intersection",
            "target-arrow-shape": "triangle",
            width: 1.5,
            "line-color": "#cbd5e1",
            "target-arrow-color": "#cbd5e1",
            opacity: 0,
            "z-index": 80,
          },
        },
        {
          selector: 'edge[phase = "merged"][?isJoin]',
          style: {
            label: "data(label)",
            "curve-style": "bezier",
            "edge-distances": "intersection",
            "target-arrow-shape": "triangle",
            width: 3,
            "line-color": "#dc2626",
            "target-arrow-color": "#dc2626",
            opacity: 0,
            "z-index": 140,
            "font-size": "8px",
            "text-rotation": "autorotate",
            "text-wrap": "wrap",
            "text-max-width": "100px",
            "text-margin-y": 10,
            color: "#b91c1c",
            "text-background-color": "#fff1f2",
            "text-background-opacity": 1,
            "text-background-padding": "3px",
            "text-background-shape": "roundrectangle",
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
          {phase === "separated" && "Vista separata — 4 dataset in quadranti"}
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
        <div ref={containerRef} className="cytoscape-canvas merge-canvas" />
      </div>

      <p className="stats merge-stats">
        {duplicateCount} URI condivisi tra dataset · {merged.join_edges.length} join
        semantici evidenziati in rosso
      </p>
    </div>
  );
}
