// Phase 2A — Server functions Workflow Builder.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getUserContext } from "@/features/rbac/guards";
import {
  listWorkflows,
  getWorkflowById,
  createWorkflow,
  archiveWorkflow,
  cloneWorkflow,
  type WorkflowListFilter,
} from "@/features/workflows/services/workflow-builder.service";
import {
  listVersions,
  ensureDraftVersion,
  saveDraftGraph,
  publishVersion,
  createNewDraftFromVersion,
  getVersion,
} from "@/features/workflows/services/workflow-version.service";
import { validateGraph } from "@/features/workflows/services/workflow-validation.service";
import {
  listWorkflowTemplates,
  createWorkflowTemplate,
  seedBuiltInTemplates,
  getTemplateGraph,
} from "@/features/workflows/services/workflow-template.service";
import { writeWorkflowAudit } from "@/features/workflows/services/workflow-audit.service";
import { emptyGraph } from "@/features/workflows/schema/defaults";
import type { WorkflowGraph } from "@/features/workflows/schema/types";
import { NODE_TYPES, ASSIGNMENT_TYPES, NODE_ACTIONS } from "@/features/workflows/schema/types";

const NodeSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(NODE_TYPES),
  label: z.string().min(1).max(120),
  position: z.object({ x: z.number(), y: z.number() }),
  sla_hours: z.number().int().min(0).max(8760).nullable().optional(),
  config: z
    .object({
      description: z.string().max(2000).optional(),
      required: z.boolean().optional(),
      allow_comment: z.boolean().optional(),
      allow_attachment: z.boolean().optional(),
      allow_delegation: z.boolean().optional(),
      parallel_mode: z.enum(["all", "any"]).optional(),
      actions: z.array(z.enum(NODE_ACTIONS)).optional(),
      assignment: z
        .object({
          type: z.enum(ASSIGNMENT_TYPES),
          user_id: z.string().uuid().nullable().optional(),
          role: z.string().max(80).nullable().optional(),
          opd_id: z.string().uuid().nullable().optional(),
          department: z.string().max(120).nullable().optional(),
          same_opd_as_applicant: z.boolean().optional(),
        })
        .partial({})
        .optional(),
      escalation: z
        .object({
          enabled: z.boolean(),
          after_hours: z.number().int().min(0).max(8760).optional(),
          escalate_to_type: z.enum(["manager", "user", "role"]).optional(),
          escalate_to_user_id: z.string().uuid().nullable().optional(),
          escalate_to_role: z.string().max(80).nullable().optional(),
        })
        .optional(),
      notifications: z
        .object({ email: z.boolean(), in_app: z.boolean() })
        .optional(),
    })
    .passthrough(),
});

const EdgeSchema = z.object({
  id: z.string().min(1).max(120),
  from: z.string().min(1).max(80),
  to: z.string().min(1).max(80),
  label: z.string().max(120).optional(),
  kind: z.enum(["approve", "reject", "revision", "default"]),
  condition: z.unknown().nullable().optional(),
});

const GraphSchema = z.object({ nodes: z.array(NodeSchema), edges: z.array(EdgeSchema) });

async function requireWorkflowAccess(id: string, userId: string) {
  const wf = await getWorkflowById(supabaseAdmin, id);
  if (!wf) throw new Error("Workflow tidak ditemukan");
  const ctx = await getUserContext(supabaseAdmin, userId);
  const allowed =
    ctx.isElevated ||
    (wf.opd_pemilik_id && wf.opd_pemilik_id === ctx.opdId) ||
    !!wf.form_id; // form-based: legacy check via RLS
  if (!allowed) throw new Error("Akses ditolak");
  return { wf, ctx };
}

export const wfListWorkflows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tab: z.enum(["all", "active", "draft", "archived"]).default("all"),
        search: z.string().max(120).optional(),
        category: z.string().max(80).optional(),
        opdId: z.string().uuid().nullable().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const ctx = await getUserContext(supabaseAdmin, userId);
    const filter: WorkflowListFilter = {
      tab: data.tab,
      search: data.search,
      category: data.category,
      opdId: ctx.isElevated ? (data.opdId ?? null) : null,
      scopeOpdId: ctx.opdId ?? null,
      isElevated: ctx.isElevated,
    };
    return listWorkflows(supabaseAdmin, filter);
  });

