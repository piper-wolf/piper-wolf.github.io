import Papa from "papaparse";
import {
  buildSimilarityGraph, InspectionAggregator, latestDataDate, profileBusinesses, selectRelevantRestaurants,
  type GraphNode, type InspectionCsvRow, type SimilarityEdge,
} from "../lib/inspection-graph";
import { layoutBySimilarity } from "../lib/inspection-layout";
import { defaultInspectionFilters, filterBusinesses, type GraphPosition, type InspectionFilters } from "../lib/inspection-view";

export type WorkerRequest =
  | { type: "load"; csvUrl: string }
  | { type: "filter"; requestId: number; filters: InspectionFilters };

interface InspectionView {
  nodes: GraphNode[];
  edges: SimilarityEdge[];
  matchingCount: number;
}

type WorkerProgress = {
  type: "progress";
  phase: "reading" | "scoring" | "layout";
  rowCount: number;
  restaurantCount?: number;
  candidatePairsScored?: number;
};

export type WorkerResult = WorkerProgress
  | (InspectionView & { type: "ready"; cities: string[]; positions: Map<string, GraphPosition> })
  | (InspectionView & { type: "filtered"; requestId: number })
  | { type: "error"; message: string; requestId?: number };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResult) => void;
};

let eligibleBusinesses: GraphNode[] = [];
let referenceDate = "";

async function readCsvResponse(response: Response): Promise<string> {
  if (!response.body) throw new Error("Inspection data response has no body.");

  const reader = response.body.getReader();
  const firstChunk = await reader.read();
  const firstBytes = firstChunk.value ?? new Uint8Array(0);
  const isGzip = firstBytes[0] === 0x1f && firstBytes[1] === 0x8b;
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
  return new Response(isGzip ? source.pipeThrough(gzipTransform) : source).text();
}

function buildView(filters: InspectionFilters, rowCount?: number): InspectionView {
  const matches = filterBusinesses(eligibleBusinesses, filters);
  const nodes = selectRelevantRestaurants(matches, referenceDate);

  if (rowCount !== undefined) {
    workerScope.postMessage({ type: "progress", phase: "scoring", rowCount, restaurantCount: nodes.length });
  }
  const { edges } = buildSimilarityGraph(nodes, {
    onProgress(candidatePairsScored) {
      if (rowCount !== undefined) workerScope.postMessage({
        type: "progress", phase: "scoring", rowCount, restaurantCount: nodes.length, candidatePairsScored,
      });
    },
  });
  return { nodes, edges, matchingCount: matches.length };
}

async function loadInspectionData(csvUrl: string) {
  try {
    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error(`Inspection data request failed (${response.status}).`);
    const csvText = await readCsvResponse(response);
    const aggregator = new InspectionAggregator();
    let rowCount = 0;

    await new Promise<void>((resolve, reject) => {
      Papa.parse<InspectionCsvRow>(csvText, {
        chunkSize: 5 * 1024 * 1024,
        header: true,
        skipEmptyLines: "greedy",
        chunk(results: Papa.ParseResult<InspectionCsvRow>) {
          for (const row of results.data) {
            aggregator.addRow(row);
            rowCount++;
          }
          workerScope.postMessage({ type: "progress", phase: "reading", rowCount });
        },
        complete: () => resolve(),
        error: reject,
      });
    });

    const { restaurants } = aggregator.finish();
    referenceDate = latestDataDate(restaurants);
    eligibleBusinesses = profileBusinesses(restaurants, referenceDate);
    const cities = [...new Set(eligibleBusinesses.map(({ city }) => city.toUpperCase()).filter(Boolean))];
    const view = buildView(defaultInspectionFilters, rowCount);
    workerScope.postMessage({ type: "progress", phase: "layout", rowCount });
    const positions = layoutBySimilarity(view.nodes, view.edges);
    workerScope.postMessage({ type: "ready", ...view, cities, positions });
  } catch (error) {
    workerScope.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Could not load the inspection CSV.",
    });
  }
}

workerScope.onmessage = ({ data }) => {
  if (data.type === "load") {
    void loadInspectionData(data.csvUrl);
    return;
  }
  try {
    workerScope.postMessage({ type: "filtered", requestId: data.requestId, ...buildView(data.filters) });
  } catch (error) {
    workerScope.postMessage({
      type: "error", requestId: data.requestId,
      message: error instanceof Error ? error.message : "Could not filter the inspection data.",
    });
  }
};
