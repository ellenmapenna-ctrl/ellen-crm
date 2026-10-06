import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Cake,
  CalendarClock,
  ChevronDown,
  Filter,
  LayoutGrid,
  ListChecks,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/Feedback";
import { TagBadge } from "@/components/shared/TagBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ClienteFormDialog } from "@/components/clientes/ClienteFormDialog";
import { ColumnFilterButton, type Faixa } from "@/components/clientes/ColumnFilterButton";
import { StarRating } from "@/components/shared/StarRating";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClientes, useDeleteCliente, useUpdateCliente } from "@/hooks/useClientes";
import { useMoverNoFunil } from "@/hooks/useFunilPosicoes";
import { FUNIS, type FunilKey } from "@/lib/funis";
import { useTags } from "@/hooks/useTags";
import { useKanbanEstagios } from "@/hooks/useKanbanEstagios";
import { useAddClientesAoSitPlan } from "@/hooks/useSitPlan";
import { hojeIso } from "@/lib/sitplan";
import { APOLICE_STATUS, type ApoliceWithCoberturas, type ClienteWithRelations } from "@/lib/types";
import { classificarTipoProduto, coberturaCorrespondeARotulo } from "@/lib/seguros-taxonomia";
import { formatarData, formatarMoeda, formatarMoedaCompacta } from "@/lib/format";
import { idadeAtualDetalhada } from "@/lib/aniversario";
import { ETAPA_OPCOES, etapaInfo } from "@/lib/etapas";
import { cn } from "@/lib/utils";

const STATUS_TODOS = "todas";

type ChipKey =
  | "temp_vencendo"
  | "temp_expirado"
  | "temp_decrescente"
  | "sem_cirurgia"
  | "sem_doencas_graves"
  | "sem_vida_saude"
  | "venc_anual_prox_mes";

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: "temp_vencendo", label: "Temp. vencendo (90d)" },
  { key: "temp_expirado", label: "Temp. Expirado" },
  { key: "temp_decrescente", label: "Com Temp. Decrescente" },
  { key: "sem_cirurgia", label: "Sem Cirurgia" },
  { key: "sem_doencas_graves", label: "Sem Doenças Graves" },
  { key: "sem_vida_saude", label: "Sem Vida e Saúde" },
  { key: "venc_anual_prox_mes", label: "Venc. Anual — Próximo Mês" },
];

/** Faixas de prêmio mensal para o filtro da coluna Prêmio ("quem paga mais/menos"). */
const PREMIO_FAIXAS: (Faixa & { teste: (n: number) => boolean })[] = [
  { key: "ate200", label: "Até R$ 200", teste: (n) => n <= 200 },
  { key: "200-500", label: "R$ 200 – 500", teste: (n) => n > 200 && n <= 500 },
  { key: "500-1000", label: "R$ 500 – 1.000", teste: (n) => n > 500 && n <= 1000 },
  { key: "1000-2000", label: "R$ 1.000 – 2.000", teste: (n) => n > 1000 && n <= 2000 },
  { key: "2000+", label: "Acima de R$ 2.000", teste: (n) => n > 2000 },
];

/** Faixas de idade para o filtro da coluna Idade. */
const IDADE_FAIXAS: (Faixa & { teste: (n: number) => boolean })[] = [
  { key: "ate30", label: "Até 30 anos", teste: (n) => n <= 30 },
  { key: "31-40", label: "31 – 40 anos", teste: (n) => n >= 31 && n <= 40 },
  { key: "41-50", label: "41 – 50 anos", teste: (n) => n >= 41 && n <= 50 },
  { key: "51-60", label: "51 – 60 anos", teste: (n) => n >= 51 && n <= 60 },
  { key: "60+", label: "Acima de 60 anos", teste: (n) => n > 60 },
  { key: "sem-data", label: "Sem data de nascimento", teste: () => false },
];

function idadeDoCliente(c: ClienteWithRelations): number | null {
  return idadeAtualDetalhada(c.data_nascimento)?.anos ?? null;
}

