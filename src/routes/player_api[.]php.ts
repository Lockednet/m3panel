import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/player_api.php")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handlePlayerApi } = await import("@/lib/xtream.server");
        return handlePlayerApi(request);
      },
      POST: async ({ request }) => {
        const { handlePlayerApi } = await import("@/lib/xtream.server");
        return handlePlayerApi(request);
      },
    },
  },
});
