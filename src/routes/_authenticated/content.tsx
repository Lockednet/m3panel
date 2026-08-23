import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteCategory,
  deleteContentItem,
  listContent,
  updateContentItem,
} from "@/lib/panel.functions";
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
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";

type Kind = "live" | "movie" | "series";

export const Route = createFileRoute("/_authenticated/content")({
  head: () => ({
    meta: [
      { title: "Conteúdo — Painel IPTV" },
      {
        name: "description",
        content: "Navegue por canais, filmes e séries por categoria, edite capas, URLs e visibilidade.",
      },
      { property: "og:title", content: "Conteúdo — Painel IPTV" },
      { property: "og:description", content: "Gerencie canais, filmes e séries da sua lista." },
    ],
  }),
  component: ContentPage,
});

interface Row {
  id: number;
  name: string;
  logo: string | null;
  hidden: boolean;
  url?: string;
  category_id: string | null;
}

function ContentPage() {
  const qc = useQueryClient();
  const list = useServerFn(listContent);
  const update = useServerFn(updateContentItem);
  const remove = useServerFn(deleteContentItem);
  const removeCat = useServerFn(deleteCategory);

  const [playlistId, setPlaylistId] = useState<string>("");
  const [kind, setKind] = useState<Kind>("live");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Row | null>(null);

  const { data: playlists } = useQuery({
    queryKey: ["playlists-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select("id, name")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!playlistId && playlists?.length) setPlaylistId(playlists[0]!.id);
  }, [playlists, playlistId]);

  const { data: categories } = useQuery({
    queryKey: ["categories", playlistId, kind],
    enabled: !!playlistId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, items_count")
        .eq("playlist_id", playlistId)
        .eq("kind", kind)
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["content", playlistId, kind, categoryId, search, page],
    enabled: !!playlistId,
    queryFn: () =>
      list({ data: { playlistId, kind, categoryId, search: search || undefined, page } }),
  });

  const rows = (data?.rows ?? []) as unknown as Row[];
  const pages = data ? Math.ceil(data.count / data.size) : 0;

  return (
    <PanelShell
      title="Conteúdo"
      description="Categorias e itens organizados conforme a lista importada"
      actions={
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={playlistId}
          onChange={(e) => {
            setPlaylistId(e.target.value);
            setCategoryId(null);
            setPage(0);
          }}
        >
          {(playlists ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Categorias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <button
              onClick={() => {
                setCategoryId(null);
                setPage(0);
              }}
              className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                categoryId === null ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              }`}
            >
              Todas
            </button>
            {(categories ?? []).map((c) => (
              <div key={c.id} className="group flex items-center gap-1">
                <button
                  onClick={() => {
                    setCategoryId(c.id);
                    setPage(0);
                  }}
                  className={`flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm ${
                    categoryId === c.id ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                  }`}
                >
                  {c.name}{" "}
                  <span className="text-xs text-muted-foreground">({c.items_count})</span>
                </button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100"
                  onClick={async () => {
                    await removeCat({ data: { id: c.id } });
                    qc.invalidateQueries();
                    toast.success("Categoria removida");
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs
              value={kind}
              onValueChange={(v) => {
                setKind(v as Kind);
                setCategoryId(null);
                setPage(0);
              }}
            >
              <TabsList>
                <TabsTrigger value="live">Canais</TabsTrigger>
                <TabsTrigger value="movie">Filmes</TabsTrigger>
                <TabsTrigger value="series">Séries</TabsTrigger>
              </TabsList>
            </Tabs>
            <Input
              className="max-w-xs"
              placeholder="Buscar por nome…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
            <Badge variant="secondary">{data?.count ?? 0} itens</Badge>
          </div>

          <Card>
            <CardContent className="space-y-2 pt-6">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum item encontrado.</p>
              ) : (
                rows.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
                  >
                    {r.logo ? (
                      <img
                        src={r.logo}
                        alt={`Capa de ${r.name}`}
                        loading="lazy"
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                      {r.url ? (
                        <p className="truncate text-xs text-muted-foreground">{r.url}</p>
                      ) : null}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        await update({ data: { kind, id: r.id, hidden: !r.hidden } });
                        qc.invalidateQueries({ queryKey: ["content"] });
                      }}
                    >
                      {r.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        await remove({ data: { kind, id: r.id } });
                        qc.invalidateQueries();
                        toast.success("Item removido");
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {pages > 1 ? (
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                Página {page + 1} de {pages}
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
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar item</DialogTitle>
          </DialogHeader>
          {editing ? (
            <form
              id="edit-item"
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await update({
                  data: {
                    kind,
                    id: editing.id,
                    name: String(f.get("name")),
                    logo: (String(f.get("logo")) || null) as string | null,
                    ...(kind === "series" ? {} : { url: String(f.get("url")) }),
                  },
                });
                setEditing(null);
                qc.invalidateQueries({ queryKey: ["content"] });
                toast.success("Item atualizado");
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="i-name">Nome</Label>
                <Input id="i-name" name="name" defaultValue={editing.name} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-logo">Capa (URL)</Label>
                <Input id="i-logo" name="logo" defaultValue={editing.logo ?? ""} />
              </div>
              {kind !== "series" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="i-url">URL do stream</Label>
                  <Input id="i-url" name="url" defaultValue={editing.url ?? ""} />
                </div>
              ) : null}
            </form>
          ) : null}
          <DialogFooter>
            <Button type="submit" form="edit-item">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PanelShell>
  );
}
