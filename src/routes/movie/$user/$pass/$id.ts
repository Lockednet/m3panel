import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/movie/$user/$pass/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { handleStream } = await import("@/lib/xtream.server");
        return handleStream(request, "movie", params.user, params.pass, params.id);
      },
    },
  },
});
