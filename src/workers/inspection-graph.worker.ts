import Papa from "papaparse";
import { buildSimilarityGraph, InspectionAggregator, type InspectionCsvRow } from "../lib/inspection-graph";

type WorkerRequest = { csvUrl: string };
type WorkerProgress = {
  type: "progress";
  phase: "reading" | "scoring";
  rowCount: number;
  restaurantCount?: number;
  candidatePairsScored?: number;
};
type WorkerResult = WorkerProgress | {
  type: "ready";
  nodes: ReturnType<typeof buildSimilarityGraph>["nodes"];
  edges: ReturnType<typeof buildSimilarityGraph>["edges"];
  aggregationStats: ReturnType<InspectionAggregator["finish"]>["stats"];
  similarityStats: ReturnType<typeof buildSimilarityGraph>["stats"];
  parseErrorCount: number;
  compressedBytes: number;
  processingMs: number;
  scoringMs: number;
} | { type: "error"; message: string };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResult) => void;
};

async function readCsvResponse(response: Response): Promise<string> {
  if (!response.body) throw new Error("Inspection data response has no body.");

  const reader = response.body.getReader();
  const firstChunk = await reader.read();
  const firstBytes = firstChunk.value ?? new Uint8Array(0);
  const isGzip = firstBytes?.[0] === 0x1f && firstBytes[1] === 0x8b;
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      if (firstChunk.done) controller.close();
      else controller.enqueue(firstBytes);
    },
    async pull(controller) {
      const nextChunk = await reader.read();
      if (nextChunk.done) controller.close();
      else controller.enqueue(nextChunk.value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });

  // Fetch transparently decodes Content-Encoding: gzip. Some static hosts serve
  // the .gz asset as a file instead, so inspect its first bytes before decoding.
  const gzipTransform = new DecompressionStream("gzip") as unknown as TransformStream<Uint8Array, Uint8Array>;
  const decoded = isGzip ? source.pipeThrough(gzipTransform) : source;
  return new Response(decoded).text();
}

async function loadInspectionData(data: WorkerRequest) {
  const startedAt = performance.now();
  const aggregator = new InspectionAggregator();
  let parseErrorCount = 0;
  let rowCount = 0;

  try {
    const response = await fetch(data.csvUrl);
    if (!response.ok) throw new Error(`Inspection data request failed (${response.status}).`);
    const compressedBytes = Number(response.headers.get("content-length")) || 0;
    const csvText = await readCsvResponse(response);

    Papa.parse<InspectionCsvRow>(csvText, {
      chunkSize: 5 * 1024 * 1024,
    header: true,
    skipEmptyLines: "greedy",
    chunk(results: Papa.ParseResult<InspectionCsvRow>) {
      parseErrorCount += results.errors.length;
      for (const row of results.data) {
        aggregator.addRow(row);
        rowCount++;
      }
      workerScope.postMessage({
        type: "progress",
        phase: "reading",
        rowCount,
      });
    },
    complete() {
      try {
        const processed = aggregator.finish();
        const processingMs = performance.now() - startedAt;
        const scoringStartedAt = performance.now();
        workerScope.postMessage({
          type: "progress",
          phase: "scoring",
          rowCount: processed.stats.rowCount,
          restaurantCount: processed.stats.restaurantCount,
        });
        const graph = buildSimilarityGraph(processed.restaurants, {
          onProgress(candidatePairsScored) {
            workerScope.postMessage({
              type: "progress",
              phase: "scoring",
              rowCount: processed.stats.rowCount,
              restaurantCount: processed.stats.restaurantCount,
              candidatePairsScored,
            });
          },
        });
        workerScope.postMessage({
          type: "ready",
          nodes: graph.nodes,
          edges: graph.edges,
          aggregationStats: processed.stats,
          similarityStats: graph.stats,
          parseErrorCount,
          compressedBytes,
          processingMs: Math.round(processingMs),
          scoringMs: Math.round(performance.now() - scoringStartedAt),
        });
      } catch (error) {
        workerScope.postMessage({
          type: "error",
          message: error instanceof Error ? error.message : "Could not build the restaurant graph.",
        });
      }
    },
    error(error: Error) {
      workerScope.postMessage({
        type: "error",
        message: error.message || "Could not load the inspection CSV.",
      });
    },
    });
  } catch (error) {
    workerScope.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Could not load the inspection CSV.",
    });
  }
}

workerScope.onmessage = ({ data }) => void loadInspectionData(data);
