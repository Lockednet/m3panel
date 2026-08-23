import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/xmltv.php")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authenticate } = await import("@/lib/xtream.server");
        const url = new URL(request.url);
        const auth = await authenticate(
          url.searchParams.get("username") ?? "",
          url.searchParams.get("password") ?? "",
        );
        if (!auth.ok) return new Response("Acesso negado", { status: 401 });
        const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<tv generator-info-name="Painel IPTV"></tv>';
        return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
      },
    },
  },
});
