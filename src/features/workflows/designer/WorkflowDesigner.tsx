// Phase 2A — Workflow Designer (orchestrator: palette + canvas + properties).
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  wfSaveDraft,
  wfPublishVersion,
  wfCreateNewVersion,
} from "@/lib/workflow-builder.functions";
import { NodePalette } from "./NodePalette";
import { WorkflowCanvas } from "./WorkflowCanvas";
import { PropertiesPanel } from "./PropertiesPanel";
import { WorkflowPreview } from "./WorkflowPreview";
import { validateGraph, type ValidationResult } from "@/features/workflows/services/workflow-validation.service";
import { createNode } from "@/features/workflows/schema/defaults";
import type {
  NodeType,
  WorkflowGraph,
  WorkflowNode,
} from "@/features/workflows/schema/types";
import { AlertCircle, CheckCircle2, Eye, Save, Send, Plus } from "lucide-react";

export interface DesignerProps {
  workflowId: string;
  versionId: string;
  versionNumber: number;
  locked: boolean;
  submissionCount: number;
  versionStatus: string;
  initialGraph: WorkflowGraph;
  onAfterCreateVersion: (newVersionId: string) => void;
}

export function WorkflowDesigner({
  workflowId,
  versionId,
  versionNumber,
  locked,
  submissionCount,
  versionStatus,
  initialGraph,
  onAfterCreateVersion,
}: DesignerProps) {
  const [graph, setGraph] = useState<WorkflowGraph>(initialGraph);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  const editable = !locked && versionStatus === "draft" && submissionCount === 0;

  const saveDraft = useServerFn(wfSaveDraft);
  const publish = useServerFn(wfPublishVersion);
  const createVer = useServerFn(wfCreateNewVersion);

  // Reset graph saat versi berubah
  useEffect(() => {
    setGraph(initialGraph);
    setDirty(false);
    setSelectedId(null);
  }, [versionId, initialGraph]);

  const validation: ValidationResult = useMemo(() => validateGraph(graph), [graph]);

  const updateGraph = useCallback((g: WorkflowGraph) => {
    setGraph(g);
    setDirty(true);
  }, []);

  const handleAdd = (type: NodeType) => {
    if (!editable) return;
    const offset = { x: 120 + graph.nodes.length * 40, y: 200 };
    const node = createNode(type, offset);
    updateGraph({ ...graph, nodes: [...graph.nodes, node] });
    setSelectedId(node.id);
  };

  const handleNodeChange = (n: WorkflowNode) => {
    const oldId = selectedId;
    updateGraph({
      ...graph,
      nodes: graph.nodes.map((x) => (x.id === oldId ? n : x)),
      edges:
        oldId && oldId !== n.id
          ? graph.edges.map((e) => ({
              ...e,
              from: e.from === oldId ? n.id : e.from,
              to: e.to === oldId ? n.id : e.to,
            }))
          : graph.edges,
    });
    if (oldId !== n.id) setSelectedId(n.id);
  };

  const handleDelete = (id: string) => {
    updateGraph({
      nodes: graph.nodes.filter((n) => n.id !== id),
      edges: graph.edges.filter((e) => e.from !== id && e.to !== id),
    });
    setSelectedId(null);
  };

  const doSave = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await saveDraft({ data: { workflow_id: workflowId, version_id: versionId, graph } });
      setDirty(false);
      setMessage({ kind: "ok", text: "Draft tersimpan." });
    } catch (err) {
      setMessage({ kind: "err", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const doPublish = async () => {
    if (!validation.ok) {
      setMessage({ kind: "err", text: "Tidak dapat publish: ada error validasi." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await publish({ data: { workflow_id: workflowId, version_id: versionId, graph } });
      setDirty(false);
      setMessage({ kind: "ok", text: "Versi dipublish & aktif." });
    } catch (err) {
      setMessage({ kind: "err", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const doCreateNewVersion = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await createVer({
        data: { workflow_id: workflowId, base_version_id: versionId },
      });
      onAfterCreateVersion(res.id);
      setMessage({ kind: "ok", text: "Versi draft baru dibuat." });
    } catch (err) {
      setMessage({ kind: "err", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[520px] flex-col rounded-lg border border-border bg-background">
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2 text-sm">
        <span className="font-semibold">Version {versionNumber}</span>
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs uppercase">
          {versionStatus}
        </span>
        {!editable ? (
          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
            Locked
          </span>
        ) : null}
        <span className="ml-2 text-xs text-muted-foreground">
          {graph.nodes.length} nodes • {graph.edges.length} edges
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
            onClick={() => setShowPreview((v) => !v)}
          >
            <Eye className="h-3.5 w-3.5" />
            {showPreview ? "Hide Preview" : "Preview"}
          </button>
          {editable ? (
            <>
              <button
                type="button"
                disabled={busy || !dirty}
                onClick={doSave}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                Save Draft
              </button>
              <button
                type="button"
                disabled={busy || !validation.ok}
                onClick={doPublish}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                Publish
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={doCreateNewVersion}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Create New Version
            </button>
          )}
        </div>
      </header>

      {message ? (
        <div
          className={`border-b border-border px-3 py-1.5 text-xs ${
            message.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {validation.issues.length > 0 ? (
        <div className="border-b border-border bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <div className="mb-1 flex items-center gap-1 font-semibold">
            <AlertCircle className="h-3.5 w-3.5" />
            {validation.issues.length} masalah validasi
          </div>
          <ul className="list-inside list-disc">
            {validation.issues.slice(0, 6).map((i, idx) => (
              <li key={idx}>{i.message}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="border-b border-border bg-emerald-50 px-3 py-1 text-xs text-emerald-800">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Workflow valid & siap publish.
          </span>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <NodePalette onAdd={handleAdd} />
        <div className="min-w-0 flex-1">
          {showPreview ? (
            <div className="p-3">
              <WorkflowPreview graph={graph} />
            </div>
          ) : (
            <WorkflowCanvas
              graph={graph}
              selectedId={selectedId}
              disabled={!editable}
              onChange={updateGraph}
              onSelect={setSelectedId}
            />
          )}
        </div>
        <PropertiesPanel
          graph={graph}
          selectedId={selectedId}
          disabled={!editable}
          onChange={handleNodeChange}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
