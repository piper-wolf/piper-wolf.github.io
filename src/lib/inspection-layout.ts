import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import type { SimilarityEdge } from "./inspection-graph";
import { layoutBounds, spiralPosition, type GraphPosition } from "./inspection-view";

export interface LayoutBatch {
  nodes: Array<GraphPosition & { id: string }>;
  edges: SimilarityEdge[];
  frame: GraphPosition & { radius: number };
}

export type LayoutResult = { positions: Map<string, GraphPosition> } | { error: string };

export function layoutBySimilarity(
  nodes: Array<{ id: string; x?: number; y?: number }>,
  edges: SimilarityEdge[],
) {
  const graph = new Graph();
  const occupied = new Set<string>();
  nodes.forEach(({ id, x, y }, index) => {
    const position = x === undefined || y === undefined ? spiralPosition(index, 3) : { x, y };
    const key = `${position.x},${position.y}`;
    if (occupied.has(key)) {
      const offset = spiralPosition(index, 0.01);
      position.x += offset.x;
      position.y += offset.y;
    }
    occupied.add(key);
    graph.addNode(id, position);
  });
  for (const { source, target, score } of edges) graph.addUndirectedEdge(source, target, { score });

  if (graph.order > 1) {
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

export function layoutFilteredBusinesses(batches: LayoutBatch[]): Map<string, GraphPosition> {
  const result = new Map<string, GraphPosition>();
  for (const { nodes, edges, frame } of batches) {
    const relativeNodes = nodes.map(({ id, x, y }) => ({ id, x: x - frame.x, y: y - frame.y }));
    const positions = layoutBySimilarity(relativeNodes, edges);
    const bounds = layoutBounds(positions.values());
    if (!bounds) continue;
    const centerX = (bounds.x[0] + bounds.x[1]) / 2;
    const centerY = (bounds.y[0] + bounds.y[1]) / 2;
    const extent = Math.max(bounds.x[1] - bounds.x[0], bounds.y[1] - bounds.y[0]);
    const scale = extent > 0 ? frame.radius * 2 / extent : 1;
    for (const [id, { x, y }] of positions) {
      result.set(id, { x: frame.x + (x - centerX) * scale, y: frame.y + (y - centerY) * scale });
    }
  }
  return result;
}
