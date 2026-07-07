// Form Builder index — redirect ke tab "Buat Form" (wizard).
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/form-builder/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/form-builder/wizard" });
  },
  component: () => null,
});