export const wfCreateWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(3).max(200),
        code: z.string().trim().max(60).optional().nullable(),
        category: z.string().max(80).optional().nullable(),
        description: z.string().max(2000).optional().nullable(),
        form_id: z.string().uuid().optional().nullable(),
        opd_pemilik_id: z.string().uuid().optional().nullable(),
        from_template_id: z.string().uuid().optional().nullable(),
        clone_from_id: z.string().uuid().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const ctx = await getUserContext(supabaseAdmin, userId);
    if (!ctx.isElevated && !ctx.isAdminOpd) throw new Error("Akses ditolak");

    if (data.clone_from_id) {
      const cloned = await cloneWorkflow(supabaseAdmin, data.clone_from_id, userId);
      await writeWorkflowAudit(supabaseAdmin, {
        action: "workflow.clone",
        resource_type: "workflow",
        resource_id: cloned.id,
        user_id: userId,
        metadata: { source_id: data.clone_from_id },
      });
      return cloned;
    }

    const opdId = ctx.isElevated ? (data.opd_pemilik_id ?? null) : ctx.opdId;
    const created = await createWorkflow(supabaseAdmin, {
      name: data.name,
      code: data.code,
      category: data.category,
      description: data.description,
      opd_pemilik_id: opdId,
      form_id: data.form_id ?? null,
      userId,
    });
    let graph: WorkflowGraph = emptyGraph();
    if (data.from_template_id) {
      graph = await getTemplateGraph(supabaseAdmin, data.from_template_id);
    }
    const v = await ensureDraftVersion(supabaseAdmin, created.id, userId, graph);
    await supabaseAdmin
      .from("workflow_definitions")
      .update({ current_version_id: v.id })
      .eq("id", created.id);
    await writeWorkflowAudit(supabaseAdmin, {
      action: "workflow.create",
      resource_type: "workflow",
      resource_id: created.id,
      user_id: userId,
      metadata: { name: data.name, from_template: data.from_template_id ?? null },
    });
    return created;
  });

export const wfArchiveWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireWorkflowAccess(data.id, userId);
    await archiveWorkflow(supabaseAdmin, data.id);
    await writeWorkflowAudit(supabaseAdmin, {
      action: "workflow.archive",
      resource_type: "workflow",
      resource_id: data.id,
      user_id: userId,
    });
    return { ok: true };
  });

export const wfGetWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { wf } = await requireWorkflowAccess(data.id, userId);
    const versions = await listVersions(supabaseAdmin, wf.id);
    let current = versions.find((v) => v.id === wf.current_version_id) ?? versions[0] ?? null;
    if (!current) {
      current = await ensureDraftVersion(supabaseAdmin, wf.id, userId, emptyGraph());
      await supabaseAdmin
        .from("workflow_definitions")
        .update({ current_version_id: current.id })
        .eq("id", wf.id);
    }
    return { workflow: wf, versions, current };
  });

export const wfSaveDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workflow_id: z.string().uuid(),
        version_id: z.string().uuid(),
        graph: GraphSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireWorkflowAccess(data.workflow_id, userId);
    await saveDraftGraph(supabaseAdmin, data.version_id, data.graph as WorkflowGraph);
    await writeWorkflowAudit(supabaseAdmin, {
      action: "workflow.update",
      resource_type: "workflow_version",
      resource_id: data.version_id,
      user_id: userId,
      metadata: { node_count: data.graph.nodes.length, edge_count: data.graph.edges.length },
    });
    return { ok: true };
  });

export const wfPublishVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workflow_id: z.string().uuid(),
        version_id: z.string().uuid(),
        graph: GraphSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireWorkflowAccess(data.workflow_id, userId);
    const result = validateGraph(data.graph as WorkflowGraph);
    if (!result.ok) {
      throw new Error(
        `Validasi gagal: ${result.issues.map((i) => i.message).join("; ")}`,
      );
    }
    await saveDraftGraph(supabaseAdmin, data.version_id, data.graph as WorkflowGraph);
    await publishVersion(supabaseAdmin, data.version_id, userId);
    await writeWorkflowAudit(supabaseAdmin, {
      action: "workflow.publish",
      resource_type: "workflow_version",
      resource_id: data.version_id,
      user_id: userId,
    });
    return { ok: true };
  });

