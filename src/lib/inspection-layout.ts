import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import type { GraphNode, SimilarityEdge } from "./inspection-graph";
import { spiralPosition } from "./inspection-view";

export function layoutBySimilarity(nodes: GraphNode[], edges: SimilarityEdge[]) {
  const graph = new Graph();
  nodes.forEach(({ id }, index) => graph.addNode(id, spiralPosition(index, 3)));
  for (const { source, target, score } of edges) graph.addUndirectedEdge(source, target, { score });

  if (edges.length) {
    forceAtlas2.assign(graph, {
      iterations: 180,
      getEdgeWeight: "score",
      settings: {
        ...forceAtlas2.inferSettings(graph),
        barnesHutOptimize: true,
        gravity: 0.25,
        slowDown: 2,
      },
    });
  }
  return new Map(graph.mapNodes((id, { x, y }) => [id, { x, y }]));
}
