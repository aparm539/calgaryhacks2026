"use client";

// React Flow wrapper component — renders an interactive node/edge diagram
// from a JSON string. Supports drag, connect, and select interactions.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";

// Props: `code` is a JSON string with { nodes, edges }
type FlowDiagramProps = {
  code: string;
};

// Shape of the parsed JSON before normalization
type FlowJson = {
  nodes?: Node[];
  edges?: Edge[];
};

// Safely parse the JSON string into a FlowJson object
function parseFlowJson(code: string): FlowJson | null {
  try {
    const parsed = JSON.parse(code) as FlowJson;
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// Ensure every node/edge has a unique ID and valid position.
// Returns empty arrays when there is no data (empty canvas).
function normalizeFlow(parsed: FlowJson | null): { nodes: Node[]; edges: Edge[] } {
  if (!parsed?.nodes?.length) {
    return { nodes: [], edges: [] };
  }

  const usedNodeIds = new Set<string>();
  const normalizedNodes = parsed.nodes.map((node, index) => {
    const baseId =
      typeof node.id === "string" && node.id.trim().length
        ? node.id.trim()
        : `n${index + 1}`;

    let id = baseId;
    let suffix = 1;
    while (usedNodeIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    usedNodeIds.add(id);

    return {
      ...node,
      id,
      position: node.position ?? { x: index * 180, y: 0 },
      data: node.data ?? { label: id },
    };
  });

  const usedEdgeIds = new Set<string>();
  const normalizedEdges = (parsed.edges ?? [])
    .filter((edge) => edge.source && edge.target)
    .map((edge, index) => {
      const source = String(edge.source);
      const target = String(edge.target);
      const baseId =
        typeof edge.id === "string" && edge.id.trim().length
          ? edge.id.trim()
          : `e-${source}-${target}-${index + 1}`;

      let id = baseId;
      let suffix = 1;
      while (usedEdgeIds.has(id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }
      usedEdgeIds.add(id);

      return {
        ...edge,
        id,
        source,
        target,
      };
    });

  return { nodes: normalizedNodes, edges: normalizedEdges };
}



// Main component — parses code prop, normalizes, and renders React Flow canvas
export function FlowDiagram({ code }: FlowDiagramProps) {
  const parsed = useMemo(() => parseFlowJson(code), [code]);
  const initialFlow = useMemo(() => normalizeFlow(parsed), [parsed]);

  const [nodes, setNodes] = useState<Node[]>(initialFlow.nodes);
  const [edges, setEdges] = useState<Edge[]>(initialFlow.edges);

  // Sync state when the code prop changes (e.g. new data from parent)
  useEffect(() => {
    setNodes(initialFlow.nodes);
    setEdges(initialFlow.edges);
  }, [initialFlow]);

  // Handle user dragging nodes
  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot));
    },
    []
  );

  // Handle user removing or selecting edges
  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot));
    },
    []
  );

  // Handle user drawing a new edge between two nodes
  const onConnect = useCallback((params: Connection) => {
    setEdges((edgesSnapshot) =>
      addEdge(
        {
          ...params,
          id: `e-${params.source}-${params.target}-${crypto.randomUUID()}`,
        },
        edgesSnapshot
      )
    );
  }, []);

  return (
    <div className="h-[360px] w-full overflow-hidden rounded-lg border bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
