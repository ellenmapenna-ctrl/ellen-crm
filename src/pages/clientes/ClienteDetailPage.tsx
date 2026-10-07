import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Sparkles,
  Tags as TagsIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/Feedback";
import { TagBadge } from "@/components/shared/TagBadge";
import { ClienteCampos } from "@/components/clientes/ClienteCampos";
import { FunisDoClienteCampos } from "@/components/clientes/FunisDoClienteCampos";
import { ApoliceResumoCard } from "@/components/clientes/ApoliceResumoCard";
import { clienteFormToInsert, estadoInicialCliente, type ClienteFormState } from "@/lib/cliente-form";
import { ApoliceFormDialog } from "@/components/clientes/ApoliceFormDialog";
import { CoberturaFormDialog } from "@/components/clientes/CoberturaFormDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCliente, useUpdateCliente } from "@/hooks/useClientes";
import { urlGoogleAgenda } from "@/lib/google-agenda";
import { useApolices } from "@/hooks/useApolices";
import { useKanbanEstagios } from "@/hooks/useKanbanEstagios";
import { useFunisDoClienteForm } from "@/hooks/useFunisDoClienteForm";
import { FUNIS } from "@/lib/funis";
import { useTags, useAddTagToCliente, useRemoveTagFromCliente } from "@/hooks/useTags";
import { COBERTURAS_CANONICAS, RIDERS_INCLUSOS, coberturaCorrespondeARotulo, ehCoberturaBase } from "@/lib/seguros-taxonomia";
import { diaDoVencimento, proximoVencimentoDoCliente } from "@/lib/vencimentos";
import { useRevisitasResumo } from "@/hooks/useRevisitas";
import { haQuantoTempoRevisita, ultimaRevisitaPorCliente } from "@/lib/ultima-revisita";
import type { Apolice, ApoliceWithCoberturas, Cobertura } from "@/lib/types";
import { formatarData, formatarMoeda, paraNumero } from "@/lib/format";
import { idadeAtualDetalhada } from "@/lib/aniversario";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  ativa: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelada: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  suspensa: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

const SECOES = [
  { key: "coberturas", label: "Coberturas" },
  { key: "apolices", label: "Apólices" },
  { key: "contatos", label: "Contatos e Agendamentos" },
  { key: "tarefas", label: "Tarefas" },
  { key: "dados", label: "Dados pessoais" },
  { key: "tags", label: "Tags" },
] as const;

type SecaoKey = (typeof SECOES)[number]["key"];

/** Quantas coberturas canônicas ainda não estão contratadas (ativas ou inclusas) em nenhuma apólice ativa do cliente. */
function contarNaoContratadas(apolicesAtivas: ApoliceWithCoberturas[]): number {
  if (apolicesAtivas.length === 0) return 0;
  const todasCoberturas = apolicesAtivas.flatMap((a) => a.coberturas ?? []);
  const temBasicaAtiva = todasCoberturas.some((c) => ehCoberturaBase(c) && c.status === "ativa");

  let naoContratadas = 0;
  for (const { rotulo } of COBERTURAS_CANONICAS) {
    const contratada = todasCoberturas.some((c) => c.status === "ativa" && coberturaCorrespondeARotulo(c.nome_cobertura, rotulo));
    const incluso = RIDERS_INCLUSOS.includes(rotulo) && temBasicaAtiva;
    if (!contratada && !incluso) naoContratadas++;
  }
  return naoContratadas;
}

/** Apólice ativa com o vencimento mais próximo (ignora apólices sem data de vencimento). */
function apoliceProximoVencimento(apolices: ApoliceWithCoberturas[]): ApoliceWithCoberturas | null {
  const candidatas = apolices.filter((a) => a.status === "ativa" && a.vencimento_apolice);
  if (candidatas.length === 0) return null;
  return [...candidatas].sort((a, b) => (a.vencimento_apolice! < b.vencimento_apolice! ? -1 : 1))[0];
}

function AcaoDesabilitada({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" disabled className="flex size-8 items-center justify-center rounded-full text-muted-foreground/50">
          <Icon className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label} — em breve</TooltipContent>
    </Tooltip>
  );
}

