import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Eye, Loader2, Plus, Save, X } from "lucide-react";
import { LoadingState, ErrorState } from "@/components/shared/Feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useRevisita, useAtualizarRevisita } from "@/hooks/useRevisitas";
import { cn } from "@/lib/utils";
import { opcoesSeguradora, seguradoraDaLinha, SUGESTOES_COBERTURA } from "@/lib/revisita-opcoes";
import { SeguradorasField } from "@/components/revisitas/SeguradorasField";
import { buscarDetalhesCatalogo } from "@/lib/catalogo-revisita";
import { renderRevisitaHtml, type RevisitaCobertura, type RevisitaDados, type RevisitaFormato, type RevisitaPremioLinha } from "@/lib/revisita-template";
import { BaixarPdfButton } from "./BaixarPdfButton";
import { BaixarPdfReuniaoButton } from "./BaixarPdfReuniaoButton";
import { ApresentacaoSeletor } from "@/components/revisitas/ApresentacaoSeletor";

const FORMATOS: { valor: RevisitaFormato; nome: string; desc: string }[] = [
  { valor: "vanguarda", nome: "Vanguarda", desc: "Banner diagonal em destaque, com rodapé de contatos em ícones." },
  { valor: "essencial", nome: "Essencial", desc: "Cabeçalho enxuto e direto, visual limpo e objetivo." },
  { valor: "vitrine", nome: "Vitrine", desc: "Redesenho completo com bloco de recomendação em destaque." },
];

function detectarFormato(html: string): RevisitaFormato {
  if (html.includes("van-banner")) return "vanguarda";
  if (html.includes("ess-topline")) return "essencial";
  return "vitrine";
}

function coberturaVazia(): RevisitaCobertura {
  return { titulo: "", atualValor: "", atualDetalhes: [], novoValor: "", novoDetalhes: [] };
}

function premioVazio(): RevisitaPremioLinha {
  return { seguradora: "", valorTexto: "" };
}

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function ehLinhaResgate(titulo: string): boolean {
  return normalizar(titulo).includes("resgate");
}

