import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/get.php")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleGetPhp } = await import("@/lib/xtream.server");
        return handleGetPhp(request);
      },
      OPTIONS: async () => {
        const { corsPreflight } = await import("@/lib/xtream.server");
        return corsPreflight();
      },
    },
  },
});
