// Phase 1B.2 — Wizard payload kontrak.
// Tidak menyentuh tabel forms hingga user "Finish & Create".
// Disimpan ke localStorage + tabel form_wizard_drafts (server, RLS per-user).
import type { FormField } from "@/features/forms/schema/types";
import type { PrefillMapping } from "@/features/forms/services/form-prefill.service";
import type { Target } from "@/features/forms/builder/types";
import type { Database } from "@/integrations/supabase/types";

export type EmploymentType = Database["public"]["Enums"]["employment_type"];

export const WIZARD_STEPS = [
  "general",
  "employment",
  "design",
  "validation",
  "permissions",
  "notifications",
  "review",
] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export const STEP_LABEL: Record<WizardStep, string> = {
  general: "General",
  employment: "Employment Type",
  design: "Design",
  validation: "Validation",
  permissions: "Permissions",
  notifications: "Notifications",
  review: "Review",
};

export interface WizardGeneral {
  name: string;
  code: string;
  description: string;
  category: string;
  sla_days: number | null;
}

export interface WizardEmployment {
  types: EmploymentType[];
}

export interface WizardPermissions {
  opd_pemilik_id: string | null;
  allow_multiple_submit: boolean;
  is_public: boolean;
  show_in_open_data: boolean;
  public_slug: string | null;
}

export interface WizardNotifications {
  notify_on_submit: boolean;
  notify_on_approve_reject: boolean;
  notify_on_disposition: boolean;
}

export interface WizardPayload {
  general: WizardGeneral;
  employment: WizardEmployment;
  targets: Target[];
  design: { fields: FormField[] };
  permissions: WizardPermissions;
  notifications: WizardNotifications;
  prefillMapping: PrefillMapping[];
}

export function emptyPayload(): WizardPayload {
  return {
    general: { name: "", code: "", description: "", category: "", sla_days: null },
    employment: { types: [] },
    targets: [],
    design: { fields: [] },
    permissions: {
      opd_pemilik_id: null,
      allow_multiple_submit: false,
      is_public: false,
      show_in_open_data: false,
      public_slug: null,
    },
    notifications: {
      notify_on_submit: true,
      notify_on_approve_reject: true,
      notify_on_disposition: false,
    },
    prefillMapping: [],
  };
}

export function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^([0-9])/, "f_$1")
    .slice(0, 60) || "field";
}
