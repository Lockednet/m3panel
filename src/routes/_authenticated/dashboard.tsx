import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboard } from "@/lib/panel.functions";
import { PanelShell } from "@/components/panel/PanelShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tv,
  Film,
  Clapperboard,
  Layers,
  Users,
  Radio,
  TimerReset,
  Ban,
  CheckCircle2,
  ListVideo,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Painel IPTV" },
      {
        name: "description",
        content: "Métricas em tempo real de canais, filmes, séries, testes e conexões online.",
      },
      { property: "og:title", content: "Dashboard — Painel IPTV" },
      { property: "og:description", content: "Métricas de conteúdo e conexões do seu painel IPTV." },
    ],
  }),
  component: DashboardPage,
});

function Stat({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-6">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
            accent ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-display text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  const fetchDashboard = useServerFn(getDashboard);
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard({ data: undefined }),
    refetchInterval: 20000,
  });

  return (
    <PanelShell title="Dashboard" description="Visão geral do conteúdo e das conexões">
      {error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : null}
      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Carregando métricas…</p>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Conteúdo</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Stat label="Canais ao vivo" value={data.content.live} icon={Tv} accent />
              <Stat label="Filmes" value={data.content.movies} icon={Film} accent />
              <Stat label="Séries" value={data.content.series} icon={Clapperboard} accent />
              <Stat label="Episódios" value={data.content.episodes} icon={ListVideo} />
              <Stat label="Categorias" value={data.content.categories} icon={Layers} />
              <Stat label="Listas" value={data.content.playlists} icon={ListVideo} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Conexões</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Stat label="Online agora" value={data.online} icon={Radio} accent />
              <Stat label="Usuários" value={data.users.total} icon={Users} />
              <Stat label="Ativos" value={data.users.active} icon={CheckCircle2} />
              <Stat label="Testes ativos" value={data.users.trials} icon={TimerReset} />
              <Stat label="Testes expirados" value={data.users.trialsExpired} icon={TimerReset} />
              <Stat label="Banidos" value={data.users.banned} icon={Ban} />
            </div>
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Importações recentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.recentImports.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma lista importada ainda.</p>
              ) : (
                data.recentImports.map((p) => (
                  <div
                    key={p.id as string}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{p.name as string}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.total_items as number} itens ·{" "}
                        {p.last_import_at
                          ? new Date(p.last_import_at as string).toLocaleString("pt-BR")
                          : "—"}
                      </p>
                    </div>
                    <Badge variant={p.status === "ready" ? "default" : "secondary"}>
                      {p.status as string}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PanelShell>
  );
}
