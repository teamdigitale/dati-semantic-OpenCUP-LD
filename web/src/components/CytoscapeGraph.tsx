import { useCallback, useEffect, useRef, useState } from "react";
import cytoscape, {
  BoundingBox,
  Collection,
  Core,
  LayoutOptions,
  NodeSingular,
} from "cytoscape";
import { GraphData, GraphNode, SubgraphData } from "../types";
import { DATASET_COLORS, DATASET_LABELS, TYPE_COLORS } from "../constants";
import { resolveHref } from "../utils/uri";
import { joinNodeIdsFromEdges } from "../utils/graphCup";
import { GRAPH_FONT_FAMILY, normalizeDisplayText } from "../utils/text";
import { JOIN_NODE_STYLE_BOX, JOIN_NODE_STYLE_COMPACT } from "../utils/graphStyles";
import { ResourceLink } from "./ResourceLink";

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
const NODE_BORDER = { "border-width": 2, "border-color": "#1e40af", "border-opacity": 1 } as const;

const COMPACT_NODE_TYPES = new Set([
  "pi:Progetto_di_investimento_pubblico",
  "PCTR:Lot",
  "Literal",
]);

function isCompactNode(type: string): boolean {
  return COMPACT_NODE_TYPES.has(type);
}

/** Etichetta nodo (testo completo nel pannello al click). */
function shortNodeLabel(label: string, type: string): string {
  const text = normalizeDisplayText(label);
  if (type === "pi:Progetto_di_investimento_pubblico") return text;
  if (text.startsWith("CIG ")) return text;
  if (text.length > 40) return `${text.slice(0, 38)}…`;
  return text;
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

function buildBreadthfirstLayout(comp: Collection): LayoutOptions {
  const cups = comp.nodes().filter(
    (n) => n.data("type") === "pi:Progetto_di_investimento_pubblico"
  );
  const roots =
    cups.length > 0
      ? cups.map((n) => n.id())
      : [findHub(comp.nodes().toArray()).id()];
  return {
    name: "breadthfirst",
    fit: false,
    directed: false,
    roots,
    spacingFactor: 2.8,
    avoidOverlap: true,
    nodeDimensionsIncludeLabels: true,
    padding: 40,
  };
}

function countCups(nodes: NodeSingular[]): number {
  return nodes.filter((n) => n.data("type") === "pi:Progetto_di_investimento_pubblico").length;
}

function layoutPairComponent(comp: Collection, cx: number, cellY: number): void {
  const nodes = comp.nodes().toArray();
  if (nodes.length !== 2) return;
  const [a, b] = nodes;
  const bbA = a.boundingBox();
  const bbB = b.boundingBox();
  const gap = 72;
  const half = (bbA.w + gap + bbB.w) / 2;
  a.position({ x: cx - half + bbA.w / 2, y: cellY });
  b.position({ x: cx + half - bbB.w / 2, y: cellY });
}

function isStarComponent(comp: Collection): boolean {
  const nodes = comp.nodes();
  if (nodes.length < 3) return false;
  const maxDeg = Math.max(...nodes.map((n) => n.degree()));
  if (maxDeg < 2) return false;
  const hubs = nodes.filter((n) => n.degree() === maxDeg);
  if (hubs.length !== 1) return false;
  return nodes.filter((n) => n.degree() === 1).length === nodes.length - 1;
}

function findCupHub(nodes: NodeSingular[]): NodeSingular | null {
  return nodes.find((n) => n.data("type") === "pi:Progetto_di_investimento_pubblico") ?? null;
}

function shouldUseSpokeLayout(comp: Collection): boolean {
  return countCups(comp.nodes().toArray()) > 1;
}

function shouldUseHubRadial(comp: Collection): boolean {
  const nodes = comp.nodes().toArray();
  return countCups(nodes) === 1 && nodes.length >= 3 && nodes.length <= 20;
}

function privateNeighbors(cup: NodeSingular, hub: NodeSingular): NodeSingular[] {
  return (cup.neighborhood("node").toArray() as NodeSingular[]).filter(
    (n) => n.id() !== cup.id() && n.id() !== hub.id()
  );
}

function leafAngles(count: number): number[] {
  if (count === 1) return [0];
  if (count === 2) return [Math.PI, 0];
  return Array.from({ length: count }, (_, i) => -Math.PI / 2 + (2 * Math.PI * i) / count);
}

function nodeRadius(n: NodeSingular): number {
  const bb = n.boundingBox();
  return Math.max(bb.w, bb.h, 72) / 2;
}

/** Nodi da non spostare durante la risoluzione overlap (hub condiviso / CUP radiale). */
function pinnedNodesForComponent(nodes: NodeSingular[]): Set<string> {
  const pinned = new Set<string>();
  const cups = nodes.filter((n) => n.data("type") === "pi:Progetto_di_investimento_pubblico");
  if (cups.length > 1) {
    const hubCandidates = nodes.filter(
      (n) => n.degree() > 1 && !cups.some((c) => c.id() === n.id())
    );
    const hub = hubCandidates.sort((a, b) => b.degree() - a.degree())[0] ?? findHub(nodes);
    pinned.add(hub.id());
  } else if (cups.length === 1) {
    pinned.add(cups[0].id());
  } else {
    pinned.add(findHub(nodes).id());
  }
  return pinned;
}

/** Layout a raggi: hub al centro, CUP sul primo anello, interventi sul secondo (esterni). */
function layoutSpokeHub(comp: Collection, cx: number, cellY: number): void {
  const nodes = comp.nodes().toArray();
  const cups = nodes
    .filter((n) => n.data("type") === "pi:Progetto_di_investimento_pubblico")
    .sort((a, b) => String(a.data("label")).localeCompare(String(b.data("label"))));

  const hubCandidates = nodes.filter((n) => n.degree() > 1 && !cups.some((c) => c.id() === n.id()));
  const hub = hubCandidates.sort((a, b) => b.degree() - a.degree())[0] ?? findHub(nodes);
  hub.position({ x: cx, y: cellY });

  const placed = new Set<string>([hub.id()]);
  const hubR = nodeRadius(hub);
  const maxCupR = Math.max(...cups.map(nodeRadius), 44);
  const privateNodes = nodes.filter(
    (n) => n.data("type") === "pi:Intervento_di_investimento_pubblico"
  );
  const maxPrivateR = Math.max(...privateNodes.map(nodeRadius), 60);
  const ringGap = 56;
  const cupR = hubR + maxCupR + ringGap + 36;
  const privateBaseR = cupR + maxCupR + maxPrivateR + ringGap;
  const angles = leafAngles(cups.length);

  cups.forEach((cup, i) => {
    const angle = angles[i] ?? (2 * Math.PI * i) / cups.length - Math.PI / 2;
    cup.position({ x: cx + cupR * Math.cos(angle), y: cellY + cupR * Math.sin(angle) });
    placed.add(cup.id());

    const privates = privateNeighbors(cup, hub).sort((a, b) =>
      String(a.data("label")).localeCompare(String(b.data("label")))
    );
    privates.forEach((node, j) => {
      const r = privateBaseR + j * (maxPrivateR + ringGap * 0.6);
      node.position({ x: cx + r * Math.cos(angle), y: cellY + r * Math.sin(angle) });
      placed.add(node.id());
    });
  });

  nodes
    .filter((n) => !placed.has(n.id()))
    .forEach((node) => {
      const anchor = (node.neighborhood("node").toArray() as NodeSingular[]).find((n) =>
        placed.has(n.id())
      );
      if (!anchor) return;
      const ap = anchor.position();
      const dist = Math.hypot(ap.x - cx, ap.y - cellY) || 1;
      const outX = (ap.x - cx) / dist;
      const outY = (ap.y - cellY) / dist;
      const step = nodeRadius(anchor) + nodeRadius(node) + ringGap;
      node.position({ x: ap.x + outX * step, y: ap.y + outY * step });
    });
}

/** Layout radiale per sottografi unione: CUP al centro, vicini sul primo anello, satellite sul secondo. */
function layoutHubRadial(comp: Collection, cx: number, cellY: number): void {
  const nodes = comp.nodes().toArray();
  const hub = findCupHub(nodes) ?? findHub(nodes);
  const hubId = hub.id();
  hub.position({ x: cx, y: cellY });

  const direct = hub.neighborhood("node").toArray() as NodeSingular[];
  const directNeighbors = direct.filter((n) => n.id() !== hubId);
  const directIds = new Set(directNeighbors.map((n) => n.id()));
  const indirect = nodes.filter((n) => n.id() !== hubId && !directIds.has(n.id()));

  const maxSize = Math.max(
    ...nodes.map((n) => Math.max(n.boundingBox().w, n.boundingBox().h, 88)),
    88
  );
  const r1 = Math.max(215, maxSize * 1.75);

  leafAngles(directNeighbors.length).forEach((angle, i) => {
    const leaf = directNeighbors[i];
    leaf.position({
      x: cx + r1 * Math.cos(angle),
      y: cellY + r1 * Math.sin(angle),
    });
  });

  indirect.forEach((node) => {
    const anchors = (node.neighborhood("node").toArray() as NodeSingular[]).filter(
      (n) => n.id() !== node.id()
    );
    const anchor =
      anchors.find((n) => directIds.has(n.id())) ??
      anchors.sort((a, b) => b.degree() - a.degree())[0] ??
      hub;
    const ap = anchor.position();
    const outAngle = Math.atan2(ap.y - cellY, ap.x - cx);
    const satelliteDist = maxSize * 0.95 + 55;
    node.position({
      x: ap.x + satelliteDist * Math.cos(outAngle),
      y: ap.y + satelliteDist * Math.sin(outAngle),
    });
  });
}

function layoutComponent(comp: Collection, cx: number, cellY: number, onDone: () => void): void {
  const nodeCount = comp.nodes().length;

  if (nodeCount === 2) {
    layoutPairComponent(comp, cx, cellY);
    resolveComponentOverlaps(comp, 16, 60);
    onDone();
    return;
  }
  if (isStarComponent(comp)) {
    layoutStarComponent(comp, cx, cellY);
    resolveComponentOverlaps(comp, 16, 60);
    onDone();
    return;
  }
  if (shouldUseSpokeLayout(comp)) {
    layoutSpokeHub(comp, cx, cellY);
    resolveComponentOverlaps(comp, 20, 100);
    onDone();
    return;
  }
  if (shouldUseHubRadial(comp)) {
    layoutHubRadial(comp, cx, cellY);
    resolveComponentOverlaps(comp, 16, 80);
    onDone();
    return;
  }
  const layout = comp.layout(buildBreadthfirstLayout(comp));
  layout.on("layoutstop", () => {
    centerComponent(comp, cx, cellY);
    resolveComponentOverlaps(comp, 18, 100);
    onDone();
  });
  layout.run();
}

function findHub(nodes: NodeSingular[]): NodeSingular {
  let hub = nodes[0];
  for (let i = 1; i < nodes.length; i += 1) {
    if (nodes[i].degree() > hub.degree()) hub = nodes[i];
  }
  return hub;
}

function layoutStarComponent(comp: Collection, cx: number, cellY: number): void {
  const nodes = comp.nodes().toArray();
  const hub = findCupHub(nodes) ?? findHub(nodes);
  const leaves = nodes.filter((n) => n.id() !== hub.id());

  const hubSize = Math.max(hub.boundingBox().w, hub.boundingBox().h, 88);
  const maxLeaf = Math.max(
    ...leaves.map((n) => Math.max(n.boundingBox().w, n.boundingBox().h)),
    88
  );
  const radius = Math.max(175, hubSize / 2 + maxLeaf / 2 + 56);

  hub.position({ x: cx, y: cellY });
  leafAngles(leaves.length).forEach((angle, i) => {
    const leaf = leaves[i];
    leaf.position({
      x: cx + radius * Math.cos(angle),
      y: cellY + radius * Math.sin(angle),
    });
  });
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

function boxesOverlap(a: BoundingBox, b: BoundingBox, gap: number): boolean {
  return !(
    a.x2 + gap < b.x1 ||
    b.x2 + gap < a.x1 ||
    a.y2 + gap < b.y1 ||
    b.y2 + gap < a.y1
  );
}

function resolveComponentOverlaps(comp: Collection, gap = 12, maxIter = 40): void {
  const nodes = comp.nodes().toArray();
  const pinned = pinnedNodesForComponent(nodes);
  const hub = findHub(nodes);
  const hubPos = hub.position();

  for (let iter = 0; iter < maxIter; iter += 1) {
    let moved = false;
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const n1 = nodes[i];
        const n2 = nodes[j];
        const bb1 = n1.boundingBox();
        const bb2 = n2.boundingBox();
        if (!boxesOverlap(bb1, bb2, gap)) continue;

        moved = true;
        const p1 = n1.position();
        const p2 = n2.position();
        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        if (dx === 0 && dy === 0) {
          const a1 = Math.atan2(p1.y - hubPos.y, p1.x - hubPos.x);
          const a2 = a1 + 0.35;
          dx = Math.cos(a2);
          dy = Math.sin(a2);
        }
        const dist = Math.hypot(dx, dy);
        const minDist = (Math.max(bb1.w, bb1.h) + Math.max(bb2.w, bb2.h)) / 2 + gap;
        const push = minDist - dist + 6;

        const n1Pinned = pinned.has(n1.id());
        const n2Pinned = pinned.has(n2.id());
        if (n1Pinned && n2Pinned) continue;

        const pushNode = (
          node: NodeSingular,
          pos: { x: number; y: number },
          sign: number,
          weight: number
        ): void => {
          let nx = pos.x + (dx / dist) * push * sign * weight;
          let ny = pos.y + (dy / dist) * push * sign * weight;
          const rd = Math.hypot(nx - hubPos.x, ny - hubPos.y);
          const minR = nodeRadius(hub) + nodeRadius(node) + gap;
          if (!pinned.has(node.id()) && rd < minR) {
            const ang = Math.atan2(ny - hubPos.y, nx - hubPos.x);
            nx = hubPos.x + minR * Math.cos(ang);
            ny = hubPos.y + minR * Math.sin(ang);
          }
          node.position({ x: nx, y: ny });
        };

        if (n1Pinned) {
          pushNode(n2, p2, 1, 1);
        } else if (n2Pinned) {
          pushNode(n1, p1, -1, 1);
        } else {
          const w1 = n1.degree() <= n2.degree() ? 0.65 : 0.35;
          const w2 = 1 - w1;
          pushNode(n1, p1, -1, w1);
          pushNode(n2, p2, 1, w2);
        }
      }
    }
    if (!moved) break;
  }
}