export function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: cliente, isLoading, isError, refetch } = useCliente(id);
  const { data: estagios } = useKanbanEstagios();
  const funis = useFunisDoClienteForm(id);
  const { data: apolicesData, isLoading: apolicesLoading } = useApolices(id);
  const { data: todasTags } = useTags();
  const updateMut = useUpdateCliente();
  const addTag = useAddTagToCliente(id ?? "");
  const removeTag = useRemoveTagFromCliente(id ?? "");

  const [form, setForm] = useState<ClienteFormState>({});
  const [secao, setSecao] = useState<SecaoKey>("coberturas");
  const [apoliceDialog, setApoliceDialog] = useState(false);
  const [apoliceEdit, setApoliceEdit] = useState<Apolice | null>(null);
  const [coberturaDialog, setCoberturaDialog] = useState(false);
  const [coberturaEdit, setCoberturaEdit] = useState<Cobertura | null>(null);
  const [coberturaApoliceId, setCoberturaApoliceId] = useState<string>("");

  useEffect(() => {
    if (cliente) setForm(estadoInicialCliente(cliente));
  }, [cliente]);

  useEffect(() => {
    setSecao("coberturas");
  }, [id]);

  const totais = useMemo(() => {
    const ativas = (cliente?.apolices ?? []).filter((a) => a.status === "ativa");
    return {
      count: ativas.length,
      premio: ativas.reduce((s, a) => s + Number(a.premio_mensal_total ?? 0), 0),
      capital: ativas.reduce((s, a) => s + Number(a.capital_segurado_total ?? 0), 0),
    };
  }, [cliente]);

  const apolicesAtivas = useMemo(() => (apolicesData ?? []).filter((a) => a.status === "ativa"), [apolicesData]);
  const naoContratadas = useMemo(() => contarNaoContratadas(apolicesAtivas), [apolicesAtivas]);
  const proximaApolice = useMemo(() => apoliceProximoVencimento(apolicesData ?? []), [apolicesData]);
  const diaVencimento = useMemo(() => diaDoVencimento(proximoVencimentoDoCliente(apolicesData ?? [])), [apolicesData]);
  const { data: revisitasResumo } = useRevisitasResumo();
  const ultimaRevisita = useMemo(
    () => (cliente ? (ultimaRevisitaPorCliente([{ id: cliente.id, nome_completo: cliente.nome_completo }], revisitasResumo ?? []).get(cliente.id) ?? null) : null),
    [cliente, revisitasResumo],
  );
  const idade = idadeAtualDetalhada(cliente?.data_nascimento);

  const tagsDoCliente = useMemo(
    () => (cliente?.cliente_tags ?? []).map((ct) => ({ id: ct.tag_id, ...ct.tag })),
    [cliente]
  );
  const tagsDisponiveis = useMemo(
    () => (todasTags ?? []).filter((t) => !tagsDoCliente.some((ct) => ct.id === t.id)),
    [todasTags, tagsDoCliente]
  );

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !form.nome_completo?.trim()) {
      toast.error("Informe o nome completo.");
      return;
    }
    try {
      await updateMut.mutateAsync({ id, ...clienteFormToInsert(form) });
      await funis.salvar(id);
      toast.success("Dados salvos.");
    } catch (err) {
      toast.error("Erro ao salvar.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  if (isLoading) return <LoadingState className="py-20" />;
  if (isError) return <ErrorState onRetry={() => refetch()} message="Não foi possível carregar o cliente." />;
  if (!cliente) return <EmptyState icon={FileText} title="Cliente não encontrado" />;

  return (
    <div className="mx-auto max-w-6xl">
      <Card className="mb-4 overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/clientes">
              <ArrowLeft className="size-4" />
              Voltar
            </Link>
          </Button>
          <div className="flex items-center gap-1 rounded-full bg-muted p-1">
            {cliente.celular ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a href={`tel:${cliente.celular}`} className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground">
                    <Phone className="size-4" />
                  </a>
                </TooltipTrigger>
                <TooltipContent>Ligar para {cliente.celular}</TooltipContent>
              </Tooltip>
            ) : (
              <AcaoDesabilitada icon={Phone} label="Ligar" />
            )}
            <AcaoDesabilitada icon={MessageCircle} label="Chat" />
            {cliente.email ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a href={`mailto:${cliente.email}`} className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground">
                    <Mail className="size-4" />
                  </a>
                </TooltipTrigger>
                <TooltipContent>Enviar e-mail para {cliente.email}</TooltipContent>
              </Tooltip>
            ) : (
              <AcaoDesabilitada icon={Mail} label="Email" />
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={urlGoogleAgenda(cliente)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground"
                >
                  <CalendarClock className="size-4" />
                </a>
              </TooltipTrigger>
              <TooltipContent>Agendar no Google Agenda</TooltipContent>
            </Tooltip>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button disabled>
                  <Sparkles className="size-4" />
                  Recomendações
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Em breve</TooltipContent>
          </Tooltip>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h1 className="text-xl font-bold">{cliente.nome_completo}</h1>
            <div className="flex flex-wrap items-center gap-2">
              {FUNIS.map((f) => {
                const estagio = (estagios ?? []).find((e) => e.id === funis.salvos[f.key]);
                if (!estagio) return null;
                return (
                  <Badge key={f.key} variant="outline" className="gap-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: estagio.cor }} />
                    {f.nomeCompleto}: {estagio.nome}
                  </Badge>
                );
              })}
              <Badge className={STATUS_STYLE.ativa}>
                {totais.count} apólice{totais.count === 1 ? "" : "s"} ativa{totais.count === 1 ? "" : "s"}
              </Badge>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {cliente.cpf && <span>CPF <strong className="text-foreground">{cliente.cpf}</strong></span>}
            {cliente.data_nascimento && (
              <>
                <span className="text-border">·</span>
                <span>Nascimento <strong className="text-foreground">{formatarData(cliente.data_nascimento)}</strong></span>
                {idade && (
                  <>
                    <span className="text-border">·</span>
                    <span>Idade <strong className="text-foreground">{idade.anos} anos e {idade.meses} meses</strong></span>
                  </>
                )}
              </>
            )}
          </div>
          {(diaVencimento || proximaApolice?.melhor_dia_pagamento || ultimaRevisita) && (
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {diaVencimento && (
                <span>Dia de vencimento <strong className="text-foreground">{diaVencimento}</strong></span>
              )}
              {diaVencimento && proximaApolice?.melhor_dia_pagamento && <span className="text-border">·</span>}
              {proximaApolice?.melhor_dia_pagamento && (
                <span>Melhor Dia <strong className="text-foreground">{proximaApolice.melhor_dia_pagamento}</strong></span>
              )}
              {ultimaRevisita && (
                <>
                  {(diaVencimento || proximaApolice?.melhor_dia_pagamento) && <span className="text-border">·</span>}
                  <span>
                    Última revisita <strong className="text-foreground">{formatarData(ultimaRevisita)}</strong>{" "}
                    <span className="text-xs">({haQuantoTempoRevisita(ultimaRevisita)})</span>
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[200px_1fr] md:items-start">
        <nav className="flex flex-col gap-1 rounded-xl border bg-card p-2 md:sticky md:top-4">
          {SECOES.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setSecao(s.key)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-smooth",
                secao === s.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <span
                className={cn(
                  "flex size-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  secao === s.key ? "bg-white/25" : "bg-muted text-muted-foreground"
                )}
              >
                {i + 1}
              </span>
              {s.label}
            </button>
          ))}
        </nav>

        <div>
          {/* Coberturas (espelho) */}
          {secao === "coberturas" && (
            <div className="flex flex-col gap-4">
              {apolicesAtivas.length > 0 && naoContratadas > 0 && (
                <div className="rounded-lg bg-success-soft px-3.5 py-2.5 text-sm font-semibold text-success">
                  {naoContratadas} cobertura{naoContratadas === 1 ? "" : "s"} ainda não contratada{naoContratadas === 1 ? "" : "s"}. Aproveite para sugerir.
                </div>
              )}
              {apolicesLoading && <LoadingState />}
              {!apolicesLoading && (apolicesData?.length ?? 0) === 0 && (
                <EmptyState
                  icon={FileText}
                  title="Nenhuma apólice cadastrada"
                  description="Cadastre a primeira apólice deste cliente para ver o resumo aqui."
                  action={
                    <Button onClick={() => setSecao("apolices")}>
                      <Plus className="size-4" />
                      Ir para Apólices
                    </Button>
                  }
                />
              )}
              {apolicesData?.map((a) => (
                <ApoliceResumoCard key={a.id} cliente={cliente} apolice={a} />
              ))}
            </div>
          )}

          {/* Apólices */}
          {secao === "apolices" && (
            <div>
              <div className="mb-3 flex justify-end">
                <Button
                  onClick={() => {
                    setApoliceEdit(null);
                    setApoliceDialog(true);
                  }}
                >
                  <Plus className="size-4" />
                  Nova apólice
                </Button>
              </div>

              {apolicesLoading && <LoadingState />}
              {!apolicesLoading && (apolicesData?.length ?? 0) === 0 && (
                <EmptyState icon={FileText} title="Nenhuma apólice" description="Cadastre a primeira apólice deste cliente." />
              )}

              <div className="flex flex-col gap-3">
                {apolicesData?.map((a) => (
                  <ApoliceCard
                    key={a.id}
                    apolice={a}
                    onEdit={() => {
                      setApoliceEdit(a);
                      setApoliceDialog(true);
                    }}
                    onNovaCobertura={(apoliceId) => {
                      setCoberturaApoliceId(apoliceId);
                      setCoberturaEdit(null);
                      setCoberturaDialog(true);
                    }}
                    onEditCobertura={(apoliceId, cob) => {
                      setCoberturaApoliceId(apoliceId);
                      setCoberturaEdit(cob);
                      setCoberturaDialog(true);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Contatos e Agendamentos (placeholder) */}
          {secao === "contatos" && (
            <EmptyState icon={CalendarClock} title="Contatos e Agendamentos" description="Em breve." />
          )}

          {/* Tarefas (placeholder) */}
          {secao === "tarefas" && (
            <EmptyState icon={FileText} title="Tarefas" description="Em breve." />
          )}

          {/* Dados pessoais */}
          {secao === "dados" && (
            <Card className="p-4 sm:p-6">
              <form onSubmit={salvar} className="flex flex-col gap-6">
                <ClienteCampos
                  form={form}
                  set={set}
                  funis={<FunisDoClienteCampos valores={funis.valores} onChange={funis.onChange} />}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={updateMut.isPending}>
                    {updateMut.isPending ? "Salvando..." : "Salvar alterações"}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Tags */}
          {secao === "tags" && (
            <Card className="flex flex-col gap-4 p-4 sm:p-6">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Tags atuais</h3>
                {tagsDoCliente.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma tag aplicada a este cliente.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tagsDoCliente.map((t) => (
                      <TagBadge key={t.id} tag={t} onRemove={() => removeTag.mutate(t.id)} />
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Adicionar tags</h3>
                {tagsDisponiveis.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Todas as tags já estão aplicadas ou não há tags cadastradas.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tagsDisponiveis.map((t) => (
                      <Button
                        key={t.id}
                        variant="outline"
                        size="sm"
                        onClick={() => addTag.mutate(t.id)}
                        disabled={addTag.isPending}
                      >
                        <TagsIcon className="size-3.5" />
                        {t.nome}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      <ApoliceFormDialog
        open={apoliceDialog}
        onOpenChange={setApoliceDialog}
        clienteId={id ?? ""}
        apolice={apoliceEdit}
      />
      <CoberturaFormDialog
        open={coberturaDialog}
        onOpenChange={setCoberturaDialog}
        apoliceId={coberturaApoliceId}
        cobertura={coberturaEdit}
      />
    </div>
  );
}

function ApoliceCard({
  apolice,
  onEdit,
  onNovaCobertura,
  onEditCobertura,
}: {
  apolice: ApoliceWithCoberturas;
  onEdit: () => void;
  onNovaCobertura: (apoliceId: string) => void;
  onEditCobertura: (apoliceId: string, cob: Cobertura) => void;
}) {
  const coberturas = apolice.coberturas ?? [];
  return (
    <Collapsible defaultOpen className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <CollapsibleTrigger asChild>
          <button className="flex flex-1 items-center gap-3 text-left">
            <ChevronDown className="size-4 text-muted-foreground" />
            <div>
              <p className="font-medium">
                {apolice.numero_apolice || "Sem número"}
                {apolice.seguradora && <span className="ml-2 text-sm text-muted-foreground">{apolice.seguradora}</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {apolice.tipo_produto ?? "Sem tipo"} · vence em {formatarData(apolice.vencimento_apolice)}
              </p>
            </div>
          </button>
        </CollapsibleTrigger>
        <div className="flex items-center gap-2">
          <Badge className={STATUS_STYLE[apolice.status] ?? ""}>{apolice.status}</Badge>
          <div className="text-right text-xs">
            <p className="font-mono">{formatarMoeda(apolice.premio_mensal_total)}</p>
            <p className="text-muted-foreground">{formatarMoeda(apolice.capital_segurado_total)}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onEdit}>Editar</Button>
        </div>
      </div>
      <CollapsibleContent>
        <div className="border-t p-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold">Coberturas ({coberturas.length})</h4>
            <Button variant="outline" size="sm" onClick={() => onNovaCobertura(apolice.id)}>
              <Plus className="size-3.5" />
              Nova cobertura
            </Button>
          </div>
          {coberturas.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma cobertura cadastrada.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cobertura</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Capital</TableHead>
                    <TableHead className="text-right">Prêmio</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coberturas.map((cob) => (
                    <TableRow key={cob.id}>
                      <TableCell className="font-medium">{cob.nome_cobertura}</TableCell>
                      <TableCell className="capitalize">{cob.tipo}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_STYLE[cob.status] ?? ""}>{cob.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatarMoeda(paraNumero(cob.capital_segurado))}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatarMoeda(paraNumero(cob.premio_mensal))}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => onEditCobertura(apolice.id, cob)}>Editar</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
