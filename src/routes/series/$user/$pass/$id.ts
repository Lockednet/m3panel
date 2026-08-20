import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/series/$user/$pass/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { handleStream } = await import("@/lib/xtream.server");
        return handleStream(request, "series", params.user, params.pass, params.id);
      },
    },
  },
});