function finishLayout(cy: Core): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => nudgeEdgeLabelsFromNodes(cy));
  });
  enforceMinZoom(cy);
}

/** Sposta l'etichetta perpendicolare all'arco se sovrapposta a un nodo. */
function nudgeEdgeLabelsFromNodes(cy: Core): void {
  const LABEL_MAX_W = 120;
  const LABEL_LINE_H = 12;
  const LABEL_PAD = 8;
  const MARGIN_Y_CANDIDATES = [12, 26, -26, 40, -40, 54, -54];
  const MARGIN_X_CANDIDATES = [0, 18, -18, 30, -30];

  const estimateLabelBox = (center: { x: number; y: number }, label: string): BoundingBox => {
    const charsPerLine = 22;
    const lines = Math.max(1, Math.ceil(label.length / charsPerLine));
    const w = Math.min(LABEL_MAX_W, Math.max(48, label.length * 4.5));
    const h = lines * LABEL_LINE_H + LABEL_PAD;
    return {
      x1: center.x - w / 2,
      x2: center.x + w / 2,
      y1: center.y - h / 2,
      y2: center.y + h / 2,
      w,
      h,
    };
  };

  const countOverlappingNodes = (bb: BoundingBox): number => {
    let count = 0;
    cy.nodes().forEach((node) => {
      if (!boxesOverlap(bb, node.boundingBox(), 6)) return;
      count += 1;
    });
    return count;
  };

  cy.edges().forEach((edge) => {
    const mid = edge.midpoint();
    const label = String(edge.data("label") ?? "");
    const src = edge.source().position();
    const tgt = edge.target().position();
    const edx = tgt.x - src.x;
    const edy = tgt.y - src.y;
    const elen = Math.hypot(edx, edy) || 1;
    const perpX = -edy / elen;
    const perpY = edx / elen;

    let bestMarginY = 12;
    let bestMarginX = 0;
    let bestOverlap = countOverlappingNodes(estimateLabelBox(mid, label));

    for (const marginY of MARGIN_Y_CANDIDATES) {
      for (const marginX of MARGIN_X_CANDIDATES) {
        const shifted = {
          x: mid.x + perpX * marginY + (edx / elen) * marginX,
          y: mid.y + perpY * marginY + (edy / elen) * marginX,
        };
        const overlap = countOverlappingNodes(estimateLabelBox(shifted, label));
        if (overlap < bestOverlap) {
          bestOverlap = overlap;
          bestMarginY = marginY;
          bestMarginX = marginX;
        }
        if (overlap === 0) break;
      }
      if (bestOverlap === 0) break;
    }

    edge.style("text-margin-y", bestMarginY);
    edge.style("text-margin-x", bestMarginX);
  });
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
  "background-color": "data(color)",
  color: "#ffffff",
  "text-outline-color": "#1e293b",
  "text-outline-width": 1.5,
  "text-outline-opacity": 0.85,
  "font-size": "10px",
  "font-family": GRAPH_FONT_FAMILY,
  "text-wrap": "wrap",
  "text-valign": "center",
  "text-halign": "center",
  "z-index": 0,
  ...NODE_BORDER,
} as const;

