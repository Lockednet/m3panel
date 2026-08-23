import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/player_api/php" as never)({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const { handlePlayerApi } = await import("@/lib/xtream.server");
        return handlePlayerApi(request);
      },
      POST: async ({ request }: { request: Request }) => {
        const { handlePlayerApi } = await import("@/lib/xtream.server");
        return handlePlayerApi(request);
      },
    },
  },
});
