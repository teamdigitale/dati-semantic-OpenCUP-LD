import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const webRoot = fileURLToPath(new URL("..", import.meta.url));
const source = join(webRoot, "node_modules", "rete-graph", "dist", "rete-graph.min.js");
const targetDir = join(webRoot, "public", "vendor");
const target = join(targetDir, "rete-graph.min.js");

if (!existsSync(source)) {
  console.error(
    "[rete] missing node_modules/rete-graph/dist/rete-graph.min.js — run npm install in web/",
  );
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);
console.log(`[rete] vendor bundle copied to ${target}`);
