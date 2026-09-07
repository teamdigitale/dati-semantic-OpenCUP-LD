import { load as yamlLoad } from "js-yaml";

/**
 * Parse YAML frontmatter (between ---) without gray-matter / Node Buffer.
 * Body may use YAML folded scalars (`>` / `|`) in the frontmatter block.
 */
export function parseMarkdown(raw: string): {
  data: Record<string, unknown>;
  content: string;
} {
  const text = raw.replace(/^\uFEFF/, "");
  if (!text.startsWith("---")) {
    return { data: {}, content: text };
  }
  const end = text.indexOf("\n---", 3);
  if (end === -1) {
    return { data: {}, content: text };
  }
  const fm = text.slice(3, end).replace(/^\r?\n/, "");
  const content = text.slice(end + 4).replace(/^\r?\n/, "");
  let data: Record<string, unknown> = {};
  try {
    data = (yamlLoad(fm) as Record<string, unknown>) ?? {};
  } catch (err) {
    console.error("Invalid YAML frontmatter in content file", err);
  }
  return { data, content };
}

export function parseYaml<T>(raw: string): T {
  return yamlLoad(raw) as T;
}

/** Split markdown body on `<!-- section:id -->` markers (optional). */
export function splitSections(body: string): Record<string, string> {
  const parts = body.split(/<!--\s*section:([\w-]+)\s*-->/);
  if (parts.length === 1) {
    return { main: body.trim() };
  }
  const out: Record<string, string> = {};
  if (parts[0].trim()) out.main = parts[0].trim();
  for (let i = 1; i < parts.length; i += 2) {
    const id = parts[i];
    const text = (parts[i + 1] ?? "").trim();
    out[id] = text;
  }
  return out;
}