export const wfCreateNewVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ workflow_id: z.string().uuid(), base_version_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireWorkflowAccess(data.workflow_id, userId);
    const v = await createNewDraftFromVersion(supabaseAdmin, data.workflow_id, data.base_version_id, userId);
    await writeWorkflowAudit(supabaseAdmin, {
      action: "workflow.version.create",
      resource_type: "workflow_version",
      resource_id: v.id,
      user_id: userId,
      metadata: { version_number: v.version_number },
    });
    return { id: v.id };
  });

export const wfValidateGraph = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ graph: GraphSchema }).parse(input))
  .handler(async ({ data }) => validateGraph(data.graph as WorkflowGraph));

export const wfGetVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ workflow_id: z.string().uuid(), version_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireWorkflowAccess(data.workflow_id, userId);
    return getVersion(supabaseAdmin, data.version_id);
  });

// ---------------- Templates ----------------
export const wfListTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        scope: z.enum(["global", "opd"]).optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
        category: z.string().max(80).optional(),
        search: z.string().max(120).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => listWorkflowTemplates(supabaseAdmin, data));

export const wfCreateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(3).max(200),
        code: z.string().max(60).optional().nullable(),
        description: z.string().max(2000).optional().nullable(),
        category: z.string().max(80).optional().nullable(),
        scope: z.enum(["global", "opd"]).default("opd"),
        opd_pemilik_id: z.string().uuid().optional().nullable(),
        graph: GraphSchema.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const ctx = await getUserContext(supabaseAdmin, userId);
    if (!ctx.isElevated && !ctx.isAdminOpd) throw new Error("Akses ditolak");
    if (data.scope === "global" && !ctx.isElevated) {
      throw new Error("Template global hanya boleh dibuat Super Admin / Admin Pemda");
    }
    const ownerOpd =
      data.scope === "global" ? null : ctx.isElevated ? (data.opd_pemilik_id ?? null) : ctx.opdId;
    const result = await createWorkflowTemplate(supabaseAdmin, {
      name: data.name,
      code: data.code,
      description: data.description,
      category: data.category,
      scope: data.scope,
      owner_opd_id: ownerOpd,
      graph: data.graph as WorkflowGraph | undefined,
      userId,
    });
    await writeWorkflowAudit(supabaseAdmin, {
      action: "template.create",
      resource_type: "workflow_template",
      resource_id: result.id,
      user_id: userId,
      metadata: { scope: data.scope, name: data.name },
    });
    return result;
  });

export const wfSeedBuiltInTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const ctx = await getUserContext(supabaseAdmin, userId);
    if (!ctx.isElevated) throw new Error("Akses ditolak");
    const inserted = await seedBuiltInTemplates(supabaseAdmin, userId);
    return { inserted };
  });

async function requireWfTemplateManage(id: string, userId: string) {
  const { data: tpl, error } = await supabaseAdmin
    .from("workflow_templates")
    .select("id,scope,owner_opd_id,status")
    .eq("id", id)
    .maybeSingle();
  if (error || !tpl) throw new Error("Template tidak ditemukan");
  const ctx = await getUserContext(supabaseAdmin, userId);
  const isOwner = !!tpl.owner_opd_id && ctx.opdId === tpl.owner_opd_id;
  if (!ctx.isElevated && !(ctx.isAdminOpd && isOwner)) throw new Error("Akses ditolak");
  return { tpl, ctx };
}

export const wfPublishTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireWfTemplateManage(data.id, userId);
    const { error } = await supabaseAdmin
      .from("workflow_templates")
      .update({ status: "published" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeWorkflowAudit(supabaseAdmin, {
      action: "template.publish",
      resource_type: "workflow_template",
      resource_id: data.id,
      user_id: userId,
    });
    return { ok: true };
  });

export const wfArchiveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireWfTemplateManage(data.id, userId);
    const { error } = await supabaseAdmin
      .from("workflow_templates")
      .update({ status: "archived" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeWorkflowAudit(supabaseAdmin, {
      action: "template.archive",
      resource_type: "workflow_template",
      resource_id: data.id,
      user_id: userId,
    });
    return { ok: true };
  });
