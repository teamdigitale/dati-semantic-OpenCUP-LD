import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { Core, LayoutOptions, NodeSingular } from "cytoscape";
import fcose from "cytoscape-fcose";
import { SnaEdge, SnaMetric, SnaNetwork, SnaNode } from "../types";
import { cytoscapeRenderOptions } from "../utils/cytoscapeOptions";
import { GRAPH_FONT_FAMILY } from "../utils/text";

cytoscape.use(fcose);

export type SnaColorMode = "community" | "kind";

const KIND_COLORS: Record<string, { accent: string; fill: string }> = {
  impresa: { accent: "#0066cc", fill: "#e7f1ff" },
  sa: { accent: "#008758", fill: "#e6f6ef" },
  rup: { accent: "#a66300", fill: "#fff3e0" },
  cup: { accent: "#5b6f82", fill: "#eef1f4" },
  ente: { accent: "#5c2d91", fill: "#f3eef9" },
  beneficiario: { accent: "#0b7a75", fill: "#e5f6f5" },
  report: { accent: "#b21dd0", fill: "#f8e9fc" },
};

const COMMUNITY_PALETTE = [
  "#0066cc",
  "#008758",
  "#a66300",
  "#b21dd0",
  "#c73e1d",
  "#0b7a75",
  "#5c4d7d",
  "#d64045",
  "#3d5a80",
  "#ee6c4d",
  "#293241",
  "#98c1d9",
];

const KIND_LABELS: Record<string, string> = {
  impresa: "Impresa",
  sa: "Stazione appaltante",
  rup: "RUP",
  cup: "CUP / progetto",
  ente: "Ente (candidato/titolare)",
  beneficiario: "Beneficiario",
  report: "Report Monithon",
};

const METRIC_LABELS: Record<SnaMetric, string> = {
  degree: "Grado",
  weighted_degree: "Grado pesato",
  betweenness: "Betweenness",
  pagerank: "PageRank",
};

interface Props {
  network: SnaNetwork;
  metric: SnaMetric;
  colorMode: SnaColorMode;
  kinds: Set<string>;
  topN: number;
  minDegree: number;
  query: string;
  focusId: string | null;
  height?: number;
  onSelectNode?: (node: SnaNode | null) => void;
}

function communityColor(id: number): { accent: string; fill: string } {
  const accent = COMMUNITY_PALETTE[id % COMMUNITY_PALETTE.length];
  return { accent, fill: `${accent}22` };
}

function kindColor(kind: string): { accent: string; fill: string } {
  return KIND_COLORS[kind] ?? { accent: "#64748b", fill: "#f1f5f9" };
}

