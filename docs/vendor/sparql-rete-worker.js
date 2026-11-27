importScripts("rete-graph.min.js");

const graphs = new Map();
const rowHandles = new Map();
let nextRowsId = 1;

function releaseAllRows() {
  for (const handle of rowHandles.values()) {
    try {
      handle.rows.free();
    } catch (_) {
    }
  }
  rowHandles.clear();
}

async function openGraph(url) {
  if (!graphs.has(url)) {
    const opening = rete.open(url).catch((error) => {
      graphs.delete(url);
      throw error;
    });
    graphs.set(url, opening);
  }
  return graphs.get(url);
}

function serializeTerm(term) {
  if (!term) return null;
  let jsValue = term.value;
  try {
    if (typeof term.toJS === "function") jsValue = term.toJS();
  } catch (_) {
    jsValue = term.value;
  }
  if (typeof jsValue === "bigint") jsValue = jsValue.toString();
  let n3 = null;
  try {
    n3 = term.n3 || null;
  } catch (_) {
    n3 = null;
  }
  return {
    kind: term.kind || null,
    value: term.value == null ? "" : String(term.value),
    datatype: term.datatype || null,
    lang: term.lang || null,
    n3,
    js: jsValue,
  };
}

function serializeRow(row) {
  const out = {};
  for (const [key, term] of Object.entries(row || {})) {
    out[key] = serializeTerm(term);
  }
  return out;
}

function serializeRows(rows) {
  return (rows || []).map(serializeRow);
}

function serializeWarnings(warnings) {
  return (warnings || []).map((warning) => ({ ...warning }));
}

function serializeStats(graph) {
  try {
    const stats = graph.stats && graph.stats();
    return stats ? { ...stats } : null;
  } catch (_) {
    return null;
  }
}

function detectForm(query) {
  const match = String(query).match(/\b(SELECT|ASK|CONSTRUCT|DESCRIBE)\b/i);
  return match ? match[1].toUpperCase() : null;
}

function executePagedRows(graph, query, offset, limit) {
  const rows = graph.queryRows(query);
  const resultId = nextRowsId;
  nextRowsId += 1;
  rowHandles.set(resultId, { rows, graph });
  try {
    const page = rows.page(offset, limit);
    return {
      form: "select",
      streaming: true,
      resultId,
      vars: [...rows.vars],
      total: rows.length,
      offset,
      limit,
      rows: serializeRows(page),
      warnings: serializeWarnings(rows.lastWarnings()),
      stats: serializeStats(graph),
    };
  } catch (error) {
    rowHandles.delete(resultId);
    try {
      rows.free();
    } catch (_) {
    }
    throw error;
  }
}

function executeMaterialized(graph, query, form, offset, limit) {
  const result = graph.query(query);
  const warnings = serializeWarnings(graph.lastWarnings());
  const stats = serializeStats(graph);
  if (typeof result === "boolean") {
    return {
      form: "ask",
      streaming: false,
      resultId: null,
      vars: [],
      total: result ? 1 : 0,
      offset: 0,
      limit,
      rows: [],
      value: result,
      warnings,
      stats,
    };
  }

  const items = Array.isArray(result) ? result : [];
  const detectedTriples = items.length > 0 && Array.isArray(items[0]);
  const isTriples = detectedTriples || form === "CONSTRUCT" || form === "DESCRIBE";
  const pageItems = items.slice(offset, offset + limit);
  if (isTriples) {
    return {
      form: form === "DESCRIBE" ? "describe" : "construct",
      streaming: false,
      resultId: null,
      vars: ["subject", "predicate", "object"],
      total: items.length,
      offset,
      limit,
      rows: pageItems.map(([subject, predicate, object]) => ({
        subject: serializeTerm(subject),
        predicate: serializeTerm(predicate),
        object: serializeTerm(object),
      })),
      warnings,
      stats,
    };
  }

  return {
    form: "select",
    streaming: false,
    resultId: null,
    vars: items.length > 0 ? Object.keys(items[0]) : [],
    total: items.length,
    offset,
    limit,
    rows: serializeRows(pageItems),
    warnings,
    stats,
  };
}

function executeQuery(graph, query, offset, limit) {
  releaseAllRows();
  const form = detectForm(query);
  if (form !== "ASK" && form !== "CONSTRUCT" && form !== "DESCRIBE") {
    try {
      return executePagedRows(graph, query, offset, limit);
    } catch (_) {
    }
  }
  return executeMaterialized(graph, query, form, offset, limit);
}

function describeError(error) {
  return {
    name: error && error.name ? String(error.name) : "Error",
    message: error && error.message ? String(error.message) : String(error),
  };
}

self.addEventListener("message", async (event) => {
  const message = event.data || {};
  const { id, op } = message;
  try {
    let result;
    if (op === "open") {
      const graph = await openGraph(message.url);
      result = {
        quads: graph.quads,
        info: graph.info(),
        card: graph.card(),
        examples: graph.examples(),
        contentHash: graph.contentHash(),
        stats: serializeStats(graph),
      };
    } else if (op === "query") {
      const graph = await openGraph(message.url);
      result = executeQuery(
        graph,
        String(message.query || ""),
        Math.max(0, Number(message.offset) || 0),
        Math.max(1, Number(message.limit) || 50),
      );
    } else if (op === "page") {
      const handle = rowHandles.get(Number(message.resultId));
      if (!handle) {
        throw new Error("Risultato non più disponibile: riesegui la query");
      }
      const offset = Math.max(0, Number(message.offset) || 0);
      const limit = Math.max(1, Number(message.limit) || 50);
      const page = handle.rows.page(offset, limit);
      result = {
        form: "select",
        streaming: true,
        resultId: Number(message.resultId),
        vars: [...handle.rows.vars],
        total: handle.rows.length,
        offset,
        limit,
        rows: serializeRows(page),
        warnings: serializeWarnings(handle.rows.lastWarnings()),
        stats: serializeStats(handle.graph),
      };
    } else if (op === "free") {
      const resultId = Number(message.resultId);
      const handle = rowHandles.get(resultId);
      if (handle) {
        rowHandles.delete(resultId);
        try {
          handle.rows.free();
        } catch (_) {
        }
      }
      result = { freed: Boolean(handle) };
    } else if (op === "close") {
      releaseAllRows();
      graphs.clear();
      result = { closed: true };
    } else {
      throw new Error(`Operazione worker sconosciuta: ${op}`);
    }
    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({ id, ok: false, error: describeError(error) });
  }
});
