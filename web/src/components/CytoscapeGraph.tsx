import { useCallback, useEffect, useRef, useState } from "react";
import cytoscape, { Collection, Core, EdgeSingular, LayoutOptions, NodeSingular } from "cytoscape";
import fcose from "cytoscape-fcose";
import { GraphData, GraphNode, SubgraphData } from "../types";
import { DATASET_COLORS, DATASET_FILLS, DATASET_LABELS, TYPE_COLORS, TYPE_FILLS } from "../constants";
import { resolveHref } from "../utils/uri";
import { joinNodeIdsFromEdges } from "../utils/graphCup";
import { graphNodeDisplayLabel } from "../utils/graphLabels";
import { GRAPH_FONT_FAMILY, normalizeDisplayText } from "../utils/text";
import {
  EDGE_LABEL_VISIBLE,
  EDGE_LINE_BASE,
  JOIN_NODE_STYLE_BOX,
  JOIN_NODE_STYLE_COMPACT,
  NODE_SHADOW_BOX,
  NODE_SHADOW_COMPACT,
  Z_INDEX_MANUAL,
} from "../utils/graphStyles";
import { ResourceLink } from "./ResourceLink";

cytoscape.use(fcose);

interface Props {
  data: GraphData | SubgraphData;
  highlightJoin?: boolean;
  height?: number;
}

const MIN_ZOOM = 0.5;
const FOCUS_MIN_ZOOM = 0.05;
const FOCUS_PADDING = 80;
const FIT_PADDING = 45;
const PACK_GAP_X = 100;
const PACK_GAP_Y = 90;
const PACK_MAX_ROW_W = 1400;

const COMPACT_NODE_TYPES = new Set([
  "pi:Progetto_di_investimento_pubblico",
  "PCTR:Lot",
  "Literal",
]);

function isCompactNode(type: string): boolean {
  return COMPACT_NODE_TYPES.has(type);
}

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

function clearFocus(cy: Core): void {
  cy.elements().removeClass("dimmed focused");
}

function enforceMinZoom(cy: Core): void {
  cy.fit(cy.elements(), FIT_PADDING);
  if (cy.zoom() < MIN_ZOOM) {
    cy.zoom(MIN_ZOOM);
    cy.center();
  }
}

/** Lunghezza ideale dell'arco: spazio per etichetta relazione + dimensioni nodi. */
function idealEdgeLength(edge: EdgeSingular): number {
  const label = String(edge.data("label") ?? "");
  const lines = Math.max(1, Math.ceil(label.length / 18));
  const labelRoom = Math.min(180, lines * 38 + label.length * 1.4);
  return 72 + labelRoom;
}

/** Layout a forze (stile ForceAtlas): repulsione + dimensioni reali dei nodi. */
function buildForceLayout(comp: Collection): LayoutOptions {
  const nodeCount = comp.nodes().length;
  const scale = nodeCount > 24 ? 1.2 : nodeCount > 12 ? 1.1 : 1;

  return {
    name: "fcose",
    eles: comp,
    fit: false,
    animate: false,
    randomize: true,
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
    numIter: nodeCount > 40 ? 4000 : 2800,
    padding: 48,
    tile: false,
  } as LayoutOptions;
}

function layoutComponent(comp: Collection, cx: number, cellY: number, onDone: () => void): void {
  const layout = comp.layout(buildForceLayout(comp));
  layout.on("layoutstop", () => {
    centerComponent(comp, cx, cellY);
    onDone();
  });
  layout.run();
}

function centerComponent(comp: Collection, cx: number, cellY: number): void {
  const bb = comp.boundingBox();
  const dx = cx - (bb.x1 + bb.w / 2);
  const dy = cellY - (bb.y1 + bb.h / 2);
  comp.nodes().forEach((n) => {
    const p = n.position();
    n.position({ x: p.x + dx, y: p.y + dy });
  });
}

function finishLayout(cy: Core): void {
  enforceMinZoom(cy);
}

