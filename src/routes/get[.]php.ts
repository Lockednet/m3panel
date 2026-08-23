import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/get.php")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleGetPhp } = await import("@/lib/xtream.server");
        return handleGetPhp(request);
      },
    },
  },
});
