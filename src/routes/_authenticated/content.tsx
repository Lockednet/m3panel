import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  listContent,
  updateContentItem,
  deleteContentItem,
  deleteCategory,
} from "@/lib/panel.functions";
import { supabase } from "@/integrations/supabase/client";
import { PanelShell } from "@/components/panel/PanelShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/content")({
  head: () => ({
    meta: [
      { title: "Conteúdo — Painel IPTV" },
      { name: "description", content: "Navegue por canais, filmes e séries por categoria, edite capas e URLs." },
      { property: "og:title", content: "Conteúdo — Painel IPTV" },
      { property: "og:description", content: "Gerencie canais, filmes e séries importados." },
    ],
  }),
  component: ContentPage,
});

type Kind = "live" | "movie" | "series";
type Row = {
  id: number;
  name: string;
  logo: string | null;
  hidden: boolean;
  url?: string;
  category_id: string | null;
};

function ContentPage() {
  const qc = useQueryClient();
  const list = useServerFn(listContent);
  const update = useServerFn(updateContentItem);
  const remove = useServerFn(deleteContentItem);
  const removeCategory = useServerFn(deleteCategory);

  const [playlistId, setPlaylistId] = useState<string>("");
  const [kind, setKind] = useState<Kind>("live");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Row | null>(null);

  const { data: playlists } = useQuery({
    queryKey: ["playlists-min"],
    queryFn: async () => {
      const { data } = await supabase.from("playlists").select("id, name").order("created_at");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  useEffect(() => {
    if (!playlistId && playlists?.length) setPlaylistId(playlists[0]!.id);
  }, [playlists, playlistId]);

  const { data: categories } = useQuery({
    queryKey: ["categories", playlistId, kind],
    enabled: !!playlistId,
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name, items_count")
        .eq("playlist_id", playlistId)
        .eq("kind", kind)
        .order("name");
      return (data ?? []) as { id: string; name: string; items_count: number }[];
    },
  });

  const { data: content } = useQuery({
    queryKey: ["content", playlistId, kind, categoryId, search, page],
    enabled: !!playlistId,
    queryFn: () => list({ data: { playlistId, kind, categoryId, search, page } }),
  });

  const rows = (content?.rows ?? []) as unknown as Row[];
  const pages = Math.ceil((content?.count ?? 0) / (content?.size ?? 40));

  return (
    <PanelShell
      title="Conteúdo"
      description="Categorias e itens organizados exatamente como vêm da lista"
      actions={
        <Select value={playlistId} onValueChange={(v) => { setPlaylistId(v); setCategoryId(null); setPage(0); }}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Selecione a lista" />
          </SelectTrigger>
          <SelectContent>
            {(playlists ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <Tabs
        value={kind}
        onValueChange={(v) => {
          setKind(v as Kind);
          setCategoryId(null);
          setPage(0);
        }}
      >
        <TabsList className="mb-4">
          <TabsTrigger value="live">Canais</TabsTrigger>
          <TabsTrigger value="movie">Filmes</TabsTrigger>
          <TabsTrigger value="series">Séries</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,260px)_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Categorias</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[70vh] space-y-1 overflow-y-auto">
            <button
              className={`w-full rounded-md px-3 py-1.5 text-left text-sm ${!categoryId ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-secondary/50"}`}
              onClick={() => { setCategoryId(null); setPage(0); }}
            >
              Todas
            </button>
            {(categories ?? []).map((c) => (
              <div key={c.id} className="group flex items-center gap-1">
                <button
                  className={`flex-1 truncate rounded-md px-3 py-1.5 text-left text-sm ${categoryId === c.id ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-secondary/50"}`}
                  onClick={() => { setCategoryId(c.id); setPage(0); }}
                >
                  {c.name} <span className="text-xs opacity-60">({c.items_count})</span>
                </button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100"
                  onClick={async () => {
                    if (!confirm(`Apagar a categoria "${c.name}" e seus itens?`)) return;
                    await removeCategory({ data: { id: c.id } });
                    qc.invalidateQueries();
                    toast.success("Categoria apagada");
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">{content?.count ?? 0} itens</CardTitle>
            <Input
              className="max-w-xs"
              placeholder="Buscar…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((r) => (
                <div key={r.id} className="flex gap-3 rounded-md border border-border p-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-secondary">
                    {r.logo ? (
                      <img
                        src={r.logo}
                        alt={`Capa de ${r.name}`}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                    {r.url ? (
                      <p className="truncate text-xs text-muted-foreground">{r.url}</p>
                    ) : null}
                    <div className="mt-2 flex items-center gap-1">
                      {r.hidden ? <Badge variant="secondary">Oculto</Badge> : null}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(r)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={async () => {
                          await update({ data: { kind, id: r.id, hidden: !r.hidden } });
                          qc.invalidateQueries({ queryKey: ["content"] });
                        }}
                      >
                        {r.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={async () => {
                          if (!confirm("Apagar este item?")) return;
                          await remove({ data: { kind, id: r.id } });
                          qc.invalidateQueries({ queryKey: ["content"] });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {pages > 1 ? (
              <div className="mt-4 flex items-center justify-center gap-3">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  Anterior
                </Button>
                <span className="text-xs text-muted-foreground">
                  {page + 1} / {pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page + 1 >= pages}
                  onClick={() => setPage(page + 1)}
                >
                  Próxima
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar item</DialogTitle>
          </DialogHeader>
          {editing ? (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                await update({
                  data: {
                    kind,
                    id: editing.id,
                    name: String(form.get("name")),
                    logo: (String(form.get("logo")) || null) as string | null,
                    ...(kind === "series" ? {} : { url: String(form.get("url")) }),
                  },
                });
                setEditing(null);
                qc.invalidateQueries({ queryKey: ["content"] });
                toast.success("Item atualizado");
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="ename">Nome</Label>
                <Input id="ename" name="name" defaultValue={editing.name} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="elogo">Capa (URL)</Label>
                <Input id="elogo" name="logo" defaultValue={editing.logo ?? ""} />
              </div>
              {kind === "series" ? null : (
                <div className="space-y-1.5">
                  <Label htmlFor="eurl">URL do stream</Label>
                  <Input id="eurl" name="url" defaultValue={editing.url ?? ""} />
                </div>
              )}
              <DialogFooter>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </PanelShell>
  );
}
