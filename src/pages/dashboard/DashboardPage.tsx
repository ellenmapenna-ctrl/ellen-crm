import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Cake,
  CalendarDays,
  KanbanSquare,
  ListChecks,
  Plus,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/Feedback";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useClientes } from "@/hooks/useClientes";
import { useKanbanEstagios } from "@/hooks/useKanbanEstagios";
import { useFunilPosicoes } from "@/hooks/useFunilPosicoes";
import { FUNIS } from "@/lib/funis";
import { useAniversariantes } from "@/hooks/useAniversariantes";
import { useSitPlanCount } from "@/hooks/useSitPlan";
import { useCompromissosPeriodo } from "@/hooks/useCompromissos";
import { hojeIso } from "@/lib/sitplan";
import { formatarMoeda, formatarMoedaCompacta } from "@/lib/format";

export function DashboardPage() {
  const { data: clientes, isLoading: carregandoClientes } = useClientes();
  const { data: estagios } = useKanbanEstagios();
  const { data: posicoes } = useFunilPosicoes();
  const { data: aniversariantesData } = useAniversariantes(30);
  const { data: sitplanHojeCount } = useSitPlanCount(hojeIso());
  const { data: compromissosHoje } = useCompromissosPeriodo(hojeIso(), hojeIso());

  const kpis = useMemo(() => {
    const lista = clientes ?? [];
    let clientesAtivos = 0;
    let premioMensal = 0;
    let capitalTotal = 0;
    for (const c of lista) {
      const ativas = (c.apolices ?? []).filter((a) => a.status === "ativa");
      if (ativas.length > 0) clientesAtivos++;
      for (const a of ativas) {
        premioMensal += Number(a.premio_mensal_total ?? 0);
        capitalTotal += Number(a.capital_segurado_total ?? 0);
      }
    }
    return { totalClientes: lista.length, clientesAtivos, premioMensal, capitalTotal };
  }, [clientes]);

  const porEstagio = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const p of posicoes ?? []) contagem.set(p.estagio_id, (contagem.get(p.estagio_id) ?? 0) + 1);
    return contagem;
  }, [posicoes]);

  const aniversariantesHoje = (aniversariantesData?.aniversariantes ?? []).filter((a) => a.ehHoje);

  if (carregandoClientes) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title="Início" description="Visão geral da carteira e da rotina de hoje." />
        <LoadingState className="py-16" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Início" description="Visão geral da carteira e da rotina de hoje." />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card className="p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Users className="size-3.5" />Clientes</p>
          <p className="text-lg font-bold tabular-nums">{kpis.totalClientes}</p>
          <p className="text-[10px] text-muted-foreground">{kpis.clientesAtivos} com apólice ativa</p>
        </Card>
        <Card className="p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground"><ShieldCheck className="size-3.5" />Prêmio mensal</p>
          <p className="text-lg font-bold tabular-nums">{formatarMoeda(kpis.premioMensal)}</p>
        </Card>
        <Card className="p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground"><ShieldCheck className="size-3.5" />Capital segurado</p>
          <p className="text-lg font-bold tabular-nums">{formatarMoedaCompacta(kpis.capitalTotal)}</p>
        </Card>
        <Card className="p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Cake className="size-3.5" />Aniversariantes hoje</p>
          <p className="text-lg font-bold tabular-nums">{aniversariantesHoje.length}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-base font-semibold"><KanbanSquare className="size-4" />Funil</h2>
            <Link to="/kanban" className="text-xs font-medium text-primary hover:underline">Ver funil →</Link>
          </div>
          {!estagios || estagios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum estágio cadastrado.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {FUNIS.map((f) => {
                const colunas = estagios.filter((e) => e.funil === f.key);
                if (colunas.length === 0) return null;
                return (
                  <div key={f.key} className="flex flex-col gap-1.5">
                    <Link
                      to={`/kanban?funil=${f.key}`}
                      className="text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-primary"
                    >
                      {f.nomeCompleto}
                    </Link>
                    {colunas.map((e) => (
                      <div key={e.id} className="flex items-center gap-2 text-sm">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: e.cor }} />
                        <span className="flex-1 truncate">{e.nome}</span>
                        <span className="tabular-nums text-muted-foreground">{porEstagio.get(e.id) ?? 0}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-base font-semibold">Hoje</h2>
          <div className="flex flex-col gap-3">
            <Link to="/sitplan" className="flex items-center justify-between rounded-lg border p-2.5 text-sm transition-smooth hover:bg-accent">
              <span className="flex items-center gap-1.5"><ListChecks className="size-4 text-muted-foreground" />SitPlan & TA</span>
              <Badge variant="secondary">{sitplanHojeCount ?? 0} na lista</Badge>
            </Link>
            <Link to="/agenda" className="flex items-center justify-between rounded-lg border p-2.5 text-sm transition-smooth hover:bg-accent">
              <span className="flex items-center gap-1.5"><CalendarDays className="size-4 text-muted-foreground" />Compromissos</span>
              <Badge variant="secondary">{compromissosHoje?.length ?? 0} hoje</Badge>
            </Link>
            <Link to="/aniversariantes" className="rounded-lg border p-2.5 text-sm transition-smooth hover:bg-accent">
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Cake className="size-4 text-muted-foreground" />Aniversariantes</span>
                <Badge variant="secondary">{aniversariantesHoje.length} hoje</Badge>
              </div>
              {aniversariantesHoje.length > 0 && (
                <p className="truncate text-xs text-muted-foreground">
                  {aniversariantesHoje.map((a) => a.cliente.nome_completo.split(" ")[0]).join(", ")}
                </p>
              )}
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/clientes?novo=1"><Plus className="size-4" />Novo cliente</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/importar"><Upload className="size-4" />Importar clientes</Link>
        </Button>
      </div>
    </div>
  );
}