/** Rótulo pequeno em caixa alta, estilo Platoris. */
function Rotulo({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>;
}

function Secao({ titulo, acao, children }: { titulo: string; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-black/5 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

export function EditarRevisitaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useRevisita(id);
  const atualizar = useAtualizarRevisita();

  const [formato, setFormato] = useState<RevisitaFormato>("vitrine");
  const [dados, setDados] = useState<RevisitaDados | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [previewAberto, setPreviewAberto] = useState(false);

  useEffect(() => {
    if (data) {
      setDados(data.dados);
      setFormato(detectarFormato(data.html));
    }
  }, [data]);

  const html = useMemo(() => {
    if (!dados) return null;
    try {
      return renderRevisitaHtml(dados, formato);
    } catch {
      return null;
    }
  }, [dados, formato]);

  if (isLoading) return <LoadingState className="py-16" />;
  if (isError || !data || !dados) return <ErrorState onRetry={() => refetch()} message="Não foi possível carregar essa revisita." />;

  const atualizarCampo = <K extends keyof RevisitaDados>(campo: K, valor: RevisitaDados[K]) => {
    setDados((prev) => (prev ? { ...prev, [campo]: valor } : prev));
  };

  const atualizarCobertura = (idx: number, patch: Partial<RevisitaCobertura>) => {
    setDados((prev) => {
      if (!prev) return prev;
      const coberturas = prev.coberturas.map((c, i) => (i === idx ? { ...c, ...patch } : c));
      return { ...prev, coberturas };
    });
  };

  const selecionarSeguradora = (idx: number, lado: "atual" | "novo", seguradora: string) => {
    const cobertura = dados.coberturas[idx];
    atualizarCobertura(idx, lado === "atual" ? { atualSeguradora: seguradora || undefined } : { novoSeguradora: seguradora || undefined });
    if (!seguradora) return;
    const sugeridos = buscarDetalhesCatalogo(seguradora, cobertura.titulo);
    if (!sugeridos) {
      toast.info(`Ainda não há texto padrão de ${seguradora} para "${cobertura.titulo}".`, { description: "A escolha ficou marcada; ajuste o texto da cobertura à mão se precisar." });
      return;
    }
    atualizarCobertura(idx, lado === "atual" ? { atualDetalhes: sugeridos } : { novoDetalhes: sugeridos });
  };

  const removerCobertura = (idx: number) => {
    setDados((prev) => (prev ? { ...prev, coberturas: prev.coberturas.filter((_, i) => i !== idx) } : prev));
  };

  const adicionarCobertura = () => {
    setDados((prev) => (prev ? { ...prev, coberturas: [...prev.coberturas, coberturaVazia()] } : prev));
  };

  // "Resgate" não é um campo à parte — é só mais uma linha de cobertura
  // (igual o Platoris trata), com um atalho de checkbox pra cada lado.
  const linhaResgateIdx = dados.coberturas.findIndex((c) => ehLinhaResgate(c.titulo));
  const linhaResgate = linhaResgateIdx >= 0 ? dados.coberturas[linhaResgateIdx] : null;
  const temResgateAtual = !!linhaResgate && !linhaResgate.atualSemCobertura;
  const temResgateNovo = !!linhaResgate && !linhaResgate.novoSemCobertura;

  const alternarResgate = (lado: "atual" | "novo", marcado: boolean) => {
    setDados((prev) => {
      if (!prev) return prev;
      let coberturas = [...prev.coberturas];
      let idx = coberturas.findIndex((c) => ehLinhaResgate(c.titulo));
      if (idx < 0) {
        coberturas.push({ titulo: "Resgate", atualValor: "", atualDetalhes: [], atualSemCobertura: true, novoValor: "", novoDetalhes: [], novoSemCobertura: true });
        idx = coberturas.length - 1;
      }
      const campo = lado === "atual" ? "atualSemCobertura" : "novoSemCobertura";
      coberturas[idx] = { ...coberturas[idx], [campo]: !marcado };
      const linha = coberturas[idx];
      if (linha.atualSemCobertura && linha.novoSemCobertura) {
        coberturas = coberturas.filter((_, i) => i !== idx);
      }
      return { ...prev, coberturas };
    });
  };

  const atualizarPremio = (lado: "premiosAtual" | "premiosNovo", idx: number, patch: Partial<RevisitaPremioLinha>) => {
    setDados((prev) => {
      if (!prev) return prev;
      const lista = prev[lado].map((p, i) => (i === idx ? { ...p, ...patch } : p));
      return { ...prev, [lado]: lista };
    });
  };

  const removerPremio = (lado: "premiosAtual" | "premiosNovo", idx: number) => {
    setDados((prev) => (prev ? { ...prev, [lado]: prev[lado].filter((_, i) => i !== idx) } : prev));
  };

  const adicionarPremio = (lado: "premiosAtual" | "premiosNovo") => {
    setDados((prev) => (prev ? { ...prev, [lado]: [...prev[lado], premioVazio()] } : prev));
  };

  const handleSalvar = async () => {
    if (!dados || !id) return;
    setSalvando(true);
    try {
      const htmlFinal = renderRevisitaHtml(dados, formato);
      await atualizar.mutateAsync({ id, clienteNome: dados.clienteNome, dados, html: htmlFinal });
      toast.success("Revisita atualizada.");
      navigate(`/revisitas/${id}`);
    } catch (err) {
      toast.error("Não foi possível salvar.", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="-m-4 min-h-[calc(100vh-3.5rem)] bg-[#F1F2F7] p-4 pb-28 md:-m-6 md:p-6 md:pb-28">
      <div className="mx-auto max-w-5xl">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Revisão Anual</p>
          <button type="button" onClick={() => navigate(`/revisitas/${id}`)} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
            Cancelar
          </button>
        </div>
        <h1 className="mb-6 text-2xl font-bold tracking-tight">Editar Revisita</h1>

        <datalist id="sugestoes-cobertura">
          {SUGESTOES_COBERTURA.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>

        <div className="flex flex-col gap-5">
          <Secao titulo="Dados do cliente">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Rotulo>Nome completo</Rotulo>
                <Input value={dados.clienteNome} onChange={(e) => atualizarCampo("clienteNome", e.target.value)} />
              </div>
              <div>
                <Rotulo>CPF</Rotulo>
                <Input placeholder="000.000.000-00" value={dados.cpf} onChange={(e) => atualizarCampo("cpf", e.target.value)} />
              </div>
              <div>
                <Rotulo>Data de nascimento</Rotulo>
                <Input placeholder="DD/MM/AAAA" value={dados.nascimento ?? ""} onChange={(e) => atualizarCampo("nascimento", e.target.value)} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Rotulo>Seguradora atual</Rotulo>
                <SeguradorasField value={dados.seguradoraAtual} onChange={(v) => atualizarCampo("seguradoraAtual", v)} />
              </div>
              <div>
                <Rotulo>Seguradoras novas (pode ser mais de uma)</Rotulo>
                <SeguradorasField value={dados.seguradoraNova} onChange={(v) => atualizarCampo("seguradoraNova", v)} rotuloAdicionar="Adicionar outra seguradora" />
              </div>
            </div>
          </Secao>

          <Secao titulo="Coberturas" acao={<span className="text-xs text-muted-foreground">{dados.coberturas.length} cobertura{dados.coberturas.length === 1 ? "" : "s"}</span>}>
            <div className="flex flex-col gap-4">
              {dados.coberturas.map((c, idx) => (
                <div key={idx} className="relative rounded-lg bg-muted/40 p-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2 size-7 shrink-0"
                    onClick={() => removerCobertura(idx)}
                    aria-label="Remover cobertura"
                  >
                    <X className="size-4" />
                  </Button>
                  <div className="mb-3 grid grid-cols-1 gap-3 pr-8 lg:grid-cols-3">
                    <div>
                      <Rotulo>Cobertura</Rotulo>
                      <Input
                        list="sugestoes-cobertura"
                        placeholder="Selecione ou digite a cobertura"
                        value={c.titulo}
                        onChange={(e) => atualizarCobertura(idx, { titulo: e.target.value })}
                        className="bg-white font-medium"
                      />
                    </div>
                    <div>
                      <Rotulo>Formatação atual</Rotulo>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                        value={seguradoraDaLinha(c.atualSeguradora, dados.seguradoraAtual)}
                        onChange={(e) => selecionarSeguradora(idx, "atual", e.target.value)}
                      >
                        <option value="">Escolher seguradora…</option>
                        {opcoesSeguradora(dados.seguradoraAtual, c.atualSeguradora).map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Rotulo>Nova formatação</Rotulo>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                        value={seguradoraDaLinha(c.novoSeguradora, dados.seguradoraNova)}
                        onChange={(e) => selecionarSeguradora(idx, "novo", e.target.value)}
                      >
                        <option value="">Escolher seguradora…</option>
                        {opcoesSeguradora(dados.seguradoraNova, c.novoSeguradora).map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      {!c.atualSemCobertura && (
                        <Textarea
                          placeholder="Detalhe da cobertura (opcional)"
                          rows={3}
                          value={c.atualDetalhes.join("\n")}
                          onChange={(e) => atualizarCobertura(idx, { atualDetalhes: e.target.value.split("\n").filter(Boolean) })}
                          className="bg-white"
                        />
                      )}
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="R$ 0,00"
                          disabled={!!c.atualSemCobertura}
                          value={c.atualValor}
                          onChange={(e) => atualizarCobertura(idx, { atualValor: e.target.value })}
                          className="bg-white"
                        />
                        <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                          <Checkbox checked={!!c.atualSemCobertura} onCheckedChange={(v) => atualizarCobertura(idx, { atualSemCobertura: !!v })} />
                          Sem cobertura
                        </label>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {!c.novoSemCobertura && (
                        <Textarea
                          placeholder="Detalhe da cobertura (opcional)"
                          rows={3}
                          value={c.novoDetalhes.join("\n")}
                          onChange={(e) => atualizarCobertura(idx, { novoDetalhes: e.target.value.split("\n").filter(Boolean) })}
                          className="bg-white"
                        />
                      )}
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="R$ 0,00"
                          disabled={!!c.novoSemCobertura}
                          value={c.novoValor}
                          onChange={(e) => atualizarCobertura(idx, { novoValor: e.target.value })}
                          className="bg-white"
                        />
                        <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                          <Checkbox checked={!!c.novoSemCobertura} onCheckedChange={(v) => atualizarCobertura(idx, { novoSemCobertura: !!v })} />
                          Sem cobertura
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="self-start" onClick={adicionarCobertura}>
                <Plus className="size-4" />
                Adicionar cobertura
              </Button>
            </div>
          </Secao>

          <Secao titulo="Resgate">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Rotulo>Formatação atual</Rotulo>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={temResgateAtual} onCheckedChange={(v) => alternarResgate("atual", !!v)} />
                  Resgate
                </label>
              </div>
              <div>
                <Rotulo>Nova formatação</Rotulo>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={temResgateNovo} onCheckedChange={(v) => alternarResgate("novo", !!v)} />
                  Resgate
                </label>
              </div>
            </div>
          </Secao>

          <Secao titulo="Prêmios e totais">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Rotulo>Formatação atual</Rotulo>
                {dados.premiosAtual.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <Input placeholder="Seguradora" value={p.seguradora} onChange={(e) => atualizarPremio("premiosAtual", idx, { seguradora: e.target.value })} />
                    <Input placeholder="R$ 0,00" value={p.valorTexto} onChange={(e) => atualizarPremio("premiosAtual", idx, { valorTexto: e.target.value })} />
                    <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => removerPremio("premiosAtual", idx)}>
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => adicionarPremio("premiosAtual")}>
                  <Plus className="size-4" />
                  Adicionar
                </Button>
                <div className="mt-2 flex items-center justify-between border-t pt-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Total</span>
                  <Input className="max-w-[160px] text-right font-semibold" value={dados.totalAtualTexto} onChange={(e) => atualizarCampo("totalAtualTexto", e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Rotulo>Nova formatação</Rotulo>
                {dados.premiosNovo.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <Input placeholder="Seguradora" value={p.seguradora} onChange={(e) => atualizarPremio("premiosNovo", idx, { seguradora: e.target.value })} />
                    <Input placeholder="R$ 0,00" value={p.valorTexto} onChange={(e) => atualizarPremio("premiosNovo", idx, { valorTexto: e.target.value })} />
                    <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => removerPremio("premiosNovo", idx)}>
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => adicionarPremio("premiosNovo")}>
                  <Plus className="size-4" />
                  Adicionar
                </Button>
                <div>
                  <Rotulo>Previdência (opcional)</Rotulo>
                  <Input placeholder="R$ 0,00" value={dados.previdenciaValorTexto ?? ""} onChange={(e) => atualizarCampo("previdenciaValorTexto", e.target.value || undefined)} />
                </div>
                <div className="mt-2 flex items-center justify-between border-t pt-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Total</span>
                  <Input className="max-w-[160px] text-right font-semibold" value={dados.totalNovoTexto} onChange={(e) => atualizarCampo("totalNovoTexto", e.target.value)} />
                </div>
              </div>
            </div>
          </Secao>

          <Secao titulo="Observações">
            <Textarea
              placeholder="Observações adicionais para o cliente (opcional)"
              rows={3}
              value={dados.observacoes ?? ""}
              onChange={(e) => atualizarCampo("observacoes", e.target.value || undefined)}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">Se vazio, esta seção não aparece no PDF.</p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Rotulo>Recomendação — título</Rotulo>
                <Input value={dados.recomendacaoHeadline ?? ""} onChange={(e) => atualizarCampo("recomendacaoHeadline", e.target.value || undefined)} />
              </div>
              <div>
                <Rotulo>Recomendação — texto</Rotulo>
                <Input value={dados.recomendacaoTexto ?? ""} onChange={(e) => atualizarCampo("recomendacaoTexto", e.target.value || undefined)} />
              </div>
            </div>
          </Secao>

          <Secao titulo="Apresentação da seguradora">
            <p className="-mt-2 mb-3 text-xs text-muted-foreground">Escolha a apresentação que entra no "Baixar PDF reunião", depois da apólice atual e antes da comparação.</p>
            <ApresentacaoSeletor value={dados.apresentacoes ?? []} onChange={(keys) => setDados((prev) => (prev ? { ...prev, apresentacoes: keys } : prev))} />
          </Secao>

          <Secao titulo="Formato do PDF">
            <p className="-mt-2 mb-4 text-xs text-muted-foreground">Escolha o design usado ao gerar o PDF e a pré-visualização deste comparativo.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {FORMATOS.map((f) => (
                <label
                  key={f.valor}
                  className={cn(
                    "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition-colors",
                    formato === f.valor ? "border-indigo-500 ring-1 ring-indigo-500" : "border-input"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="formato"
                      checked={formato === f.valor}
                      onChange={() => setFormato(f.valor)}
                      className="accent-indigo-600"
                    />
                    <span className="font-medium">{f.nome}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{f.desc}</span>
                </label>
              ))}
            </div>
          </Secao>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setPreviewAberto(true)}>
            <Eye className="size-4" />
            Pré-visualizar
          </Button>
          <BaixarPdfButton dados={dados} formato={formato} />
          <BaixarPdfReuniaoButton dados={dados} formato={formato} clienteId={data.cliente_id} />
          <Button onClick={handleSalvar} disabled={salvando} className="bg-indigo-600 hover:bg-indigo-700">
            {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar alterações
          </Button>
        </div>
      </div>

      <Dialog open={previewAberto} onOpenChange={setPreviewAberto}>
        <DialogContent className="h-[85vh] max-w-4xl p-0">
          <DialogTitle className="sr-only">Pré-visualização da revisita</DialogTitle>
          {html && <iframe title="Preview da revisita" srcDoc={html} className="h-full w-full rounded-lg border-0" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
