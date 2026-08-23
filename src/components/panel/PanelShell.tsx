import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  ListVideo,
  Clapperboard,
  Users,
  Wallet,
  MonitorPlay,
  LogOut,
} from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/playlists", label: "Listas M3U", icon: ListVideo },
  { to: "/content", label: "Conteúdo", icon: Clapperboard },
  { to: "/lines", label: "Conexões", icon: Users },
  { to: "/resellers", label: "Revendedores", icon: Wallet },
] as const;

export function PanelShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <Link to="/dashboard" className="mb-6 flex items-center gap-2 px-2">
          <MonitorPlay className="h-5 w-5 text-primary" />
          <span className="font-display text-base font-bold text-sidebar-foreground">Painel IPTV</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((n) => {
            const active = pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <Button variant="ghost" className="justify-start gap-3 text-muted-foreground" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h1 className="font-display text-xl font-semibold text-foreground">{title}</h1>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
        <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs text-muted-foreground"
            >
              {n.label}
            </Link>
          ))}
        </div>
        <main className="flex-1 p-5">{children}</main>
      </div>
    </div>
  );
}
