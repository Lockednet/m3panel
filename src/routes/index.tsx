import { createFileRoute, Link } from "@tanstack/react-router";
import { MonitorPlay, ListVideo, Users, Radio, ShieldCheck, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel IPTV — Gerencie listas M3U e conexões" },
      {
        name: "description",
        content:
          "Importe uma lista M3U, veja canais, filmes e séries organizados por categoria e crie conexões com DNS própria.",
      },
      { property: "og:title", content: "Painel IPTV — Gerencie listas M3U e conexões" },
      {
        property: "og:description",
        content: "Painel completo de IPTV: importação M3U, catálogo, testes e usuários.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: ListVideo, title: "Importação M3U", text: "Por URL ou arquivo, com análise automática de canais, filmes e séries." },
  { icon: Gauge, title: "Dashboard completo", text: "Quantidades de conteúdo, usuários ativos, testes expirados e onlines." },
  { icon: Users, title: "Conexões e testes", text: "Crie usuários, defina validade, limite de telas e pacotes de categorias." },
  { icon: Radio, title: "DNS própria", text: "Seus clientes conectam pela sua URL, não pela origem da lista." },
  { icon: ShieldCheck, title: "Revendedores", text: "Contas com créditos e permissões separadas do administrador." },
  { icon: MonitorPlay, title: "Compatível com players", text: "API no padrão Xtream para os aplicativos mais usados." },
];

function Landing() {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <MonitorPlay className="h-6 w-6 text-primary" />
          <span className="font-display text-base font-bold text-foreground">Painel IPTV</span>
        </div>
        <Button asChild size="sm">
          <Link to="/auth">Entrar no painel</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-3xl px-5 py-16 text-center">
        <h1 className="font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl">
          Sua lista M3U virando um painel de gerenciamento completo
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground">
          Importe a lista, veja tudo organizado por categorias e distribua acesso aos seus clientes
          através de conexões com usuário e senha na sua própria DNS.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Começar agora</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/dashboard">Ir para o dashboard</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <article key={f.title} className="rounded-xl border border-border bg-card p-5">
              <f.icon className="h-5 w-5 text-primary" />
              <h2 className="mt-3 font-display text-base font-semibold text-card-foreground">
                {f.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