function layoutByComponents(cy: Core): void {
  const components = cy.elements().components();
  if (components.length === 0) return;

  if (components.length === 1) {
    layoutComponent(components[0], 0, 0, () => finishLayout(cy));
    return;
  }

  let index = 0;
  let packX = 0;
  let packY = 0;
  let rowH = 0;

  const layoutNext = (): void => {
    if (index >= components.length) {
      finishLayout(cy);
      return;
    }
    const comp = components[index];
    index += 1;
    layoutComponent(comp, 0, 0, () => {
      const bb = comp.boundingBox();
      if (packX > 0 && packX + bb.w > PACK_MAX_ROW_W) {
        packX = 0;
        packY += rowH + PACK_GAP_Y;
        rowH = 0;
      }
      centerComponent(comp, packX + bb.w / 2, packY + bb.h / 2);
      packX += bb.w + PACK_GAP_X;
      rowH = Math.max(rowH, bb.h);
      layoutNext();
    });
  };

  layoutNext();
}

function subgraphOf(node: NodeSingular): Collection {
  const nodes = node.component().nodes();
  return nodes.union(nodes.connectedEdges());
}

function fitToElements(cy: Core, eles: Collection, padding: number): void {
  if (eles.empty()) return;
  cy.minZoom(FOCUS_MIN_ZOOM);
  cy.fit(eles, padding);
  cy.minZoom(MIN_ZOOM);
}

function focusNode(cy: Core, node: NodeSingular): void {
  clearFocus(cy);
  const subgraph = subgraphOf(node);
  subgraph.nodes().addClass("focused");
  subgraph.edges().addClass("focused");
  cy.elements().difference(subgraph).addClass("dimmed");

  cy.stop();
  cy.minZoom(FOCUS_MIN_ZOOM);
  cy.animate({
    fit: { eles: subgraph, padding: FOCUS_PADDING },
    duration: 300,
    complete: () => fitToElements(cy, subgraph, FOCUS_PADDING),
  });
}

const NODE_BASE_STYLE = {
  label: "data(label)",
  "background-color": "data(fillColor)",
  "border-color": "data(accentColor)",
  color: "#1e293b",
  "font-weight": 500,
  "text-outline-width": 0,
  "font-size": "11px",
  "font-family": GRAPH_FONT_FAMILY,
  "text-wrap": "wrap",
  "text-valign": "center",
  "text-halign": "center",
  "border-width": 2,
  "border-opacity": 1,
  ...Z_INDEX_MANUAL,
  "z-index": 1,
} as const;

