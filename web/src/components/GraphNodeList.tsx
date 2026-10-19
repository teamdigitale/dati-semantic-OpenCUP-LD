import { GraphNode } from "../types";
import { normalizeDisplayText } from "../utils/text";
import { resolveHref } from "../utils/uri";
import { parseYaml } from "../content/load";
import { ResourceLink } from "./ResourceLink";
import grafiCommonRaw from "../../content/grafi.common.yml?raw";

interface GrafiCommon {
  node_list: { title: string; intro: string };
}

const { node_list } = parseYaml<GrafiCommon>(grafiCommonRaw);

interface Props {
  nodes: GraphNode[];
}

export function GraphNodeList({ nodes }: Props) {
  const linkable = nodes
    .map((n) => ({
      node: n,
      href: resolveHref(n.id) ?? resolveHref(n.shortId),
    }))
    .filter((x): x is typeof x & { href: string } => x.href != null);

  if (!linkable.length) return null;

  return (
    <section className="node-links">
      <h2>{node_list.title}</h2>
      <p className="stats">{node_list.intro}</p>
      <ul className="uri-list">
        {linkable.map(({ node }) => (
          <li key={node.id}>
            <ResourceLink
              value={node.id.startsWith("http") ? node.shortId : node.id}
            />
            <span className="uri-list-label"> — {normalizeDisplayText(node.label)}</span>
            <span className="uri-list-type"> ({node.type})</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
