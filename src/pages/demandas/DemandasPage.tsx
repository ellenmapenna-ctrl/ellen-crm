import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, ChevronDown, ClipboardList, Plus, User } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/Feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DemandaFormDialog } from "@/components/demandas/DemandaFormDialog";
import { useCreateDemanda, useDemandas, useUpdateDemanda } from "@/hooks/useDemandas";
import {
  PRIORIDADE_OPCOES,
  RESPONSAVEIS,
  STATUS_ABERTOS,
  STATUS_OPCOES,
  compararDemandas,
  estaAtrasada,
  formatarPrazo,
  statusInfo,
  venceHoje,
  type DemandaStatus,
} from "@/lib/demandas";
import { cn } from "@/lib/utils";
import type { DemandaWithCliente } from "@/lib/types";

type FiltroPessoa = "todas" | "Ellen" | "Renan";
const FILTROS_PESSOA: { key: FiltroPessoa; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "Ellen", label: "Ellen" },
  { key: "Renan", label: "Renan" },
];

const MAX_CONCLUIDAS = 30;

export function DemandasPage() {
  const { data, isLoading, error, refetch } = useDemandas();
  const createMut = useCreateDemanda();
  const updateMut = useUpdateDemanda();

  const [titulo, setTitulo] = useState("");
  const [responsavel, setResponsavel] = useState<string>("Renan");
  const [prazo, setPrazo] = useState("");
  const [prioridade, setPrioridade] = useState<string>("normal");
  const [filtro, setFiltro] = useState<FiltroPessoa>("todas");
  const [concluidasAbertas, setConcluidasAbertas] = useState(false);
  const [editando, setEditando] = useState<DemandaWithCliente | null>(null);

  const demandas = useMemo(
    () => (data ?? []).filter((d) => filtro === "todas" || d.responsavel === filtro),
    [data, filtro],
  );

  const porStatus = useMemo(() => {
    const grupos: Record<DemandaStatus, DemandaWithCliente[]> = { a_fazer: [], em_andamento: [], aguardando: [], concluida: [] };
    for (const d of demandas) (grupos[d.status as DemandaStatus] ?? grupos.a_fazer).push(d);
    for (const k of STATUS_ABERTOS) grupos[k].sort(compararDemandas);
    grupos.concluida.sort((a, b) => (b.concluida_em ?? "").localeCompare(a.concluida_em ?? ""));
    return grupos;
  }, [demandas]);

  const abertas = STATUS_ABERTOS.reduce((n, k) => n + porStatus[k].length, 0);
  const atrasadas = demandas.filter(estaAtrasada).length;
  const hoje = demandas.filter(venceHoje).length;

  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = titulo.trim();
    if (!t) return;
    try {
      await createMut.mutateAsync({ titulo: t, responsavel, prioridade, prazo: prazo || null });
      setTitulo("");
      setPrazo("");
      setPrioridade("normal");
    } catch (err) {
      toast.error("Não foi possível criar a demanda.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const mudarStatus = async (d: DemandaWithCliente, status: DemandaStatus) => {
    if (d.status === status) return;
    try {
      await updateMut.mutateAsync({
        id: d.id,
        status,
        concluida_em: status === "concluida" ? new Date().toISOString() : null,
      });
      if (status === "concluida") toast.success("Demanda concluída.");
    } catch (err) {
      toast.error("Erro ao atualizar a demanda.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const concluidasVisiveis = porStatus.concluida.slice(0, MAX_CONCLUIDAS);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Demandas" description="O que está pendente, com quem está e em que pé está.">
        <Badge variant="secondary">{abertas} em aberto</Badge>
        {atrasadas > 0 && (
          <Badge className="bg-destructive text-destructive-foreground">
            {atrasadas} atrasada{atrasadas > 1 ? "s" : ""}
          </Badge>
        )}
        {hoje > 0 && <Badge className="bg-amber-500 text-white">{hoje} para hoje</Badge>}
      </PageHeader>

      <Card className="mb-4 p-3">
        <form onSubmit={adicionar} className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Nova demanda… (digite e aperte Enter)"
            aria-label="Título da nova demanda"
            className="flex-1"
            autoFocus
          />
          <Select value={responsavel} onValueChange={setResponsavel}>
            <SelectTrigger className="sm:w-32" aria-label="Responsável"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RESPONSAVEIS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={prioridade} onValueChange={setPrioridade}>
            <SelectTrigger className="sm:w-48" aria-label="Prioridade"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORIDADE_OPCOES.map((o) => (
                <SelectItem key={o.key} value={o.key}>Prioridade {o.label.toLowerCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} aria-label="Prazo" className="sm:w-40" />
          <Button type="submit" disabled={!titulo.trim() || createMut.isPending}>
            <Plus className="size-4" />
            Adicionar
          </Button>
        </form>
      </Card>

      <div className="mb-4 flex gap-1.5">
        {FILTROS_PESSOA.map((f) => (
          <Button key={f.key} size="sm" variant={filtro === f.key ? "default" : "outline"} onClick={() => setFiltro(f.key)}>
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState
          message="Não foi possível carregar as demandas. Se for a primeira vez, a tabela 'demandas' ainda precisa ser criada no Supabase."
          onRetry={() => refetch()}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {abertas === 0 && (
            <EmptyState icon={ClipboardList} title="Nenhuma demanda em aberto" description="Digite acima para adicionar a primeira." />
          )}

          {STATUS_ABERTOS.map((k) => {
            const lista = porStatus[k];
            if (lista.length === 0) return null;
            const info = statusInfo(k);
            return (
              <section key={k}>
                <h3 className={cn("mb-2 flex items-center gap-1.5 text-sm font-semibold", info.colorClass)}>
                  <info.icon className="size-4" />
                  {info.label}
                  <span className="text-muted-foreground">({lista.length})</span>
                </h3>
                <Card className="divide-y overflow-hidden">
                  {lista.map((d) => (
                    <LinhaDemanda key={d.id} demanda={d} onStatus={mudarStatus} onEditar={() => setEditando(d)} />
                  ))}
                </Card>
              </section>
            );
          })}

          {porStatus.concluida.length > 0 && (
            <Collapsible open={concluidasAbertas} onOpenChange={setConcluidasAbertas}>
              <CollapsibleTrigger className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                <ChevronDown className={cn("size-4 transition-transform", !concluidasAbertas && "-rotate-90")} />
                Concluídas
                <span className="text-muted-foreground">({porStatus.concluida.length})</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Card className="divide-y overflow-hidden">
                  {concluidasVisiveis.map((d) => (
                    <LinhaDemanda key={d.id} demanda={d} onStatus={mudarStatus} onEditar={() => setEditando(d)} />
                  ))}
                </Card>
                {porStatus.concluida.length > MAX_CONCLUIDAS && (
                  <p className="mt-2 text-xs text-muted-foreground">Mostrando as {MAX_CONCLUIDAS} mais recentes.</p>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}

      <DemandaFormDialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)} demanda={editando} />
    </div>
  );
}

function LinhaDemanda({
  demanda: d,
  onStatus,
  onEditar,
}: {
  demanda: DemandaWithCliente;
  onStatus: (d: DemandaWithCliente, status: DemandaStatus) => void;
  onEditar: () => void;
}) {
  const concluida = d.status === "concluida";
  const atrasada = estaAtrasada(d);
  const hoje = venceHoje(d);
  const info = statusInfo(d.status);

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40">
      <Checkbox
        checked={concluida}
        onCheckedChange={(v) => onStatus(d, v ? "concluida" : "a_fazer")}
        aria-label={concluida ? "Reabrir demanda" : "Concluir demanda"}
        className="size-5 rounded-full"
      />
      <button type="button" onClick={onEditar} className="min-w-0 flex-1 text-left">
        <span className={cn("block truncate text-sm font-medium", concluida && "text-muted-foreground line-through")}>{d.titulo}</span>
        {d.descricao && <span className="block truncate text-xs text-muted-foreground">{d.descricao}</span>}
      </button>

      {d.prioridade === "alta" && !concluida && (
        <Badge variant="outline" className="border-destructive/40 text-destructive">
          <AlertTriangle className="size-3" /> Alta
        </Badge>
      )}
      {d.cliente && (
        <Link to={`/clientes/${d.cliente.id}`} className="hidden max-w-36 truncate text-xs text-primary hover:underline md:block">
          {d.cliente.nome_completo}
        </Link>
      )}
      {d.prazo && (
        <span
          className={cn(
            "flex items-center gap-1 whitespace-nowrap text-xs",
            atrasada ? "font-semibold text-destructive" : hoje ? "font-semibold text-amber-600" : "text-muted-foreground",
          )}
        >
          <CalendarClock className="size-3.5" />
          {hoje ? "Hoje" : formatarPrazo(d.prazo)}
        </span>
      )}
      <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
        <User className="size-3.5" />
        {d.responsavel}
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className={cn("h-7 gap-1 px-2 text-xs", info.colorClass)} aria-label="Mudar status">
            <info.icon className="size-3.5" />
            <span className="hidden sm:inline">{info.label}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {STATUS_OPCOES.map((o) => (
            <DropdownMenuItem key={o.key} onSelect={() => onStatus(d, o.key)} className={o.colorClass}>
              <o.icon className="size-4" />
              {o.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