export function CytoscapeGraph({ data, highlightJoin = false, height = 620 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);

  const joinSet = new Set(
    (highlightJoin && "join_edges" in data ? data.join_edges : []).map(
      (e) => `${e.source}|${e.target}|${e.label}`
    )
  );
  const joinNodeIds =
    highlightJoin && "join_edges" in data
      ? joinNodeIdsFromEdges(data.join_edges)
      : new Set<string>();

  const fitAll = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    clearFocus(cy);
    enforceMinZoom(cy);
    setSelected(null);
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const cy = cyRef.current;
    if (!cy) return;
    const next = Math.min(3, Math.max(MIN_ZOOM, cy.zoom() * factor));
    cy.zoom(next);
    cy.center();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const elements = [
      ...data.nodes.map((n) => {
        const { accent, fill } = nodeColors(n.dataset, n.type);
        return {
          data: {
            id: n.id,
            label: graphNodeDisplayLabel(n.label, n.type),
            fullLabel: normalizeDisplayText(n.label),
            type: n.type,
            dataset: n.dataset,
            accentColor: accent,
            fillColor: fill,
            isCompact: isCompactNode(n.type),
            isJoinNode: joinNodeIds.has(n.id),
          },
        };
      }),
      ...data.edges.map((e, i) => ({
        data: {
          id: `e${i}`,
          source: e.source,
          target: e.target,
          label: normalizeDisplayText(e.label),
          fullLabel: normalizeDisplayText(e.label),
          isJoin: joinSet.has(`${e.source}|${e.target}|${e.label}`),
        },
      })),
    ];

    cyRef.current?.destroy();
    const cy = cytoscape({
      container: containerRef.current,
      minZoom: MIN_ZOOM,
      maxZoom: 3,
      elements,
      style: [
        {
          selector: "node",
          style: {
            ...NODE_BASE_STYLE,
          },
        },
        {
          selector: "node[?isCompact]",
          style: {
            shape: "ellipse",
            width: 76,
            height: 76,
            "text-max-width": "68px",
            "font-size": "10px",
            ...NODE_SHADOW_COMPACT,
          },
        },
        {
          selector: "node[!isCompact]",
          style: {
            shape: "round-rectangle",
            width: "label",
            height: "label",
            padding: "14px",
            "corner-radius": "10",
            "text-max-width": "118px",
            ...NODE_SHADOW_BOX,
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
          selector: "node.focused[?isJoinNode]",
          style: {
            "border-width": 4,
            "underlay-padding": 8,
            "underlay-color": "#fca5a5",
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 3,
            "border-color": "#3b82f6",
          },
        },
        {
          selector: "node.dimmed, edge.dimmed",
          style: {
            opacity: 0.18,
          },
        },
        {
          selector: "node.focused",
          style: {
            "border-width": 3,
            "border-color": "#3b82f6",
            "border-opacity": 1,
            "underlay-color": "#bfdbfe",
            "underlay-opacity": 0.5,
            "z-index": 20,
          },
        },
        {
          selector: "edge",
          style: {
            ...Z_INDEX_MANUAL,
            ...EDGE_LABEL_VISIBLE,
            ...EDGE_LINE_BASE,
            "z-index": 100,
          },
        },
        {
          selector: "edge.focused",
          style: {
            width: 2,
            "line-color": "#94a3b8",
            "target-arrow-color": "#94a3b8",
          },
        },
        {
          selector: "edge[?isJoin]",
          style: {
            ...EDGE_LABEL_VISIBLE,
            ...EDGE_LINE_BASE,
            width: 2.25,
            "line-color": "#f87171",
            "target-arrow-color": "#f87171",
            color: "#b91c1c",
            "text-background-color": "#fff1f2",
            "text-border-color": "#fecdd3",
            "z-index": 160,
          },
        },
        {
          selector: "edge.focused[?isJoin]",
          style: {
            width: 2.75,
            "line-color": "#ef4444",
            "target-arrow-color": "#ef4444",
          },
        },
      ],
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        layoutByComponents(cy);
      });
    });

    cy.on("tap", "node", (evt) => {
      const cytoscapeNode = evt.target as NodeSingular;
      const nodeId = cytoscapeNode.data("id") as string;
      const node = data.nodes.find((n) => n.id === nodeId) ?? null;
      focusNode(cy, cytoscapeNode);
      setSelected(node);
    });

    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        clearFocus(cy);
        enforceMinZoom(cy);
        setSelected(null);
      }
    });

    cyRef.current = cy;
    setSelected(null);

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [data, highlightJoin]);

  const selectedHref = selected
    ? resolveHref(selected.id) ?? resolveHref(selected.shortId)
    : null;

  return (
    <div className="cytoscape-wrap">
      <div className="graph-toolbar">
        <button type="button" className="graph-toolbar-btn" onClick={fitAll}>
          Vista completa
        </button>
        <button type="button" className="graph-toolbar-btn" onClick={() => zoomBy(1.2)}>
          Zoom +
        </button>
        <button type="button" className="graph-toolbar-btn" onClick={() => zoomBy(1 / 1.2)}>
          Zoom −
        </button>
      </div>
      <div ref={containerRef} className="cytoscape-canvas" style={{ height }} />
      {selected && (
        <div className="node-detail">
          <p className="node-detail-label">{normalizeDisplayText(selected.label)}</p>
          <dl className="node-detail-meta">
            <div>
              <dt>Tipo</dt>
              <dd>
                <code>{selected.type}</code>
              </dd>
            </div>
            <div>
              <dt>Dataset</dt>
              <dd>{DATASET_LABELS[selected.dataset] ?? selected.dataset}</dd>
            </div>
            {selectedHref && (
              <div>
                <dt>URI</dt>
                <dd>
                  <ResourceLink
                    value={selected.id.startsWith("http") ? selected.shortId : selected.id}
                    full
                  />
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
