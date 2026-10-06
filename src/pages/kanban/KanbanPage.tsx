import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Cake, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState, LoadingState } from "@/components/shared/Feedback";
import { TagBadge } from "@/components/shared/TagBadge";
import { KanbanCardShell } from "@/components/kanban/KanbanCard";
import { SortableColumn, DroppableColumn } from "@/components/kanban/KanbanColumn";
import { BulkActionsBar } from "@/components/kanban/BulkActionsBar";
import { ColumnFormDialog } from "@/components/kanban/ColumnFormDialog";
import { AdicionarClienteColunaDialog } from "@/components/kanban/AdicionarClienteColunaDialog";
import { WhatsappBulkDialog } from "@/components/kanban/WhatsappBulkDialog";
import { FunilSelector } from "@/components/kanban/FunilSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useClientes } from "@/hooks/useClientes";
import { useKanbanEstagios, useReorderEstagios } from "@/hooks/useKanbanEstagios";
import { useFunilPosicoes, useMoverNoFunil } from "@/hooks/useFunilPosicoes";
import { useBulkTagClientes, useEnsureTag, useTags } from "@/hooks/useTags";
import { ehAniversarioMesAtual } from "@/lib/aniversario";
import { ehFunilKey, FUNIL_PADRAO, type FunilKey } from "@/lib/funis";
import type { ClienteWithRelations, KanbanEstagio } from "@/lib/types";

