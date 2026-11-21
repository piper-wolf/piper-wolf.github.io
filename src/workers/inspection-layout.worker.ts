import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import type { GraphNode, SimilarityEdge } from "../lib/inspection-graph";

export type LayoutRequest =
  | { type: "start"; nodes: Pick<GraphNode, "id" | "x" | "y">[]; edges: SimilarityEdge[] }
  | { type: "step" };

const graph = new Graph();
const worker = self as unknown as {
  onmessage: (event: MessageEvent<LayoutRequest>) => void;
  postMessage: (positions: Float32Array, transfers: Transferable[]) => void;
};

worker.onmessage = ({ data }) => {
  if (data.type === "start") {
    for (const { id, x, y } of data.nodes) graph.addNode(id, { x, y });
    for (const { source, target, score } of data.edges) graph.addUndirectedEdge(source, target, { score });
  }

  // Batch iterations so Sigma refreshes the graph once per batch.
  forceAtlas2.assign(graph, { iterations: 5, getEdgeWeight: "score", settings: forceAtlas2.inferSettings(graph) });
  const positions = new Float32Array(graph.order * 2);
  graph.forEachNode((id, { x, y }) => {
    positions[Number(id) * 2] = x;
    positions[Number(id) * 2 + 1] = y;
  });
  worker.postMessage(positions, [positions.buffer]);
};
