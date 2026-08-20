import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/player_api.php")({
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
      OPTIONS: async () => {
        const { corsPreflight } = await import("@/lib/xtream.server");
        return corsPreflight();
      },
    },
  },
});
