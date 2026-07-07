import { createFileRoute } from "@tanstack/react-router";
import { DocumentsTable } from "@/features/document-center/components/DocumentsTable";

type SearchState = {
  q?: string;
  statuses?: string;
  from?: string;
  to?: string;
};

export const Route = createFileRoute("/_authenticated/admin/document-center/documents")({
  head: () => ({ meta: [{ title: "Dokumen — Document Center" }] }),
  validateSearch: (raw: Record<string, unknown>): SearchState => ({
    q: typeof raw.q === "string" ? raw.q : undefined,
    statuses: typeof raw.statuses === "string" ? raw.statuses : undefined,
    from: typeof raw.from === "string" ? raw.from : undefined,
    to: typeof raw.to === "string" ? raw.to : undefined,
  }),
  component: () => (
    <DocumentsTable routeId="/_authenticated/admin/document-center/documents" />
  ),
});
