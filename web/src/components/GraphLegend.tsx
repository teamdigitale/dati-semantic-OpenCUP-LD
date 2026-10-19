import { DATASET_COLORS, DATASET_LABELS } from "../constants";
import { parseYaml } from "../content/load";
import { ContentMarkdown } from "./ContentMarkdown";
import legendaRaw from "../../content/legenda.yml?raw";

interface LegendaContent {
  aria: string;
  title: string;
  colors: { title: string; hint: string };
  datasets: Record<string, string>;
  join_nodes: {
    title: string;
    hint: string;
    label: string;
    desc: string;
  };
  join_edges: {
    title: string;
    hint: string;
    label: string;
    desc: string;
  };
}

const legenda = parseYaml<LegendaContent>(legendaRaw);

interface Props {
  /** Dataset presenti nel grafo; se omesso mostra tutti. */
  datasets?: string[];
  /** Mostra la voce per gli archi di collegamento tra fonti (rossi). */
  showJoinEdges?: boolean;
  /** Mostra la voce per i nodi di ancoraggio (doppio bordo). */
  showJoinNodes?: boolean;
}

export function GraphLegend({
  datasets,
  showJoinEdges = false,
  showJoinNodes = false,
}: Props) {
  const keys = datasets?.length
    ? datasets
    : Object.keys(DATASET_COLORS).filter((k) => k !== "shared");

  return (
    <section className="graph-legend" aria-label={legenda.aria}>
      <h2>{legenda.title}</h2>
      <div className="graph-legend-grid">
        <div className="graph-legend-section">
          <h3>{legenda.colors.title}</h3>
          <div className="graph-legend-hint">
            <ContentMarkdown source={legenda.colors.hint} />
          </div>
          <ul className="graph-legend-list">
            {keys.map((key) => (
              <li key={key}>
                <span className="dot" style={{ background: DATASET_COLORS[key] }} />
                <span className="graph-legend-label">{DATASET_LABELS[key] ?? key}</span>
                <span className="graph-legend-desc">
                  {legenda.datasets[key] ?? ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {showJoinNodes && (
          <div className="graph-legend-section">
            <h3>{legenda.join_nodes.title}</h3>
            <div className="graph-legend-hint">
              <ContentMarkdown source={legenda.join_nodes.hint} />
            </div>
            <ul className="graph-legend-list">
              <li>
                <span className="join-node-sample" />
                <span className="graph-legend-label">{legenda.join_nodes.label}</span>
                <span className="graph-legend-desc">{legenda.join_nodes.desc}</span>
              </li>
            </ul>
          </div>
        )}
        {showJoinEdges && (
          <div className="graph-legend-section">
            <h3>{legenda.join_edges.title}</h3>
            <div className="graph-legend-hint">
              <ContentMarkdown source={legenda.join_edges.hint} />
            </div>
            <ul className="graph-legend-list">
              <li>
                <span className="legend-edge-sample" />
                <span className="graph-legend-label">{legenda.join_edges.label}</span>
                <span className="graph-legend-desc">{legenda.join_edges.desc}</span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
