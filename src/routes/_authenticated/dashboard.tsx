import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboard } from "@/lib/panel.functions";
import { PanelShell } from "@/components/panel/PanelShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tv,
  Film,
  Clapperboard,
  Users,
  Wifi,
  Clock,
  Ban,
  FolderTree,
  ListVideo,
  FlaskConical,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Painel IPTV" },
      { name: "description", content: "Visão geral de conteúdos, usuários online e testes do painel." },
      { property: "og:title", content: "Dashboard — Painel IPTV" },
      { property: "og:description", content: "Visão geral de conteúdos e conexões." },
    ],
  }),
  component: DashboardPage,
});

function Stat({
  icon: Icon,
  label,
  value,
  tone = "primary",
}: {
  icon: typeof Tv;
  label: string;
  value: number | string;
  tone?: "primary" | "accent" | "destructive" | "muted";
}) {
  const toneClass = {
    primary: "text-primary",
    accent: "text-accent",
    destructive: "text-destructive",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className={`h-4 w-4 ${toneClass}`} />
      </CardHeader>
      <CardContent>
        <p className="font-display text-2xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  const fn = useServerFn(getDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fn({ data: undefined }),
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return (
      <PanelShell title="Dashboard" description="Carregando métricas…">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </PanelShell>
    );
  }

  const c = data.content;
  const u = data.users;

  return (
    <PanelShell title="Dashboard" description="Resumo do conteúdo importado e das conexões">
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Conteúdo</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={Tv} label="Canais ao vivo" value={c.live} />
          <Stat icon={Film} label="Filmes" value={c.movies} tone="accent" />
          <Stat icon={Clapperboard} label="Séries" value={c.series} />
          <Stat icon={FolderTree} label="Categorias" value={c.categories} tone="muted" />
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Conexões</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={Wifi} label="Online agora" value={data.online} />
          <Stat icon={Users} label="Usuários ativos" value={u.active} />
          <Stat icon={FlaskConical} label="Testes ativos" value={u.trials} tone="accent" />
          <Stat icon={Clock} label="Expirados" value={u.expired} tone="destructive" />
          <Stat icon={FlaskConical} label="Testes expirados" value={u.trialsExpired} tone="destructive" />
          <Stat icon={Ban} label="Banidos" value={u.banned} tone="destructive" />
          <Stat icon={Users} label="Total de usuários" value={u.total} tone="muted" />
          <Stat icon={ListVideo} label="Listas importadas" value={c.playlists} tone="muted" />
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importações recentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.recentImports.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma lista importada ainda. Vá em “Listas M3U” para importar a primeira.
            </p>
          ) : (
            data.recentImports.map((p) => (
              <div
                key={p.id as string}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{p.name as string}</p>
                  <p className="text-xs text-muted-foreground">{p.total_items as number} itens</p>
                </div>
                <Badge variant={p.status === "ready" ? "default" : "secondary"}>
                  {p.status as string}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </PanelShell>
  );
}