function metricValue(n: SnaNode, metric: SnaMetric): number {
  const v = n[metric];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function nodeSize(value: number, minV: number, maxV: number): number {
  if (maxV <= minV) return 28;
  const t = Math.sqrt((value - minV) / (maxV - minV));
  return 14 + t * 46;
}

function edgeWidth(weight: number, maxW: number): number {
  if (maxW <= 0) return 1.2;
  return 0.8 + Math.sqrt(weight / maxW) * 5;
}

function filterNetwork(
  network: SnaNetwork,
  kinds: Set<string>,
  topN: number,
  minDegree: number,
  metric: SnaMetric,
  query: string,
  focusId: string | null
): { nodes: SnaNode[]; edges: SnaEdge[] } {
  let nodes = network.nodes.filter(
    (n) => kinds.has(n.kind) && (n.degree ?? 0) >= minDegree
  );

  const q = query.trim().toLowerCase();
  if (q) {
    const hit = new Set(
      nodes
        .filter(
          (n) =>
            n.label.toLowerCase().includes(q) ||
            n.id.toLowerCase().includes(q) ||
            (n.cf && n.cf.toLowerCase().includes(q))
        )
        .map((n) => n.id)
    );
    // Keep hits + 1-hop neighbors among filtered kinds
    const neighbor = new Set<string>();
    for (const e of network.edges) {
      if (hit.has(e.source)) neighbor.add(e.target);
      if (hit.has(e.target)) neighbor.add(e.source);
    }
    nodes = nodes.filter((n) => hit.has(n.id) || neighbor.has(n.id));
  }

  if (focusId) {
    const ego = new Set<string>([focusId]);
    for (const e of network.edges) {
      if (e.source === focusId) ego.add(e.target);
      if (e.target === focusId) ego.add(e.source);
    }
    nodes = nodes.filter((n) => ego.has(n.id));
  }

  nodes = [...nodes].sort(
    (a, b) => metricValue(b, metric) - metricValue(a, metric)
  );
  if (topN > 0 && nodes.length > topN) {
    nodes = nodes.slice(0, topN);
  }

  const keep = new Set(nodes.map((n) => n.id));
  const edges = network.edges.filter(
    (e) => keep.has(e.source) && keep.has(e.target)
  );
  return { nodes, edges };
}

export function SnaGraph({
  network,
  metric,
  colorMode,
  kinds,
  topN,
  minDegree,
  query,
  focusId,
  height = 640,
  onSelectNode,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [ready, setReady] = useState(false);

  const filtered = useMemo(
    () =>
      filterNetwork(network, kinds, topN, minDegree, metric, query, focusId),
    [network, kinds, topN, minDegree, metric, query, focusId]
  );

  const nodeById = useMemo(() => {
    const m = new Map<string, SnaNode>();
    for (const n of network.nodes) m.set(n.id, n);
    return m;
  }, [network]);

  useEffect(() => {
    if (!containerRef.current) return;

    const values = filtered.nodes.map((n) => metricValue(n, metric));
    const minV = values.length ? Math.min(...values) : 0;
    const maxV = values.length ? Math.max(...values) : 1;
    const maxW = Math.max(
      1,
      ...filtered.edges.map((e) => e.weight || e.importo_tot || e.n || 1)
    );

    const large = filtered.nodes.length > 800;
    const huge = filtered.nodes.length > 2500;

    const elements = [
      ...filtered.nodes.map((n) => {
        const colors =
          colorMode === "community"
            ? communityColor(n.community ?? 0)
            : kindColor(n.kind);
        const size = nodeSize(metricValue(n, metric), minV, maxV);
        const short =
          n.label.length > 42 ? `${n.label.slice(0, 40)}…` : n.label;
        return {
          data: {
            id: n.id,
            label: huge ? "" : short,
            fullLabel: n.label,
            kind: n.kind,
            community: n.community,
            size: huge ? Math.max(8, size * 0.55) : size,
            accent: colors.accent,
            fill: colors.fill,
            seed: n.seed ? 1 : 0,
          },
        };
      }),
      ...filtered.edges.map((e, i) => ({
        data: {
          id: `e${i}-${e.source}-${e.target}-${e.rel}`,
          source: e.source,
          target: e.target,
          label: e.rel,
          width: edgeWidth(e.weight || e.importo_tot || e.n || 1, maxW),
        },
      })),
    ];

    cyRef.current?.destroy();
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      ...cytoscapeRenderOptions(),
      hideEdgesOnViewport: large,
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "background-color": "data(fill)",
            "border-color": "data(accent)",
            "border-width": huge ? 1 : 2,
            width: "data(size)",
            height: "data(size)",
            color: "#17324d",
            "font-family": GRAPH_FONT_FAMILY,
            "font-size": 9,
            "text-wrap": "wrap",
            "text-max-width": "72px",
            "text-valign": "bottom",
            "text-halign": "center",
            "text-margin-y": 4,
            "overlay-padding": 4,
            "min-zoomed-font-size": large ? 8 : 0,
          },
        },
        {
          selector: "node[seed = 1]",
          style: {
            "border-width": 4,
            "border-color": "#c73e1d",
          },
        },
        {
          selector: "edge",
          style: {
            width: "data(width)",
            "line-color": "#94a3b8",
            "curve-style": huge ? "haystack" : "bezier",
            opacity: huge ? 0.25 : 0.55,
            "target-arrow-shape": "none",
          },
        },
        {
          selector: ".dimmed",
          style: { opacity: 0.12 },
        },
        {
          selector: ".focused",
          style: { opacity: 1, "z-index": 999 },
        },
      ],
      layout: { name: "preset" },
    });

    const layout = {
      name: "fcose",
      animate: false,
      randomize: true,
      quality: huge ? "draft" : large ? "default" : "default",
      nodeSeparation: huge ? 12 : 28,
      idealEdgeLength: huge ? 36 : 70,
      nodeRepulsion: () => (huge ? 1200 : 4500),
      gravity: huge ? 0.4 : 0.25,
      numIter: huge ? 400 : large ? 900 : 1800,
      tilingPaddingVertical: 40,
      tilingPaddingHorizontal: 40,
    } as LayoutOptions;

    cy.layout(layout).run();
    cy.fit(undefined, 40);

    cy.on("tap", "node", (evt) => {
      const node = evt.target as NodeSingular;
      const data = nodeById.get(node.id()) ?? null;
      onSelectNode?.(data);
      cy.elements().addClass("dimmed").removeClass("focused");
      node.closedNeighborhood().removeClass("dimmed").addClass("focused");
      node.removeClass("dimmed").addClass("focused");
    });
    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        cy.elements().removeClass("dimmed focused");
        onSelectNode?.(null);
      }
    });

    cyRef.current = cy;
    setReady(true);
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [filtered, metric, colorMode, nodeById, onSelectNode]);

  return (
    <div className="sna-graph-wrap">
      <div
        ref={containerRef}
        className="sna-graph-canvas"
        style={{ height }}
        role="img"
        aria-label={`Grafo SNA con ${filtered.nodes.length} nodi e ${filtered.edges.length} archi`}
      />
      {!ready && <p className="text-secondary sna-graph-loading">Caricamento grafo…</p>}
      <p className="text-secondary small mb-0 mt-2">
        In vista: {filtered.nodes.length.toLocaleString("it")} nodi ·{" "}
        {filtered.edges.length.toLocaleString("it")} archi
        {topN > 0
          ? ` (top ${topN} per ${METRIC_LABELS[metric]})`
          : " (tutti i nodi del filtro, senza taglio Top N)"}
        {filtered.nodes.length > 2500
          ? " · vista leggera (etichette nascoste; zoom per dettaglio)"
          : ""}
      </p>
    </div>
  );
}

export { KIND_LABELS, METRIC_LABELS, KIND_COLORS, COMMUNITY_PALETTE };
