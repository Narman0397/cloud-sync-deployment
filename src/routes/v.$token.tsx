// Legacy verifier — konsolidasi ke /verify/$token.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/v/$token")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/verify/$token", params: { token: params.token } });
  },
});