const EDGE_LABEL_STYLE = {
  "font-size": "8px",
  "font-family": GRAPH_FONT_FAMILY,
  "text-rotation": "autorotate",
  "text-wrap": "wrap",
  "text-max-width": "120px",
  "text-valign": "center",
  "text-halign": "center",
  "text-margin-y": 14,
  "text-margin-x": 0,
  "text-opacity": 1,
  color: "#1e293b",
  "text-outline-color": "#ffffff",
  "text-outline-width": 2,
  "text-outline-opacity": 1,
  "text-background-color": "#ffffff",
  "text-background-opacity": 1,
  "text-background-padding": "4px",
  "text-background-shape": "roundrectangle",
  "text-border-color": "#94a3b8",
  "text-border-width": 1,
  "text-border-opacity": 1,
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
      ...data.nodes.map((n) => ({
        data: {
          id: n.id,
          label: shortNodeLabel(n.label, n.type),
          fullLabel: normalizeDisplayText(n.label),
          type: n.type,
          dataset: n.dataset,
          color: DATASET_COLORS[n.dataset] ?? TYPE_COLORS[n.type] ?? "#94a3b8",
          isCompact: isCompactNode(n.type),
          isJoinNode: joinNodeIds.has(n.id),
        },
      })),
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
            width: 80,
            height: 80,
            "text-max-width": "72px",
          },
        },
        {
          selector: "node[!isCompact]",
          style: {
            shape: "round-rectangle",
            width: "label",
            height: "label",
            padding: "16px",
            "corner-radius": "8",
            "text-max-width": "130px",
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
            "border-color": "#ffffff",
            "border-width": 4,
            "underlay-padding": 9,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 3,
            "border-color": "#2563eb",
          },
        },
        {
          selector: "node.dimmed, edge.dimmed",
          style: {
            opacity: 0.2,
          },
        },
        {
          selector: "node.focused",
          style: {
            "border-width": 4,
            "border-color": "#2563eb",
            "border-opacity": 1,
            "z-index": 20,
          },
        },
        {
          selector: "edge.focused",
          style: {
            width: 3.5,
            "z-index": 110,
          },
        },
        {
          selector: "edge",
          style: {
            label: "data(label)",
            "curve-style": "bezier",
            "edge-distances": "intersection",
            "target-arrow-shape": "triangle",
            "arrow-scale": 1.2,
            width: 2.5,
            "line-color": "#64748b",
            "target-arrow-color": "#64748b",
            "z-index": 150,
            ...EDGE_LABEL_STYLE,
          },
        },
        {
          selector: "edge[?isJoin]",
          style: {
            width: 3.5,
            "line-color": "#dc2626",
            "target-arrow-color": "#dc2626",
            color: "#b91c1c",
            "text-background-color": "#fff1f2",
            "text-border-color": "#fecaca",
            "z-index": 160,
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