function clienteBateFaixaIdade(c: ClienteWithRelations, key: string): boolean {
  const idade = idadeDoCliente(c);
  if (key === "sem-data") return idade === null;
  if (idade === null) return false;
  return IDADE_FAIXAS.find((f) => f.key === key)?.teste(idade) ?? false;
}

function hojeSemHora(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDataIso(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

function diasEntre(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function temCoberturaAtiva(apolicesAtivas: ApoliceWithCoberturas[], rotulos: string[]): boolean {
  return apolicesAtivas.some((a) =>
    (a.coberturas ?? []).some(
      (c) => c.status === "ativa" && rotulos.some((r) => coberturaCorrespondeARotulo(c.nome_cobertura, r))
    )
  );
}

function clienteAtendeChip(cliente: ClienteWithRelations, chip: ChipKey, hoje: Date): boolean {
  const apolicesAtivas = (cliente.apolices ?? []).filter((a) => a.status === "ativa");
  if (apolicesAtivas.length === 0) return false;

  switch (chip) {
    case "temp_vencendo":
      return apolicesAtivas.some((a) => {
        const { temporario, decrescente } = classificarTipoProduto(a.tipo_produto);
        if (!temporario || decrescente) return false;
        const venc = parseDataIso(a.vencimento_apolice);
        if (!venc) return false;
        const dias = diasEntre(hoje, venc);
        return dias >= 0 && dias <= 90;
      });
    case "temp_expirado":
      return apolicesAtivas.some((a) => {
        const { temporario } = classificarTipoProduto(a.tipo_produto);
        if (!temporario) return false;
        const venc = parseDataIso(a.vencimento_apolice);
        return !!venc && venc < hoje;
      });
    case "temp_decrescente":
      return apolicesAtivas.some((a) => classificarTipoProduto(a.tipo_produto).decrescente);
    case "sem_cirurgia":
      return !temCoberturaAtiva(apolicesAtivas, ["Cirurgia", "Cirurgia Ampliada"]);
    case "sem_doencas_graves":
      return !temCoberturaAtiva(apolicesAtivas, ["Doenças Graves"]);
    case "sem_vida_saude":
      return !temCoberturaAtiva(apolicesAtivas, ["Vida e Saúde"]);
    case "venc_anual_prox_mes": {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 2, 0);
      return apolicesAtivas.some((a) => {
        const venc = parseDataIso(a.vencimento_apolice);
        return !!venc && venc >= inicio && venc <= fim;
      });
    }
    default:
      return false;
  }
}

type CampoOrdem = "premio" | "idade";

export function ClientesListPage() {
  const navigate = useNavigate();
  const { data: clientes, isLoading, isError, refetch } = useClientes();
  const { data: tags } = useTags();
  const { data: estagiosKanban } = useKanbanEstagios();
  const deleteMut = useDeleteCliente();
  const updateMut = useUpdateCliente();
  const bulkEstagio = useMoverNoFunil();
  const addSitPlan = useAddClientesAoSitPlan();

  const [busca, setBusca] = useState("");
  const [tagsFiltro, setTagsFiltro] = useState<Set<string>>(new Set());
  const [statusFiltro, setStatusFiltro] = useState<string>(STATUS_TODOS);
  const [oportunidades, setOportunidades] = useState<Set<ChipKey>>(new Set());
  const [premioFiltro, setPremioFiltro] = useState<Set<string>>(new Set());
  const [idadeFiltro, setIdadeFiltro] = useState<Set<string>>(new Set());
  const [ordem, setOrdem] = useState<{ campo: CampoOrdem; direcao: "asc" | "desc" } | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<ClienteWithRelations | null>(null);
  const [excluindo, setExcluindo] = useState<ClienteWithRelations | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      setEditando(null);
      setDialogOpen(true);
      setSearchParams((p) => { p.delete("novo"); return p; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agregar = useMemo(() => {
    const mapa = new Map<string, { count: number; premio: number; capital: number }>();
    for (const c of clientes ?? []) {
      const ativas = (c.apolices ?? []).filter((a) => a.status === "ativa");
      mapa.set(c.id, {
        count: ativas.length,
        premio: ativas.reduce((s, a) => s + Number(a.premio_mensal_total ?? 0), 0),
        capital: ativas.reduce((s, a) => s + Number(a.capital_segurado_total ?? 0), 0),
      });
    }
    return mapa;
  }, [clientes]);

  /** KPIs sobre a base completa da carteira — não são afetados pelos filtros de busca/tag/status/oportunidade da tabela abaixo. */
  const kpis = useMemo(() => {
    const lista = clientes ?? [];
    let clientesAtivos = 0;
    let clientesCancelados = 0;
    let apolicesAtivas = 0;
    let apolicesCanceladas = 0;
    let premioMensal = 0;
    let capitalTotal = 0;
    let ultimaAtividade = 0;

    for (const c of lista) {
      const apolices = c.apolices ?? [];
      ultimaAtividade = Math.max(ultimaAtividade, new Date(c.created_at).getTime());
      const temAtiva = apolices.some((a) => a.status === "ativa");
      if (temAtiva) clientesAtivos++;
      else if (apolices.length > 0) clientesCancelados++;

      for (const a of apolices) {
        ultimaAtividade = Math.max(ultimaAtividade, new Date(a.created_at).getTime());
        if (a.status === "ativa") {
          apolicesAtivas++;
          premioMensal += Number(a.premio_mensal_total ?? 0);
          capitalTotal += Number(a.capital_segurado_total ?? 0);
        } else {
          apolicesCanceladas++;
        }
      }
    }

    const clientesComApolice = clientesAtivos + clientesCancelados;
    const ticketMedio = clientesComApolice > 0 ? premioMensal / clientesComApolice : 0;
    const importadoHaDias = ultimaAtividade > 0 ? Math.max(0, Math.floor((Date.now() - ultimaAtividade) / 86_400_000)) : null;

    return {
      clientesAtivos,
      clientesCancelados,
      apolicesAtivas,
      apolicesCanceladas,
      premioMensal,
      capitalTotal,
      ticketMedio,
      totalClientes: lista.length,
      importadoHaDias,
    };
  }, [clientes]);

  /** Predicado comum de filtro — `pular` deixa de fora a coluna cuja própria contagem está sendo calculada, pra o popover mostrar quantos registros cada faixa teria se fosse selecionada (e não só dentro do que já está filtrado por ela mesma). */
  const passaFiltrosGerais = (
    c: ClienteWithRelations,
    hoje: Date,
    pular?: "premio" | "idade"
  ): boolean => {
    if (busca.trim()) {
      const termo = busca.trim().toLowerCase();
      const blob = `${c.nome_completo} ${c.cpf ?? ""} ${c.celular ?? ""} ${c.email ?? ""}`.toLowerCase();
      if (!blob.includes(termo)) return false;
    }
    if (tagsFiltro.size > 0) {
      const cTags = (c.cliente_tags ?? []).map((ct) => ct.tag_id);
      if (![...tagsFiltro].some((t) => cTags.includes(t))) return false;
    }
    if (statusFiltro !== STATUS_TODOS) {
      const statuses = (c.apolices ?? []).map((a) => a.status);
      if (!statuses.includes(statusFiltro)) return false;
    }
    if (oportunidades.size > 0) {
      const atende = [...oportunidades].some((chip) => clienteAtendeChip(c, chip, hoje));
      if (!atende) return false;
    }
    if (pular !== "premio" && premioFiltro.size > 0) {
      const premio = agregar.get(c.id)?.premio ?? 0;
      const bate = [...premioFiltro].some((k) => PREMIO_FAIXAS.find((f) => f.key === k)?.teste(premio));
      if (!bate) return false;
    }
    if (pular !== "idade" && idadeFiltro.size > 0) {
      const bate = [...idadeFiltro].some((k) => clienteBateFaixaIdade(c, k));
      if (!bate) return false;
    }
    return true;
  };

  const filtrados = useMemo(() => {
    if (!clientes) return [];
    const hoje = hojeSemHora();
    return clientes.filter((c) => passaFiltrosGerais(c, hoje));
  }, [clientes, busca, tagsFiltro, statusFiltro, oportunidades, premioFiltro, idadeFiltro, agregar]);

  /** Base para contar as faixas de Prêmio no popover, ignorando o próprio filtro de prêmio (senão marcar uma faixa zeraria a contagem das outras). */
  const baseParaContarPremio = useMemo(() => {
    if (!clientes) return [];
    const hoje = hojeSemHora();
    return clientes.filter((c) => passaFiltrosGerais(c, hoje, "premio"));
  }, [clientes, busca, tagsFiltro, statusFiltro, oportunidades, idadeFiltro, agregar]);

  /** Idem, para Idade. */
  const baseParaContarIdade = useMemo(() => {
    if (!clientes) return [];
    const hoje = hojeSemHora();
    return clientes.filter((c) => passaFiltrosGerais(c, hoje, "idade"));
  }, [clientes, busca, tagsFiltro, statusFiltro, oportunidades, premioFiltro, agregar]);

  const filtradosOrdenados = useMemo(() => {
    if (!ordem) return filtrados;
    const valor = (c: ClienteWithRelations) =>
      ordem.campo === "premio" ? (agregar.get(c.id)?.premio ?? 0) : (idadeDoCliente(c) ?? -1);
    const arr = [...filtrados];
    arr.sort((a, b) => (ordem.direcao === "asc" ? valor(a) - valor(b) : valor(b) - valor(a)));
    return arr;
  }, [filtrados, ordem, agregar]);

  const contarFaixaPremio = (key: string) => {
    const faixa = PREMIO_FAIXAS.find((f) => f.key === key);
    if (!faixa) return 0;
    return baseParaContarPremio.filter((c) => faixa.teste(agregar.get(c.id)?.premio ?? 0)).length;
  };

  const contarFaixaIdade = (key: string) =>
    baseParaContarIdade.filter((c) => clienteBateFaixaIdade(c, key)).length;

  const toggleFaixaPremio = (key: string) =>
    setPremioFiltro((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleFaixaIdade = (key: string) =>
    setIdadeFiltro((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const totais = useMemo(() => {
    let premio = 0;
    let capital = 0;
    for (const c of filtrados) {
      const agg = agregar.get(c.id);
      if (agg) {
        premio += agg.premio;
        capital += agg.capital;
      }
    }
    return { premio, capital, qtd: filtrados.length };
  }, [filtrados, agregar]);

  const toggleTag = (id: string) =>
    setTagsFiltro((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleOportunidade = (chip: ChipKey) =>
    setOportunidades((s) => {
      const next = new Set(s);
      if (next.has(chip)) next.delete(chip);
      else next.add(chip);
      return next;
    });

  const toggleSelecionado = (id: string) =>
    setSelecionados((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const todosVisiveisSelecionados =
    filtradosOrdenados.length > 0 && filtradosOrdenados.every((c) => selecionados.has(c.id));

  const toggleSelecionarTodosVisiveis = () =>
    setSelecionados((s) => {
      if (todosVisiveisSelecionados) {
        const next = new Set(s);
        filtradosOrdenados.forEach((c) => next.delete(c.id));
        return next;
      }
      const next = new Set(s);
      filtradosOrdenados.forEach((c) => next.add(c.id));
      return next;
    });

  const enviarParaKanban = async (funil: FunilKey, estagioId: string) => {
    const ids = [...selecionados];
    try {
      await bulkEstagio.mutateAsync({ clienteIds: ids, funil, estagioId });
      toast.success(`${ids.length} cliente${ids.length === 1 ? "" : "s"} enviado${ids.length === 1 ? "" : "s"} para o Funil.`);
      setSelecionados(new Set());
      navigate(`/kanban?funil=${funil}`);
    } catch (err) {
      toast.error("Erro ao enviar para o Funil.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const adicionarAoSitPlan = async () => {
    const ids = [...selecionados];
    try {
      await addSitPlan.mutateAsync({ clienteIds: ids, data: hojeIso() });
      toast.success(`${ids.length} cliente${ids.length === 1 ? "" : "s"} adicionado${ids.length === 1 ? "" : "s"} ao SitPlan de hoje.`);
      setSelecionados(new Set());
      navigate("/sitplan");
    } catch (err) {
      toast.error("Erro ao adicionar ao SitPlan.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleQualificacao = async (id: string, qualificacao: number) => {
    try {
      await updateMut.mutateAsync({ id, qualificacao });
    } catch (err) {
      toast.error("Erro ao salvar qualificação.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleEtapa = async (id: string, etapa: string) => {
    try {
      await updateMut.mutateAsync({ id, etapa: etapa === "__limpar__" ? null : etapa });
    } catch (err) {
      toast.error("Erro ao salvar etapa.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const abrirNovo = () => {
    setEditando(null);
    setDialogOpen(true);
  };
  const abrirEdicao = (c: ClienteWithRelations) => {
    setEditando(c);
    setDialogOpen(true);
  };
  const confirmarExclusao = async () => {
    if (!excluindo) return;
    try {
      await deleteMut.mutateAsync(excluindo.id);
      toast.success("Cliente excluído.");
      setExcluindo(null);
    } catch (err) {
      toast.error("Erro ao excluir cliente.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
            <Users className="size-[18px]" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold">Carteira de Clientes</h2>
            {kpis.importadoHaDias !== null && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success">
                <span className="size-1.5 rounded-full bg-success" />
                Importado há {kpis.importadoHaDias} {kpis.importadoHaDias === 1 ? "dia" : "dias"}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/kanban")}>
            <Filter className="size-4" />
            Funil
          </Button>
          <Button variant="outline" onClick={() => navigate("/aniversariantes")}>
            <Cake className="size-4" />
            Aniversariantes
          </Button>
          <Button variant="outline" onClick={() => navigate("/revisitas")}>
            <CalendarClock className="size-4" />
            Revisão Anual
          </Button>
          <Button variant="outline" onClick={() => navigate("/importar")}>
            <Upload className="size-4" />
            Importar
          </Button>
          <Button onClick={abrirNovo}>
            <Plus className="size-4" />
            Novo cliente
          </Button>
        </div>
      </div>

      {/* KPIs da carteira completa */}
      <div className="mb-3.5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        <Card className="p-3">
          <p className="mb-1.5 text-[11px] text-muted-foreground">Clientes ({kpis.totalClientes})</p>
          <div className="flex gap-3.5">
            <div className="flex flex-col">
              <span className="text-lg font-bold tabular-nums">{kpis.clientesAtivos}</span>
              <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">ativos</span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tabular-nums text-[#b42318]">{kpis.clientesCancelados}</span>
              <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">cancelados</span>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <p className="mb-1.5 text-[11px] text-muted-foreground">Apólices ({kpis.apolicesAtivas + kpis.apolicesCanceladas})</p>
          <div className="flex gap-3.5">
            <div className="flex flex-col">
              <span className="text-lg font-bold tabular-nums">{kpis.apolicesAtivas}</span>
              <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">ativas</span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tabular-nums text-[#b42318]">{kpis.apolicesCanceladas}</span>
              <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">canceladas</span>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <p className="mb-1.5 text-[11px] text-muted-foreground">Prêmio mensal</p>
          <p className="text-lg font-bold tabular-nums">{formatarMoeda(kpis.premioMensal)}</p>
        </Card>
        <Card className="p-3">
          <p className="mb-1.5 text-[11px] text-muted-foreground">CS Total</p>
          <p className="text-lg font-bold tabular-nums">{formatarMoedaCompacta(kpis.capitalTotal)}</p>
        </Card>
        <Card className="col-span-2 p-3 sm:col-span-4 lg:col-span-1">
          <p className="mb-1.5 text-[11px] text-muted-foreground">Ticket médio</p>
          <p className="text-lg font-bold tabular-nums">{formatarMoeda(kpis.ticketMedio)}</p>
        </Card>
      </div>

      {/* Oportunidades de venda */}
      <Card className="mb-3.5 p-3.5">
        <div className="mb-1 flex items-center gap-1.5 text-sm font-bold">
          <Sparkles className="size-4 text-primary" />
          Oportunidades de venda
        </div>
        <p className="mb-2.5 text-xs text-muted-foreground">
          Filtre clientes ativos que possuem lacunas na proteção para oferecer novas coberturas.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {CHIPS.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => toggleOportunidade(chip.key)}
              className={cn(
                "rounded-full border px-2.5 py-1.5 text-[11.5px] font-semibold transition-smooth",
                oportunidades.has(chip.key)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Filtros da tabela */}
      <Card className="mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, CPF, celular ou e-mail"
            className="pl-8"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-between">
              Tags
              <ChevronDown className="size-4 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="start">
            <div className="flex flex-col gap-1">
              {(tags ?? []).length === 0 && (
                <p className="p-2 text-sm text-muted-foreground">Nenhuma tag cadastrada.</p>
              )}
              {(tags ?? []).map((t) => (
                <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
                  <Checkbox checked={tagsFiltro.has(t.id)} onCheckedChange={() => toggleTag(t.id)} />
                  <TagBadge tag={t} />
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status da apólice" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={STATUS_TODOS}>Todas as apólices</SelectItem>
            {APOLICE_STATUS.map((s) => (
              <SelectItem key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button variant="outline" disabled>Compartilhar</Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Em breve</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button variant="outline" disabled>Colunas</Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Em breve</TooltipContent>
        </Tooltip>
      </Card>

      {/* Seleção em lote */}
      {selecionados.size > 0 && (
        <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
          <span className="text-sm font-medium">
            {selecionados.size} selecionado{selecionados.size === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:underline"
            onClick={() => setSelecionados(new Set())}
          >
            Limpar
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" disabled={bulkEstagio.isPending}>
                <LayoutGrid className="size-4" />
                Enviar pro Funil ({selecionados.size})
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-60">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Enviar para qual coluna?
              </p>
              <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
                {FUNIS.map((f) => {
                  const colunas = (estagiosKanban ?? []).filter((e) => e.funil === f.key);
                  if (colunas.length === 0) return null;
                  return (
                    <div key={f.key} className="flex flex-col gap-0.5 [&:not(:first-child)]:mt-2">
                      <p className="px-2 text-xs font-semibold text-foreground">{f.nomeCompleto}</p>
                      {colunas.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => enviarParaKanban(f.key, e.id)}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                        >
                          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: e.cor }} />
                          {e.nome}
                        </button>
                      ))}
                    </div>
                  );
                })}
                {(estagiosKanban ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma coluna criada no Funil ainda.</p>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <Button size="sm" variant="outline" onClick={adicionarAoSitPlan} disabled={addSitPlan.isPending}>
            <ListChecks className="size-4" />
            Adicionar ao SitPlan ({selecionados.size})
          </Button>
        </Card>
      )}

      {/* Resumo da seleção filtrada */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Prêmio mensal (filtrado)</p>
          <p className="text-lg font-semibold text-primary">{formatarMoeda(totais.premio)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Capital segurado (filtrado)</p>
          <p className="text-lg font-semibold">{formatarMoeda(totais.capital)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Clientes filtrados</p>
          <p className="text-lg font-semibold">{totais.qtd}</p>
        </Card>
      </div>

      {/* Tabela */}
      {isLoading && <LoadingState className="py-16" />}
      {isError && <ErrorState onRetry={() => refetch()} message="Não foi possível carregar os clientes." />}
      {!isLoading && !isError && filtrados.length === 0 && (
        <EmptyState
          icon={Users}
          title="Nenhum cliente encontrado"
          description="Ajuste os filtros ou cadastre um novo cliente."
          action={<Button onClick={abrirNovo}><Plus className="size-4" />Novo cliente</Button>}
        />
      )}

      {filtrados.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={todosVisiveisSelecionados} onCheckedChange={toggleSelecionarTodosVisiveis} aria-label="Selecionar todos" />
                  </TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-center">Apólices</TableHead>
                  <TableHead className="text-right">
                    <span className="inline-flex items-center justify-end gap-1">
                      Prêmio
                      <ColumnFilterButton
                        faixas={PREMIO_FAIXAS}
                        selecionadas={premioFiltro}
                        onToggleFaixa={toggleFaixaPremio}
                        onLimpar={() => setPremioFiltro(new Set())}
                        contarFaixa={contarFaixaPremio}
                        direcao={ordem?.campo === "premio" ? ordem.direcao : null}
                        onOrdenar={(direcao) => setOrdem(direcao ? { campo: "premio", direcao } : null)}
                        labelMaior="Quem paga mais"
                        labelMenor="Quem paga menos"
                      />
                    </span>
                  </TableHead>
                  <TableHead className="text-right">Capital Segurado</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1">
                      Idade
                      <ColumnFilterButton
                        faixas={IDADE_FAIXAS}
                        selecionadas={idadeFiltro}
                        onToggleFaixa={toggleFaixaIdade}
                        onLimpar={() => setIdadeFiltro(new Set())}
                        contarFaixa={contarFaixaIdade}
                        direcao={ordem?.campo === "idade" ? ordem.direcao : null}
                        onOrdenar={(direcao) => setOrdem(direcao ? { campo: "idade", direcao } : null)}
                        labelMaior="Mais velhos"
                        labelMenor="Mais novos"
                      />
                    </span>
                  </TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Qualificação</TableHead>
                  <TableHead>Cliente desde</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradosOrdenados.map((c) => {
                  const agg = agregar.get(c.id) ?? { count: 0, premio: 0, capital: 0 };
                  const cTags = (c.cliente_tags ?? []).map((ct) => ct.tag).filter(Boolean);
                  const idade = idadeDoCliente(c);
                  return (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => navigate(`/clientes/${c.id}`)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selecionados.has(c.id)} onCheckedChange={() => toggleSelecionado(c.id)} aria-label={`Selecionar ${c.nome_completo}`} />
                      </TableCell>
                      <TableCell className="font-medium">
                        {c.nome_completo}
                        {c.cpf && <span className="ml-2 text-xs text-muted-foreground">{c.cpf}</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success">
                          {agg.count} ativ.
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-xs font-bold">{formatarMoeda(agg.premio)}</span>
                        <span className="block text-[9px] uppercase tracking-wide text-muted-foreground">mensal</span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatarMoeda(agg.capital)}</TableCell>
                      <TableCell className="text-sm">
                        {[c.cidade, c.uf].filter(Boolean).length > 0 ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3.5 text-muted-foreground" />
                            {[c.cidade, c.uf].filter(Boolean).join(" - ")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{idade !== null ? `${idade} anos` : "—"}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select value={c.etapa ?? "__limpar__"} onValueChange={(v) => handleEtapa(c.id, v)}>
                          <SelectTrigger className="h-8 w-[150px] text-xs">
                            <SelectValue placeholder="Etapa">
                              {(() => {
                                const info = etapaInfo(c.etapa);
                                return info ? (
                                  <span className={`flex items-center gap-1.5 ${info.colorClass}`}>
                                    <info.icon className="size-3.5" />
                                    {info.label}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                );
                              })()}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__limpar__">
                              <span className="text-muted-foreground">- Limpar -</span>
                            </SelectItem>
                            {ETAPA_OPCOES.map((o) => (
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
                        <StarRating value={c.qualificacao} onChange={(n) => handleQualificacao(c.id, n)} />
                      </TableCell>
                      <TableCell className="text-sm">{formatarData(c.cliente_desde)}</TableCell>
                      <TableCell>
                        <div className="flex max-w-[180px] flex-wrap gap-1">
                          {cTags.slice(0, 3).map((t) => (
                            <TagBadge key={t.id} tag={t} className="text-[10px] px-1.5 py-0" />
                          ))}
                          {cTags.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{cTags.length - 3}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8" aria-label="Ações">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => abrirEdicao(c)}>
                              <Pencil className="size-3.5" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className={cn("text-destructive focus:text-destructive")}
                              onClick={() => setExcluindo(c)}
                            >
                              <Trash2 className="size-3.5" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <ClienteFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cliente={editando}
        onSuccess={(id) => {
          if (!editando) navigate(`/clientes/${id}`);
        }}
      />
      <ConfirmDialog
        open={!!excluindo}
        onOpenChange={(o) => !o && setExcluindo(null)}
        title="Excluir cliente?"
        description="Esta ação removerá o cliente e todas as apólices, coberturas e vínculos de tags associados."
        confirmText="Excluir"
        destructive
        onConfirm={confirmarExclusao}
      />
    </div>
  );
}
