import type { ReteOpenResult, ReteQueryResult } from "../types";

const QUERY_TIMEOUT_MS = 30_000;
const OPEN_TIMEOUT_MS = 45_000;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: number;
}

interface WorkerResponse {
  id: number;
  ok: boolean;
  result?: unknown;
  error?: { name?: string; message?: string };
}

export function reteAssetUrl(file: string): string {
  return new URL(
    `${import.meta.env.BASE_URL}data/rete/${file}`,
    window.location.href,
  ).toString();
}

export class ReteSparqlClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(
      `${import.meta.env.BASE_URL}vendor/sparql-rete-worker.js`,
    );
    worker.addEventListener("message", this.handleMessage);
    worker.addEventListener("error", this.handleWorkerError);
    this.worker = worker;
    return worker;
  }

  private handleMessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    window.clearTimeout(pending.timer);
    if (message.ok) {
      pending.resolve(message.result);
      return;
    }
    pending.reject(
      new Error(message.error?.message || "Errore nel worker SPARQL"),
    );
  };

  private handleWorkerError = () => {
    this.failAll(new Error("Worker SPARQL non disponibile"));
  };

  private failAll(error: Error): void {
    for (const pending of this.pending.values()) {
      window.clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    if (this.worker) {
      this.worker.removeEventListener("message", this.handleMessage);
      this.worker.removeEventListener("error", this.handleWorkerError);
      this.worker.terminate();
      this.worker = null;
    }
  }

  private request<T>(
    op: string,
    payload: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<T> {
    const worker = this.ensureWorker();
    const id = this.nextId;
    this.nextId += 1;
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.failAll(
          new Error(
            `Timeout dopo ${Math.round(timeoutMs / 1000)} secondi: query interrotta`,
          ),
        );
      }, timeoutMs);
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });
      try {
        worker.postMessage({ id, op, ...payload });
      } catch (error) {
        window.clearTimeout(timer);
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  openDataset(url: string): Promise<ReteOpenResult> {
    return this.request<ReteOpenResult>("open", { url }, OPEN_TIMEOUT_MS);
  }

  query(
    url: string,
    query: string,
    offset = 0,
    limit = 50,
  ): Promise<ReteQueryResult> {
    return this.request<ReteQueryResult>(
      "query",
      { url, query, offset, limit },
      QUERY_TIMEOUT_MS,
    );
  }

  page(
    resultId: number,
    offset: number,
    limit: number,
  ): Promise<ReteQueryResult> {
    return this.request<ReteQueryResult>(
      "page",
      { resultId, offset, limit },
      QUERY_TIMEOUT_MS,
    );
  }

  freeResult(resultId: number | null | undefined): void {
    if (!resultId || !this.worker) return;
    void this.request("free", { resultId }, 5_000).catch(() => undefined);
  }

  dispose(): void {
    this.failAll(new Error("Client SPARQL chiuso"));
  }
}
