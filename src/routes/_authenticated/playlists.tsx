import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  createPlaylist,
  fetchM3uText,
  finalizeImport,
  ingestBatch,
  resetPlaylistContent,
} from "@/lib/panel.functions";
import { chunk, parseM3U } from "@/lib/m3u";
import { PanelShell } from "@/components/panel/PanelShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/playlists")({
  head: () => ({
    meta: [
      { title: "Listas M3U — Painel IPTV" },
      {
        name: "description",
        content: "Importe listas M3U por URL ou arquivo e acompanhe a análise do conteúdo.",
      },
      { property: "og:title", content: "Listas M3U — Painel IPTV" },
      { property: "og:description", content: "Importação e análise de listas M3U no painel." },
    ],
  }),
  component: PlaylistsPage,
});

function PlaylistsPage() {
  const qc = useQueryClient();
  const create = useServerFn(createPlaylist);
  const fetchText = useServerFn(fetchM3uText);
  const ingest = useServerFn(ingestBatch);
  const finalize = useServerFn(finalizeImport);
  const reset = useServerFn(resetPlaylistContent);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  const { data: playlists } = useQuery({
    queryKey: ["playlists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select("id, name, status, total_items, source_type, source_url, last_import_at")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  async function runImport(sourceType: "url" | "file") {
    if (!name.trim()) return toast.error("Informe um nome para a lista");
    setBusy(true);
    setProgress(0);
    let created: { playlistId: string; jobId: string } | null = null;
    try {
      setStatus("Obtendo lista…");
      const text =
        sourceType === "url"
          ? (await fetchText({ data: { url } })).text
          : await (file as File).text();

      setStatus("Analisando conteúdo…");
      const items = parseM3U(text);
      if (!items.length) throw new Error("Nenhum item encontrado na lista");

      created = await create({
        data: { name: name.trim(), sourceType, sourceUrl: sourceType === "url" ? url : null },
      });

      const batches = chunk(items, 800);
      let processed = 0;
      for (const b of batches) {
        await ingest({
          data: {
            playlistId: created.playlistId,
            jobId: created.jobId,
            processed,
            total: items.length,
            items: b,
          },
        });
        processed += b.length;
        setProgress(Math.round((processed / items.length) * 100));
        setStatus(`Importando ${processed}/${items.length}…`);
      }
      setStatus("Finalizando…");
      await finalize({
        data: { playlistId: created.playlistId, jobId: created.jobId, total: items.length },
      });
      toast.success(`Lista importada: ${items.length} itens`);
      setName("");
      setUrl("");
      setFile(null);
      qc.invalidateQueries();
    } catch (e) {
      if (created) {
        await finalize({
          data: {
            playlistId: created.playlistId,
            jobId: created.jobId,
            total: 0,
            error: (e as Error).message.slice(0, 500),
          },
        }).catch(() => {});
      }
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setStatus("");
      setProgress(0);
    }
  }

  return (
    <PanelShell title="Listas M3U" description="Importe e gerencie as listas do painel">
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nova importação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pname">Nome da lista</Label>
              <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
            </div>
            <Tabs defaultValue="url">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url">URL M3U</TabsTrigger>
                <TabsTrigger value="file">Arquivo</TabsTrigger>
              </TabsList>
              <TabsContent value="url" className="space-y-3 pt-3">
                <Input
                  placeholder="http://servidor/get.php?username=…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={busy}
                />
                <Button className="w-full" disabled={busy || !url} onClick={() => runImport("url")}>
                  Importar da URL
                </Button>
              </TabsContent>
              <TabsContent value="file" className="space-y-3 pt-3">
                <Input
                  type="file"
                  accept=".m3u,.m3u8,text/plain"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  disabled={busy}
                />
                <Button className="w-full" disabled={busy || !file} onClick={() => runImport("file")}>
                  Importar arquivo
                </Button>
              </TabsContent>
            </Tabs>
            {busy ? (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">{status}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Listas importadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(playlists ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma lista ainda.</p>
            ) : (
              (playlists ?? []).map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.total_items} itens · origem {p.source_type} ·{" "}
                      {p.last_import_at ? new Date(p.last_import_at).toLocaleString("pt-BR") : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={p.status === "ready" ? "default" : "secondary"}>{p.status}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await reset({ data: { playlistId: p.id } });
                        qc.invalidateQueries();
                        toast.success("Conteúdo da lista limpo");
                      }}
                    >
                      Limpar conteúdo
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PanelShell>
  );
}
