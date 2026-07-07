// Phase 2A — Workflow Canvas (visual editor, @xyflow/react).
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  type Edge,
  type Node,
  type Connection,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type {
  EdgePathKind,
  NodeType,
  WorkflowEdge,
  WorkflowGraph,
} from "@/features/workflows/schema/types";
import { createNode } from "@/features/workflows/schema/defaults";

interface Props {
  graph: WorkflowGraph;
  selectedId: string | null;
  disabled?: boolean;
  onChange: (g: WorkflowGraph) => void;
  onSelect: (id: string | null) => void;
}

const NODE_COLORS: Record<NodeType, string> = {
  start: "#10b981",
  submit: "#3b82f6",
  review: "#6366f1",
  approval: "#8b5cf6",
  revision: "#f59e0b",
  disposisi: "#0ea5e9",
  signature: "#ec4899",
  parallel: "#64748b",
  completed: "#22c55e",
  rejected: "#ef4444",
};

function toRfNodes(g: WorkflowGraph, selectedId: string | null): Node[] {
  return g.nodes.map((n) => ({
    id: n.id,
    position: n.position,
    data: { label: n.label, type: n.type },
    selected: n.id === selectedId,
    style: {
      borderLeft: `4px solid ${NODE_COLORS[n.type]}`,
      background: "var(--card)",
      color: "var(--card-foreground)",
      borderRadius: 8,
      padding: 8,
      fontSize: 12,
      minWidth: 140,
    },
  }));
}

function toRfEdges(g: WorkflowGraph): Edge[] {
  return g.edges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    label: e.label ?? e.kind,
    animated: e.kind === "approve",
    style: {
      stroke:
        e.kind === "reject" ? "#ef4444" : e.kind === "revision" ? "#f59e0b" : "#64748b",
    },
    data: { kind: e.kind },
  }));
}

export function WorkflowCanvas({ graph, selectedId, disabled, onChange, onSelect }: Props) {
  const wrapper = useRef<HTMLDivElement>(null);
  const rfRef = useRef<ReactFlowInstance | null>(null);

  const rfNodes = useMemo(() => toRfNodes(graph, selectedId), [graph, selectedId]);
  const rfEdges = useMemo(() => toRfEdges(graph), [graph]);

  // Keep model in sync with canvas movement.
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (disabled) return;
      const next = applyNodeChanges(changes, rfNodes);
      const newGraph: WorkflowGraph = {
        ...graph,
        nodes: graph.nodes.map((n) => {
          const r = next.find((x) => x.id === n.id);
          if (!r) return n;
          return { ...n, position: r.position };
        }),
      };
      onChange(newGraph);
    },
    [disabled, graph, onChange, rfNodes],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (disabled) return;
      const next = applyEdgeChanges(changes, rfEdges);
      const keepIds = new Set(next.map((e) => e.id));
      onChange({ ...graph, edges: graph.edges.filter((e) => keepIds.has(e.id)) });
    },
    [disabled, graph, onChange, rfEdges],
  );

  const handleConnect = useCallback(
    (conn: Connection) => {
      if (disabled) return;
      if (!conn.source || !conn.target) return;
      const kind: EdgePathKind = "approve";
      const newEdge: WorkflowEdge = {
        id: `e_${conn.source}_${conn.target}_${Math.random().toString(36).slice(2, 6)}`,
        from: conn.source,
        to: conn.target,
        kind,
        label: "Lanjut",
      };
      const merged = addEdge(
        { ...conn, id: newEdge.id, animated: true },
        rfEdges,
      );
      void merged; // only used to validate; we update via model
      onChange({ ...graph, edges: [...graph.edges, newEdge] });
    },
    [disabled, graph, onChange, rfEdges],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      const type = e.dataTransfer.getData("application/wf-node-type") as NodeType;
      if (!type) return;
      const bounds = wrapper.current?.getBoundingClientRect();
      const proj = rfRef.current?.screenToFlowPosition({
        x: e.clientX - (bounds?.left ?? 0),
        y: e.clientY - (bounds?.top ?? 0),
      }) ?? { x: 100, y: 100 };
      const node = createNode(type, proj);
      onChange({ ...graph, nodes: [...graph.nodes, node] });
      onSelect(node.id);
    },
    [disabled, graph, onChange, onSelect],
  );

  // Lock interactions when disabled
  useEffect(() => {
    // nothing — handled via props on RF
  }, [disabled]);

  return (
    <div
      ref={wrapper}
      className="relative h-full w-full bg-muted/30"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onInit={(inst) => {
          rfRef.current = inst;
        }}
        onNodeClick={(_, n) => onSelect(n.id)}
        onPaneClick={() => onSelect(null)}
        nodesDraggable={!disabled}
        nodesConnectable={!disabled}
        elementsSelectable
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
