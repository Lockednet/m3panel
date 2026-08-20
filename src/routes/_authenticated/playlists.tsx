import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  fetchM3uText,
  createPlaylist,
  resetPlaylistContent,
  ingestBatch,
  finalizeImport,
} from "@/lib/panel.functions";
import { parseM3U, chunk } from "@/lib/m3u";
import { supabase } from "@/integrations/supabase/client";
import { PanelShell } from "@/components/panel/PanelShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/playlists")({
  head: () => ({
    meta: [
      { title: "Listas M3U — Painel IPTV" },
      { name: "description", content: "Importe listas M3U por URL ou arquivo e acompanhe a análise do conteúdo." },
      { property: "og:title", content: "Listas M3U — Painel IPTV" },
      { property: "og:description", content: "Importação e análise de listas M3U." },
    ],
  }),
  component: PlaylistsPage,
});

type PlaylistRow = {
  id: string;
  name: string;
  status: string;
  source_type: string;
  source_url: string | null;
  total_items: number;
  last_import_at: string | null;
};

function PlaylistsPage() {
  const qc = useQueryClient();
  const fetchText = useServerFn(fetchM3uText);
  const create = useServerFn(createPlaylist);
  const reset = useServerFn(resetPlaylistContent);
  const ingest = useServerFn(ingestBatch);
  const finalize = useServerFn(finalizeImport);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);

  const { data: playlists } = useQuery({
    queryKey: ["playlists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select("id, name, status, source_type, source_url, total_items, last_import_at")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as PlaylistRow[];
    },
  });

  async function runImport(text: string, sourceType: "url" | "file", sourceUrl: string | null) {
    const items = parseM3U(text);
    if (!items.length) throw new Error("Nenhum item encontrado na lista");
    const { playlistId, jobId } = await create({
      data: { name: name.trim() || "Lista importada", sourceType, sourceUrl },
    });
    const batches = chunk(items, 800);
    let done = 0;
    try {
      for (const batch of batches) {
        await ingest({
          data: { playlistId, jobId, processed: done, total: items.length, items: batch },
        });
        done += batch.length;
        setProgress({ done, total: items.length, label: "Importando itens" });
      }
      await finalize({ data: { playlistId, jobId, total: items.length } });
      toast.success(`${items.length} itens importados`);
    } catch (e) {
      await finalize({
        data: { playlistId, jobId, total: done, error: (e as Error).message.slice(0, 400) },
      });
      throw e;
    }
  }

  async function importFromUrl(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProgress({ done: 0, total: 1, label: "Baixando lista" });
    try {
      const { text } = await fetchText({ data: { url } });
      await runImport(text, "url", url);
      qc.invalidateQueries();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function importFromFile(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setProgress({ done: 0, total: 1, label: "Lendo arquivo" });
    try {
      const text = await file.text();
      await runImport(text, "file", null);
      qc.invalidateQueries();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function removePlaylist(id: string) {
    if (!confirm("Apagar esta lista e todo o conteúdo dela?")) return;
    await reset({ data: { playlistId: id } });
    await supabase.from("playlists").delete().eq("id", id);
    qc.invalidateQueries();
    toast.success("Lista removida");
  }

  return (
    <PanelShell title="Listas M3U" description="Importe e gerencie as listas que alimentam o painel">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nova importação</CardTitle>
            <CardDescription>A leitura é feita no navegador, suportando listas grandes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pname">Nome da lista</Label>
              <Input
                id="pname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Servidor principal"
              />
            </div>
            <Tabs defaultValue="url">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url">URL M3U</TabsTrigger>
                <TabsTrigger value="file">Arquivo</TabsTrigger>
              </TabsList>
              <TabsContent value="url">
                <form onSubmit={importFromUrl} className="space-y-3 pt-3">
                  <Input
                    type="url"
                    required
                    placeholder="http://servidor.com/get.php?username=...&type=m3u_plus"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                  <Button type="submit" className="w-full" disabled={busy}>
                    Importar da URL
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="file">
                <form onSubmit={importFromFile} className="space-y-3 pt-3">
                  <Input
                    type="file"
                    accept=".m3u,.m3u8,text/plain"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <Button type="submit" className="w-full" disabled={busy || !file}>
                    Importar arquivo
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {progress ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {progress.label} — {progress.done}/{progress.total}
                </p>
                <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} />
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
                    <p className="text-xs text-muted-foreground">
                      {p.total_items} itens ·{" "}
                      {p.last_import_at
                        ? new Date(p.last_import_at).toLocaleString("pt-BR")
                        : "sem importação"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={p.status === "ready" ? "default" : "secondary"}>{p.status}</Badge>
                    {p.source_type === "url" && p.source_url ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Reimportar"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const { text } = await fetchText({ data: { url: p.source_url! } });
                            await reset({ data: { playlistId: p.id } });
                            setName(p.name);
                            await runImport(text, "url", p.source_url);
                            qc.invalidateQueries();
                          } catch (err) {
                            toast.error((err as Error).message);
                          } finally {
                            setBusy(false);
                            setProgress(null);
                          }
                        }}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Apagar"
                      onClick={() => removePlaylist(p.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
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