export function KanbanPage() {
  const navigate = useNavigate();
  const { data: clientes, isLoading, isError, refetch } = useClientes();
  const { data: todosEstagios } = useKanbanEstagios();
  const { data: posicoes } = useFunilPosicoes();
  const { data: tags } = useTags();
  const mover = useMoverNoFunil();
  const reorder = useReorderEstagios();
  const ensureTag = useEnsureTag();
  const bulkTag = useBulkTagClientes();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [colDialog, setColDialog] = useState(false);
  const [colEdit, setColEdit] = useState<KanbanEstagio | null>(null);
  const [adicionarDialog, setAdicionarDialog] = useState(false);
  const [adicionarEstagio, setAdicionarEstagio] = useState<KanbanEstagio | null>(null);
  const [whatsDialog, setWhatsDialog] = useState(false);
  const [busca, setBusca] = useState("");
  const [tagsFiltro, setTagsFiltro] = useState<Set<string>>(new Set());
  const [somenteAniversariantes, setSomenteAniversariantes] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const paramFunil = searchParams.get("funil");
  const funil: FunilKey = ehFunilKey(paramFunil) ? paramFunil : FUNIL_PADRAO;
  const trocarFunil = (f: FunilKey) => {
    setSearchParams({ funil: f }, { replace: true });
    setSelected(new Set());
  };

  const estagios = useMemo(
    () => (todosEstagios ?? []).filter((e) => e.funil === funil),
    [todosEstagios, funil]
  );

  const contagemPorFunil = useMemo(() => {
    const m = new Map<FunilKey, number>();
    for (const p of posicoes ?? []) {
      if (ehFunilKey(p.funil)) m.set(p.funil, (m.get(p.funil) ?? 0) + 1);
    }
    return m;
  }, [posicoes]);

  const moverCliente = (clienteId: string, estagioId: string | null) =>
    mover.mutate({ clienteIds: [clienteId], funil, estagioId });

  const toggleTagFiltro = (id: string) =>
    setTagsFiltro((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (clientes ?? []).filter((c) => {
      if (termo) {
        const blob = `${c.nome_completo} ${c.celular ?? ""} ${c.cidade ?? ""} ${c.email ?? ""}`.toLowerCase();
        if (!blob.includes(termo)) return false;
      }
      if (tagsFiltro.size > 0) {
        const cTags = (c.cliente_tags ?? []).map((ct) => ct.tag_id);
        if (![...tagsFiltro].some((t) => cTags.includes(t))) return false;
      }
      if (somenteAniversariantes && !ehAniversarioMesAtual(c.data_nascimento)) return false;
      return true;
    });
  }, [clientes, busca, tagsFiltro, somenteAniversariantes]);

  const porEstagio = useMemo(() => {
    const idsColunas = new Set(estagios.map((e) => e.id));
    const estagioDoCliente = new Map<string, string>();
    for (const p of posicoes ?? []) {
      if (p.funil === funil && idsColunas.has(p.estagio_id)) estagioDoCliente.set(p.cliente_id, p.estagio_id);
    }
    const map = new Map<string, ClienteWithRelations[]>();
    const semEstagio: ClienteWithRelations[] = [];
    for (const c of clientesFiltrados) {
      const estagioId = estagioDoCliente.get(c.id);
      if (estagioId) {
        const arr = map.get(estagioId) ?? [];
        arr.push(c);
        map.set(estagioId, arr);
      } else {
        semEstagio.push(c);
      }
    }
    return { map, semEstagio };
  }, [clientesFiltrados, posicoes, estagios, funil]);

  const selecionadosClientes = useMemo(
    () => (clientes ?? []).filter((c) => selected.has(c.id)),
    [clientes, selected]
  );

  const activeCliente = useMemo(
    () => (clientes ?? []).find((c) => c.id === activeId) ?? null,
    [clientes, activeId]
  );

  const onDragStart = (e: DragStartEvent) => {
    if (e.active.data.current?.type === "card") setActiveId(String(e.active.id));
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const type = active.data.current?.type;

    if (type === "column") {
      if (over.data.current?.type !== "column" || active.id === over.id) return;
      const list = estagios;
      const oldIndex = list.findIndex((x) => x.id === active.id);
      const newIndex =
        over.id === "sem-estagio"
          ? list.length
          : list.findIndex((x) => x.id === over.id);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const reordered = arrayMove(list, oldIndex, newIndex);
      reorder.mutate(reordered.map((estagio, i) => ({ id: estagio.id, ordem: i })));
      return;
    }

    if (type === "card") {
      let target: string | null;
      if (over.data.current?.type === "card") {
        target = (over.data.current.estagioId as string | null) ?? null;
      } else if (over.id === "sem-estagio") {
        target = null;
      } else {
        target = String(over.id);
      }
      const atual = (active.data.current?.estagioId as string | null) ?? null;
      if (target === atual) return;
      moverCliente(String(active.id), target);
    }
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const clearSelection = () => setSelected(new Set());

  const abrirNovaColuna = () => {
    setColEdit(null);
    setColDialog(true);
  };
  const abrirEdicaoColuna = (estagio: KanbanEstagio) => {
    setColEdit(estagio);
    setColDialog(true);
  };

  const abrirAdicionarCliente = (estagio: KanbanEstagio) => {
    setAdicionarEstagio(estagio);
    setAdicionarDialog(true);
  };

  const marcarContatado = async () => {
    if (selected.size === 0) return;
    try {
      const tag = await ensureTag.mutateAsync({ nome: "Contatado", cor: "#22c55e" });
      await bulkTag.mutateAsync({ clienteIds: [...selected], tagId: tag.id });
      toast.success(`${selected.size} cliente(s) marcado(s) como contatado(s).`);
      clearSelection();
    } catch (err) {
      toast.error("Erro ao aplicar tag.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  if (isLoading) return <LoadingState className="py-20" />;
  if (isError) return <ErrorState onRetry={() => refetch()} message="Não foi possível carregar o Funil." />;

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Funil" description="Recomendações e clientes da carteira, tudo num só lugar.">
        <Button onClick={abrirNovaColuna}>
          <Plus className="size-4" />
          Nova coluna
        </Button>
      </PageHeader>

      <FunilSelector funil={funil} onChange={trocarFunil} contagem={contagemPorFunil} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, celular, cidade ou e-mail"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSomenteAniversariantes((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-smooth",
              somenteAniversariantes
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-muted"
            )}
          >
            <Cake className="size-3.5" />
            Aniversariantes
          </button>
          {(tags ?? []).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleTagFiltro(t.id)}
              className={cn(
                "rounded-full transition-smooth",
                tagsFiltro.has(t.id) ? "ring-2 ring-offset-1 ring-primary" : "opacity-80 hover:opacity-100"
              )}
            >
              <TagBadge tag={t} />
            </button>
          ))}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div
          className="scrollbar-thin flex h-[calc(100vh-16rem)] gap-4 overflow-x-auto rounded-2xl p-4"
          style={{ background: "linear-gradient(135deg, rgba(76,95,214,0.16), rgba(139,95,201,0.10))" }}
        >
          <SortableContext
            items={estagios.map((e) => e.id)}
            strategy={horizontalListSortingStrategy}
          >
            {estagios.map((e) => (
              <SortableColumn
                key={e.id}
                estagio={e}
                clientes={porEstagio.map.get(e.id) ?? []}
                selected={selected}
                onToggle={toggle}
                onNavigate={(id) => navigate(`/clientes/${id}`)}
                onEdit={() => abrirEdicaoColuna(e)}
                onAdicionar={() => abrirAdicionarCliente(e)}
                onRemoverCliente={(id) => moverCliente(id, null)}
              />
            ))}
          </SortableContext>
          <DroppableColumn
            clientes={porEstagio.semEstagio}
            selected={selected}
            onToggle={toggle}
            onNavigate={(id) => navigate(`/clientes/${id}`)}
          />
          <button
            type="button"
            onClick={abrirNovaColuna}
            className="flex h-full w-72 shrink-0 items-center justify-center gap-2 rounded-xl border border-dashed bg-background/40 text-sm text-muted-foreground transition-smooth hover:bg-accent"
          >
            <Plus className="size-4" />
            Nova coluna
          </button>
        </div>

        <DragOverlay dropAnimation={{ duration: 150 }}>
          {activeCliente ? (
            <KanbanCardShell
              cliente={activeCliente}
              selected={selected.has(activeCliente.id)}
              overlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <BulkActionsBar
        count={selected.size}
        busy={ensureTag.isPending || bulkTag.isPending}
        onClear={clearSelection}
        onMarcarContatado={marcarContatado}
        onAbrirWhatsapp={() => setWhatsDialog(true)}
      />

      <WhatsappBulkDialog
        open={whatsDialog}
        onOpenChange={setWhatsDialog}
        clientes={selecionadosClientes.map((c) => ({
          id: c.id,
          nome_completo: c.nome_completo,
          celular: c.celular,
        }))}
      />
      <ColumnFormDialog open={colDialog} onOpenChange={setColDialog} estagio={colEdit} funil={funil} />
      <AdicionarClienteColunaDialog open={adicionarDialog} onOpenChange={setAdicionarDialog} estagio={adicionarEstagio} />
    </div>
  );
}
