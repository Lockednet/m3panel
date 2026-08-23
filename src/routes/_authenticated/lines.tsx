import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { listLines, saveLine, lineAction } from "@/lib/panel.functions";
import { supabase } from "@/integrations/supabase/client";
import { PanelShell } from "@/components/panel/PanelShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ban, Copy, Plus, RotateCw, Trash2, Wifi, Power } from "lucide-react";

export const Route = createFileRoute("/_authenticated/lines")({
  head: () => ({
    meta: [
      { title: "Conexões — Painel IPTV" },
      { name: "description", content: "Crie usuários e testes, veja online, expirados e renove conexões." },
      { property: "og:title", content: "Conexões — Painel IPTV" },
      { property: "og:description", content: "Gerencie usuários e testes do painel IPTV." },
    ],
  }),
  component: LinesPage,
});

type Filter = "all" | "active" | "expired" | "trial" | "banned" | "online";

function randomStr(n: number) {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: n }, () => abc[Math.floor(Math.random() * abc.length)]).join("");
}

function LinesPage() {
  const qc = useQueryClient();
  const list = useServerFn(listLines);
  const save = useServerFn(saveLine);
  const action = useServerFn(lineAction);

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [playlistId, setPlaylistId] = useState("");
  const [username, setUsername] = useState(randomStr(8));
  const [password, setPassword] = useState(randomStr(8));
  const [maxConnections, setMaxConnections] = useState(1);
  const [isTrial, setIsTrial] = useState(false);
  const [days, setDays] = useState(30);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

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

  const { data } = useQuery({
    queryKey: ["lines", filter, search],
    queryFn: () => list({ data: { filter, search } }),
    refetchInterval: 30_000,
  });

  async function createLine(e: React.FormEvent) {
    e.preventDefault();
    if (!playlistId) {
      toast.error("Importe uma lista antes de criar conexões");
      return;
    }
    const expires = new Date();
    if (isTrial) expires.setHours(expires.getHours() + Math.max(days, 1));
    else expires.setDate(expires.getDate() + days);
    try {
      await save({
        data: {
          playlistId,
          username,
          password,
          maxConnections,
          isTrial,
          expiresAt: expires.toISOString(),
          notes: null,
        },
      });
      toast.success(isTrial ? "Teste criado" : "Usuário criado");
      setOpen(false);
      setUsername(randomStr(8));
      setPassword(randomStr(8));
      qc.invalidateQueries();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function copyDns(u: string, p: string) {
    navigator.clipboard.writeText(`${origin}\nUsuário: ${u}\nSenha: ${p}`);
    toast.success("Dados de acesso copiados");
  }

  const rows = data?.rows ?? [];

  return (
    <PanelShell
      title="Conexões"
      description="Usuários e testes que se conectam pelo DNS do painel"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1 h-4 w-4" /> Nova conexão
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar usuário / teste</DialogTitle>
            </DialogHeader>
            <form onSubmit={createLine} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Lista</Label>
                <Select value={playlistId} onValueChange={setPlaylistId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {(playlists ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lu">Usuário</Label>
                  <Input id="lu" value={username} onChange={(e) => setUsername(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lp">Senha</Label>
                  <Input id="lp" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lc">Conexões simultâneas</Label>
                  <Input
                    id="lc"
                    type="number"
                    min={1}
                    max={20}
                    value={maxConnections}
                    onChange={(e) => setMaxConnections(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ld">{isTrial ? "Duração (horas)" : "Duração (dias)"}</Label>
                  <Input
                    id="ld"
                    type="number"
                    min={1}
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <Label htmlFor="lt">É um teste</Label>
                <Switch
                  id="lt"
                  checked={isTrial}
                  onCheckedChange={(v) => {
                    setIsTrial(v);
                    setDays(v ? 4 : 30);
                  }}
                />
              </div>
              <DialogFooter>
                <Button type="submit">Criar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-2 pt-6">
          {(["all", "online", "active", "trial", "expired", "banned"] as Filter[]).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
            >
              {{ all: "Todos", online: "Online", active: "Ativos", trial: "Testes", expired: "Expirados", banned: "Banidos" }[f]}
            </Button>
          ))}
          <Input
            className="ml-auto max-w-xs"
            placeholder="Buscar usuário…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{rows.length} conexões</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conexão encontrada.</p>
          ) : (
            rows.map((l) => {
              const expired = l.expires_at ? new Date(l.expires_at as string) < new Date() : false;
              return (
                <div
                  key={l.id as string}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {l.username as string}
                      {l.online > 0 ? (
                        <span className="flex items-center gap-1 text-xs text-primary">
                          <Wifi className="h-3 w-3" /> {l.online}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      senha: {l.password as string} · máx {l.max_connections as number} ·{" "}
                      {l.expires_at
                        ? `expira ${new Date(l.expires_at as string).toLocaleString("pt-BR")}`
                        : "sem expiração"}
                      {l.ip ? ` · ${l.ip as string}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {l.banned ? <Badge variant="destructive">Banido</Badge> : null}
                    {expired ? <Badge variant="secondary">Expirado</Badge> : null}
                    {l.is_trial ? <Badge variant="outline">Teste</Badge> : null}
                    <Button size="icon" variant="ghost" title="Copiar acesso"
                      onClick={() => copyDns(l.username as string, l.password as string)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Renovar 30 dias"
                      onClick={async () => {
                        await action({ data: { id: l.id as string, action: "renew", days: 30 } });
                        qc.invalidateQueries();
                        toast.success("Renovado por 30 dias");
                      }}
                    >
                      <RotateCw className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Derrubar conexões"
                      onClick={async () => {
                        await action({ data: { id: l.id as string, action: "kick" } });
                        qc.invalidateQueries();
                      }}
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title={l.banned ? "Desbanir" : "Banir"}
                      onClick={async () => {
                        await action({
                          data: { id: l.id as string, action: l.banned ? "unban" : "ban" },
                        });
                        qc.invalidateQueries();
                      }}
                    >
                      <Ban className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Apagar"
                      onClick={async () => {
                        if (!confirm("Apagar esta conexão?")) return;
                        await action({ data: { id: l.id as string, action: "delete" } });
                        qc.invalidateQueries();
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
          <p className="pt-2 text-xs text-muted-foreground">
            DNS do painel para os aplicativos: <span className="text-foreground">{origin}</span>
          </p>
        </CardContent>
      </Card>
    </PanelShell>
  );
}
