import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listResellers, setResellerCredits, getMyAccount } from "@/lib/panel.functions";
import { PanelShell } from "@/components/panel/PanelShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/resellers")({
  head: () => ({
    meta: [
      { title: "Revendedores — Painel IPTV" },
      { name: "description", content: "Gerencie revendedores e créditos para criação de conexões." },
      { property: "og:title", content: "Revendedores — Painel IPTV" },
      { property: "og:description", content: "Controle de revendedores e créditos." },
    ],
  }),
  component: ResellersPage,
});

function ResellersPage() {
  const qc = useQueryClient();
  const account = useServerFn(getMyAccount);
  const list = useServerFn(listResellers);
  const setCredits = useServerFn(setResellerCredits);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => account({ data: undefined }) });
  const { data, error } = useQuery({
    queryKey: ["resellers"],
    enabled: !!me?.isAdmin,
    queryFn: () => list({ data: undefined }),
  });

  if (me && !me.isAdmin) {
    return (
      <PanelShell title="Revendedores" description="Área exclusiva do administrador">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Você está logado como revendedor. Seus créditos:{" "}
              <span className="text-foreground">{me.profile?.credits ?? 0}</span>
            </p>
          </CardContent>
        </Card>
      </PanelShell>
    );
  }

  return (
    <PanelShell title="Revendedores" description="Contas do painel e seus créditos">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{data?.rows.length ?? 0} contas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : null}
          {(data?.rows ?? []).map((r) => (
            <div
              key={r.id as string}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {(r.display_name as string) || (r.email as string)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.email as string} · {r.lines} conexões
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={r.role === "admin" ? "default" : "secondary"}>{r.role}</Badge>
                <form
                  className="flex items-center gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    await setCredits({
                      data: { userId: r.id as string, credits: Number(form.get("credits")) },
                    });
                    qc.invalidateQueries({ queryKey: ["resellers"] });
                    toast.success("Créditos atualizados");
                  }}
                >
                  <Input
                    name="credits"
                    type="number"
                    min={0}
                    defaultValue={r.credits as number}
                    className="w-24"
                  />
                  <Button type="submit" size="sm" variant="outline">
                    Salvar
                  </Button>
                </form>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </PanelShell>
  );
}
