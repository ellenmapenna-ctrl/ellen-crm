import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { addDays, format, isToday, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  ListChecks,
  MapPin,
  Phone,
  PhoneCall,
  Plus,
  Search,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState, LoadingState } from "@/components/shared/Feedback";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClientes } from "@/hooks/useClientes";
import {
  useAddClientesAoSitPlan,
  useAtualizarStatusLigacao,
  useReordenarSitPlan,
  useRemoverDoSitPlan,
  useSitPlanItens,
} from "@/hooks/useSitPlan";
import {
  contaComoAgendamento,
  contaComoAtendida,
  contaComoLigacaoFeita,
  hojeIso,
  STATUS_LIGACAO_OPCOES,
  statusLigacaoInfo,
} from "@/lib/sitplan";
import { urlGoogleAgenda } from "@/lib/google-agenda";
import type { SitplanItemWithCliente } from "@/lib/types";

function formatarDataLonga(iso: string): string {
  const d = parseISO(iso);
  const texto = format(d, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function SitPlanPage() {
  const [data, setData] = useState(hojeIso());
  const [busca, setBusca] = useState("");
  const [adicionarOpen, setAdicionarOpen] = useState(false);

  const { data: itens, isLoading } = useSitPlanItens(data);
  const removerMut = useRemoverDoSitPlan();
  const statusMut = useAtualizarStatusLigacao();
  const reordenarMut = useReordenarSitPlan();

  const itensFiltrados = useMemo(() => {
    if (!itens) return [];
    const termo = busca.trim().toLowerCase();
    if (!termo) return itens;
    return itens.filter((it) => {
      const c = it.cliente;
      const blob = `${c.nome_completo} ${c.celular ?? ""} ${c.cidade ?? ""} ${c.email ?? ""}`.toLowerCase();
      return blob.includes(termo);
    });
  }, [itens, busca]);

  const reordenavel = busca.trim() === "";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id || !itens) return;
    const oldIndex = itens.findIndex((it) => it.id === active.id);
    const newIndex = itens.findIndex((it) => it.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordenado = arrayMove(itens, oldIndex, newIndex);
    reordenarMut.mutate({ data, itens: reordenado.map((it, i) => ({ id: it.id, ordem: i })) });
  };

  const stats = useMemo(() => {
    const lista = itens ?? [];
    const feitas = lista.filter((it) => contaComoLigacaoFeita(it.status_ligacao)).length;
    const atendidas = lista.filter((it) => contaComoAtendida(it.status_ligacao)).length;
    const agendamentos = lista.filter((it) => contaComoAgendamento(it.status_ligacao)).length;
    return {
      naLista: lista.length,
      feitas,
      atendidas,
      agendamentos,
      conversaoDasFeitas: feitas > 0 ? Math.round((agendamentos / feitas) * 100) : 0,
      conversaoDasAtendidas: atendidas > 0 ? Math.round((agendamentos / atendidas) * 100) : 0,
    };
  }, [itens]);

  const handleRemover = async (id: string) => {
    try {
      await removerMut.mutateAsync({ id, data });
      toast.success("Removido do SitPlan.");
    } catch (err) {
      toast.error("Erro ao remover.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleStatus = async (id: string, status: string) => {
    try {
      await statusMut.mutateAsync({ id, data, statusLigacao: status === "__limpar__" ? null : status });
    } catch (err) {
      toast.error("Erro ao salvar status.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="SitPlan & TA" description="Arraste pelo ícone para definir a ordem de prioridade de contato. Navegue entre datas para revisitar quem não foi alcançado.">
        <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setData((d) => format(subDays(parseISO(d), 1), "yyyy-MM-dd"))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="px-2 text-sm font-medium">{formatarDataLonga(data)}</span>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setData((d) => format(addDays(parseISO(d), 1), "yyyy-MM-dd"))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {!isToday(parseISO(data)) && (
          <Button variant="outline" size="sm" onClick={() => setData(hojeIso())}>
            Hoje
          </Button>
        )}
        <Button onClick={() => setAdicionarOpen(true)}>
          <Plus className="size-4" />
          Adicionar clientes
        </Button>
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground"><ListChecks className="size-3.5" />Na lista</p>
          <p className="text-lg font-bold tabular-nums">{stats.naLista}</p>
        </Card>
        <Card className="p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Phone className="size-3.5" />Ligações feitas</p>
          <p className="text-lg font-bold tabular-nums">{stats.feitas}</p>
          <p className="text-[10px] text-muted-foreground">{stats.naLista > 0 ? Math.round((stats.feitas / stats.naLista) * 100) : 0}% da lista</p>
        </Card>
        <Card className="p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground"><PhoneCall className="size-3.5" />Atendidas</p>
          <p className="text-lg font-bold tabular-nums">{stats.atendidas}</p>
        </Card>
        <Card className="p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground"><ListChecks className="size-3.5" />Agendamentos</p>
          <p className="text-lg font-bold tabular-nums">{stats.agendamentos}</p>
        </Card>
        <Card className="col-span-2 p-3 sm:col-span-1">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground"><TrendingUp className="size-3.5" />Conversão</p>
          <p className="text-lg font-bold tabular-nums">{stats.conversaoDasFeitas}%</p>
          <p className="text-[10px] text-muted-foreground">{stats.conversaoDasAtendidas}% das atendidas</p>
        </Card>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, celular, cidade ou e-mail" className="pl-8" />
      </div>

      {isLoading && <LoadingState className="py-16" />}

      {!isLoading && itensFiltrados.length === 0 && (
        <EmptyState
          icon={ListChecks}
          title={itens && itens.length > 0 ? "Nenhum resultado para essa busca" : "Nenhum cliente no SitPlan deste dia"}
          description={itens && itens.length > 0 ? "Ajuste a busca." : "Adicione clientes pra começar a lista de hoje."}
          action={!(itens && itens.length > 0) ? <Button onClick={() => setAdicionarOpen(true)}><Plus className="size-4" />Adicionar clientes</Button> : undefined}
        />
      )}

      {itensFiltrados.length > 0 && (
        <Card className="overflow-hidden p-0">
          {!reordenavel && (
            <p className="border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">Limpe a busca para reordenar a prioridade de contato.</p>
          )}
          <div className="overflow-x-auto">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead className="w-10">Ordem</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status da ligação</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <SortableContext items={itensFiltrados.map((it) => it.id)} strategy={verticalListSortingStrategy}>
                  <TableBody>
                    {itensFiltrados.map((it, i) => (
                      <SitPlanRow
                        key={it.id}
                        item={it}
                        posicao={i + 1}
                        arrastavel={reordenavel}
                        onStatus={handleStatus}
                        onRemover={handleRemover}
                      />
                    ))}
                  </TableBody>
                </SortableContext>
              </Table>
            </DndContext>
          </div>
        </Card>
      )}

      <AdicionarAoSitPlanDialog open={adicionarOpen} onOpenChange={setAdicionarOpen} data={data} jaNaLista={new Set((itens ?? []).map((it) => it.cliente.id))} />
    </div>
  );
}

function SitPlanRow({
  item,
  posicao,
  arrastavel,
  onStatus,
  onRemover,
}: {
  item: SitplanItemWithCliente;
  posicao: number;
  arrastavel: boolean;
  onStatus: (id: string, status: string) => void;
  onRemover: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !arrastavel });
  const info = statusLigacaoInfo(item.status_ligacao);

  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-10 bg-accent opacity-80" : undefined}
    >
      <TableCell className="w-8 px-2">
        {arrastavel && (
          <button
            type="button"
            className="flex size-6 cursor-grab items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
            aria-label={`Arrastar para reordenar ${item.cliente.nome_completo}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        )}
      </TableCell>
      <TableCell className="w-10 tabular-nums text-muted-foreground">{posicao}</TableCell>
      <TableCell>
        <Link to={`/clientes/${item.cliente.id}`} className="font-medium hover:underline">
          {item.cliente.nome_completo}
        </Link>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {item.cliente.celular && (
            <span className="flex items-center gap-1"><Phone className="size-3" />{item.cliente.celular}</span>
          )}
          {(item.cliente.cidade || item.cliente.uf) && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" />
              {[item.cliente.cidade, item.cliente.uf].filter(Boolean).join(" - ")}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Select value={item.status_ligacao ?? "__limpar__"} onValueChange={(v) => onStatus(item.id, v)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Status da ligação">
              {info ? (
                <span className={`flex items-center gap-1.5 ${info.colorClass}`}>
                  <info.icon className="size-3.5" />
                  {info.label}
                </span>
              ) : (
                "Status da ligação"
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__limpar__">
              <span className="text-muted-foreground">- Limpar -</span>
            </SelectItem>
            {STATUS_LIGACAO_OPCOES.map((o) => (
              <SelectItem key={o.key} value={o.key}>
                <span className={`flex items-center gap-1.5 ${o.colorClass}`}>
                  <o.icon className="size-3.5" />
                  {o.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8" asChild aria-label="Agendar no Google Agenda">
            <a href={urlGoogleAgenda(item.cliente)} target="_blank" rel="noopener noreferrer">
              <CalendarPlus className="size-3.5 text-muted-foreground" />
            </a>
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => onRemover(item.id)} aria-label="Remover deste SitPlan">
            <Trash2 className="size-3.5 text-muted-foreground" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function AdicionarAoSitPlanDialog({
  open,
  onOpenChange,
  data,
  jaNaLista,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: string;
  jaNaLista: Set<string>;
}) {
  const { data: clientes } = useClientes();
  const addMut = useAddClientesAoSitPlan();
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const disponiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (clientes ?? [])
      .filter((c) => !jaNaLista.has(c.id))
      .filter((c) => !termo || c.nome_completo.toLowerCase().includes(termo) || (c.cpf ?? "").includes(termo));
  }, [clientes, busca, jaNaLista]);

  const toggle = (id: string) =>
    setSelecionados((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleAdicionar = async () => {
    try {
      await addMut.mutateAsync({ clienteIds: [...selecionados], data });
      toast.success(`${selecionados.size} cliente${selecionados.size === 1 ? "" : "s"} adicionado${selecionados.size === 1 ? "" : "s"} ao SitPlan.`);
      setSelecionados(new Set());
      setBusca("");
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao adicionar.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar clientes ao SitPlan</DialogTitle>
          <DialogDescription>{formatarDataLonga(data)}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou CPF" className="pl-8" />
        </div>
        <div className="max-h-80 overflow-y-auto rounded-lg border">
          {disponiveis.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {jaNaLista.size > 0 && !busca ? "Todos os clientes já estão nesta lista." : "Nenhum cliente encontrado."}
            </p>
          )}
          {disponiveis.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-accent">
              <Checkbox checked={selecionados.has(c.id)} onCheckedChange={() => toggle(c.id)} />
              <span className="flex-1 truncate">{c.nome_completo}</span>
              {c.cidade && <span className="shrink-0 text-xs text-muted-foreground">{c.cidade}{c.uf ? ` - ${c.uf}` : ""}</span>}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleAdicionar} disabled={selecionados.size === 0 || addMut.isPending}>
            {addMut.isPending ? "Adicionando..." : `Adicionar (${selecionados.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
