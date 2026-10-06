import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Download, Eye, Loader2, Plus, Save, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useClientes } from "@/hooks/useClientes";
import { useCriarRevisita } from "@/hooks/useRevisitas";
import { cn } from "@/lib/utils";
import { SEGURADORAS, SUGESTOES_COBERTURA } from "@/lib/revisita-opcoes";
import { buscarDetalhesCatalogo } from "@/lib/catalogo-revisita";
import { renderRevisitaHtml, type RevisitaCobertura, type RevisitaDados, type RevisitaFormato, type RevisitaPremioLinha } from "@/lib/revisita-template";

const FORMATOS: { valor: RevisitaFormato; nome: string; desc: string }[] = [
  { valor: "vanguarda", nome: "Vanguarda", desc: "Banner diagonal em destaque, com rodapé de contatos em ícones." },
  { valor: "essencial", nome: "Essencial", desc: "Cabeçalho enxuto e direto, visual limpo e objetivo." },
  { valor: "vitrine", nome: "Vitrine", desc: "Redesenho completo com bloco de recomendação em destaque." },
];

function formatarCpf(cpf: string): string {
  const digitos = cpf.replace(/\D/g, "");
  if (digitos.length !== 11) return cpf;
  return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatarDataBr(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split("-");
  if (!ano || !mes || !dia) return dataIso;
  return `${dia}/${mes}/${ano}`;
}

function fileParaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function mediaTypeDoArquivo(file: File): string {
  if (file.type === "image/png") return "image/png";
  if (file.type === "image/jpeg" || file.type === "image/jpg") return "image/jpeg";
  if (file.type === "image/webp") return "image/webp";
  return "application/pdf";
}

function hojeFormatado(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
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

function dadosVazio(): RevisitaDados {
  return {
    clienteNome: "",
    cpf: "",
    seguradoraAtual: "",
    seguradoraNova: "",
    coberturas: [coberturaVazia()],
    premiosAtual: [],
    premiosNovo: [],
    totalAtualTexto: "R$ 0,00",
    totalNovoTexto: "R$ 0,00",
  };
}

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

export function NovaRevisitaPage() {
  const navigate = useNavigate();
  const { data: clientes } = useClientes();
  const criar = useCriarRevisita();

  const [clientePopoverOpen, setClientePopoverOpen] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [clienteNomeLivre, setClienteNomeLivre] = useState("");
  const clienteSelecionado = clientes?.find((c) => c.id === clienteId);
  const clienteNome = clienteSelecionado?.nome_completo ?? clienteNomeLivre.trim();

  const [dados, setDados] = useState<RevisitaDados>(dadosVazio);
  const [formato, setFormato] = useState<RevisitaFormato>("vitrine");
  const [previewAberto, setPreviewAberto] = useState(false);

  const [importAberto, setImportAberto] = useState(false);
  const [apolicePdfs, setApolicePdfs] = useState<(File | null)[]>([null]);
  const [propostasPdfs, setPropostasPdfs] = useState<(File | null)[]>([null]);
  const [apresentacaoPdfs, setApresentacaoPdfs] = useState<(File | null)[]>([null]);
  const [temResgateImport, setTemResgateImport] = useState(false);
  const [tabelaResgatePdf, setTabelaResgatePdf] = useState<File | null>(null);
  const [previdenciaPdf, setPrevidenciaPdf] = useState<File | null>(null);
  const [instrucoesExtras, setInstrucoesExtras] = useState("");
  const [importando, setImportando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setDados((prev) => (prev.clienteNome === clienteNome ? prev : { ...prev, clienteNome }));
  }, [clienteNome]);

  const html = useMemo(() => {
    try {
      return renderRevisitaHtml(dados, formato);
    } catch {
      return null;
    }
  }, [dados, formato]);

  const atualizarCampo = <K extends keyof RevisitaDados>(campo: K, valor: RevisitaDados[K]) => {
    setDados((prev) => ({ ...prev, [campo]: valor }));
  };

  const atualizarCobertura = (idx: number, patch: Partial<RevisitaCobertura>) => {
    setDados((prev) => ({ ...prev, coberturas: prev.coberturas.map((c, i) => (i === idx ? { ...c, ...patch } : c)) }));
  };

  const selecionarSeguradora = (idx: number, lado: "atual" | "novo", seguradora: string) => {
    const cobertura = dados.coberturas[idx];
    const sugeridos = buscarDetalhesCatalogo(seguradora, cobertura.titulo);
    if (!sugeridos) return;
    if (lado === "atual") atualizarCobertura(idx, { atualDetalhes: sugeridos });
    else atualizarCobertura(idx, { novoDetalhes: sugeridos });
  };

  const removerCobertura = (idx: number) => {
    setDados((prev) => ({ ...prev, coberturas: prev.coberturas.filter((_, i) => i !== idx) }));
  };

  const adicionarCobertura = () => {
    setDados((prev) => ({ ...prev, coberturas: [...prev.coberturas, coberturaVazia()] }));
  };

  const linhaResgate = dados.coberturas.find((c) => ehLinhaResgate(c.titulo)) ?? null;
  const temResgateAtual = !!linhaResgate && !linhaResgate.atualSemCobertura;
  const temResgateNovo = !!linhaResgate && !linhaResgate.novoSemCobertura;

  const alternarResgate = (lado: "atual" | "novo", marcado: boolean) => {
    setDados((prev) => {
      let coberturas = [...prev.coberturas];
      let idx = coberturas.findIndex((c) => ehLinhaResgate(c.titulo));
      if (idx < 0) {
        coberturas.push({ titulo: "Resgate", atualValor: "", atualDetalhes: [], atualSemCobertura: true, novoValor: "", novoDetalhes: [], novoSemCobertura: true });
        idx = coberturas.length - 1;
      }
      const campo = lado === "atual" ? "atualSemCobertura" : "novoSemCobertura";
      coberturas[idx] = { ...coberturas[idx], [campo]: !marcado };
      const linha = coberturas[idx];
      if (linha.atualSemCobertura && linha.novoSemCobertura) coberturas = coberturas.filter((_, i) => i !== idx);
      return { ...prev, coberturas };
    });
  };

  const atualizarPremio = (lado: "premiosAtual" | "premiosNovo", idx: number, patch: Partial<RevisitaPremioLinha>) => {
    setDados((prev) => ({ ...prev, [lado]: prev[lado].map((p, i) => (i === idx ? { ...p, ...patch } : p)) }));
  };

  const removerPremio = (lado: "premiosAtual" | "premiosNovo", idx: number) => {
    setDados((prev) => ({ ...prev, [lado]: prev[lado].filter((_, i) => i !== idx) }));
  };

  const adicionarPremio = (lado: "premiosAtual" | "premiosNovo") => {
    setDados((prev) => ({ ...prev, [lado]: [...prev[lado], premioVazio()] }));
  };

  const apolicesValidas = apolicePdfs.filter((f): f is File => !!f);
  const propostasValidas = propostasPdfs.filter((f): f is File => !!f);
  const apresentacoesValidas = apresentacaoPdfs.filter((f): f is File => !!f);
  const podeImportar = !!clienteNome && apolicesValidas.length > 0 && propostasValidas.length > 0 && !importando;

  const handleImportarIA = async () => {
    if (!podeImportar) return;
    setImportando(true);
    try {
      const apolicePdfsBase64 = await Promise.all(apolicesValidas.map(fileParaBase64));
      const propostasPdfBase64 = await Promise.all(propostasValidas.map(fileParaBase64));
      const tabelaResgateBase64 = tabelaResgatePdf ? await fileParaBase64(tabelaResgatePdf) : undefined;
      const tabelaResgateMediaType = tabelaResgatePdf ? mediaTypeDoArquivo(tabelaResgatePdf) : undefined;
      const previdenciaPdfBase64 = previdenciaPdf ? await fileParaBase64(previdenciaPdf) : undefined;
      const res = await fetch("/api/gerar-revisita", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clienteNome,
          apolicePdfsBase64,
          propostasPdfBase64,
          temResgate: temResgateImport,
          tabelaResgateBase64,
          tabelaResgateMediaType,
          previdenciaPdfBase64,
          instrucoesExtras: instrucoesExtras.trim() || undefined,
          dataPreparo: hojeFormatado(),
          formato,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao gerar a revisita.");
      setDados(json.dados);
      if (json.formato) setFormato(json.formato);
      setImportAberto(false);
      toast.success("Comparativo importado — revise os campos abaixo antes de salvar.");
    } catch (err) {
      toast.error("Não foi possível importar.", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setImportando(false);
    }
  };

  const handleBaixarPdf = async () => {
    setBaixando(true);
    try {
      const { baixarRevisitaPdf } = await import("@/lib/revisita-pdf");
      await baixarRevisitaPdf({
        apolices: apolicesValidas,
        tabelaResgate: temResgateImport ? tabelaResgatePdf : null,
        apresentacoes: apresentacoesValidas,
        dados: { ...dados, clienteNome },
        formato,
      });
    } catch (err) {
      toast.error("Não foi possível gerar o PDF.", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBaixando(false);
    }
  };

  const handleSalvar = async () => {
    if (!clienteNome) {
      toast.error("Selecione ou digite o nome do cliente.");
      return;
    }
    setSalvando(true);
    try {
      await criar.mutateAsync({
        clienteId: clienteId || null,
        clienteNome,
        dados: { ...dados, clienteNome },
        html: html ?? renderRevisitaHtml({ ...dados, clienteNome }, formato),
        instrucoesExtras: instrucoesExtras.trim() || null,
      });
      toast.success("Revisita salva na biblioteca.");
      navigate("/revisitas");
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
          <button type="button" onClick={() => navigate("/revisitas")} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
            Cancelar
          </button>
        </div>
        <h1 className="mb-6 text-2xl font-bold tracking-tight">Nova Revisita</h1>

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
                <Popover open={clientePopoverOpen} onOpenChange={setClientePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      <span className="truncate">{clienteSelecionado ? clienteSelecionado.nome_completo : clienteNomeLivre || "Selecionar ou digitar..."}</span>
                      <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Buscar cliente ou digitar nome novo..."
                        value={clienteNomeLivre}
                        onValueChange={(v) => {
                          setClienteNomeLivre(v);
                          setClienteId("");
                        }}
                      />
                      <CommandList>
                        <CommandEmpty>Nenhum cliente encontrado — usar "{clienteNomeLivre}" como nome livre.</CommandEmpty>
                        <CommandGroup>
                          {(clientes ?? []).map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.nome_completo}
                              onSelect={() => {
                                setClienteId(c.id);
                                setClienteNomeLivre(c.nome_completo);
                                setClientePopoverOpen(false);
                                if (c.cpf) atualizarCampo("cpf", formatarCpf(c.cpf));
                                if (c.data_nascimento) atualizarCampo("nascimento", formatarDataBr(c.data_nascimento));
                              }}
                            >
                              <Check className={cn("mr-2 size-4", clienteId === c.id ? "opacity-100" : "opacity-0")} />
                              {c.nome_completo}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Rotulo>CPF</Rotulo>
                <Input placeholder="000.000.000-00" value={dados.cpf} onChange={(e) => atualizarCampo("cpf", e.target.value)} />
              </div>
              <div>
                <Rotulo>Data de nascimento</Rotulo>
                <Input placeholder="DD/MM/AAAA" value={dados.nascimento ?? ""} onChange={(e) => atualizarCampo("nascimento", e.target.value)} />
              </div>
              <div>
                <Rotulo>Seguradora atual / nova</Rotulo>
                <div className="flex gap-2">
                  <Input placeholder="Atual" value={dados.seguradoraAtual} onChange={(e) => atualizarCampo("seguradoraAtual", e.target.value)} />
                  <Input placeholder="Nova" value={dados.seguradoraNova} onChange={(e) => atualizarCampo("seguradoraNova", e.target.value)} />
                </div>
              </div>
            </div>
          </Secao>

          <Secao
            titulo="Coberturas"
            acao={
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => setImportAberto((v) => !v)}>
                  <Sparkles className="size-3.5" />
                  Importar apólice (PDF)
                </Button>
                <span className="text-xs text-muted-foreground">
                  {dados.coberturas.length} cobertura{dados.coberturas.length === 1 ? "" : "s"}
                </span>
              </div>
            }
          >
            {importAberto && (
              <div className="mb-5 flex flex-col gap-3 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/40 p-4">
                <p className="text-xs text-muted-foreground">
                  Envie a apólice atual e a(s) proposta(s) nova(s) — a IA lê os PDFs e preenche as coberturas abaixo automaticamente. Revise tudo antes de salvar.
                </p>
                <div>
                  <Rotulo>Apólice atual (PDF)</Rotulo>
                  <div className="flex flex-col gap-2">
                    {apolicePdfs.map((_, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="application/pdf"
                          className="bg-white"
                          onChange={(e) => {
                            const arq = e.target.files?.[0] ?? null;
                            setApolicePdfs((prev) => prev.map((p, idx) => (idx === i ? arq : p)));
                          }}
                        />
                        {apolicePdfs.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => setApolicePdfs((prev) => prev.filter((_, idx) => idx !== i))}>
                            <X className="size-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setApolicePdfs((prev) => [...prev, null])}>
                      <Plus className="size-4" />
                      Adicionar outro arquivo
                    </Button>
                  </div>
                </div>
                <div>
                  <Rotulo>Proposta(s) da seguradora nova (PDF)</Rotulo>
                  <div className="flex flex-col gap-2">
                    {propostasPdfs.map((_, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="application/pdf"
                          className="bg-white"
                          onChange={(e) => {
                            const arq = e.target.files?.[0] ?? null;
                            setPropostasPdfs((prev) => prev.map((p, idx) => (idx === i ? arq : p)));
                          }}
                        />
                        {propostasPdfs.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => setPropostasPdfs((prev) => prev.filter((_, idx) => idx !== i))}>
                            <X className="size-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setPropostasPdfs((prev) => [...prev, null])}>
                      <Plus className="size-4" />
                      Adicionar outra seguradora
                    </Button>
                  </div>
                </div>
                <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                  <Checkbox checked={temResgateImport} onCheckedChange={(v) => setTemResgateImport(!!v)} className="mt-0.5" />
                  <span>
                    <span className="font-medium">Produto atual é resgatável — substituir por previdência</span>
                    <p className="mt-0.5 text-xs text-muted-foreground">Inclui a tabela de evolução/resgate e a proposta de previdência na leitura.</p>
                  </span>
                </label>
                {temResgateImport && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Rotulo>Tabela de evolução/resgate (PDF ou imagem)</Rotulo>
                      <Input
                        type="file"
                        accept="application/pdf,image/png,image/jpeg,image/webp"
                        className="bg-white"
                        onChange={(e) => setTabelaResgatePdf(e.target.files?.[0] ?? null)}
                      />
                    </div>
                    <div>
                      <Rotulo>Proposta de previdência (PDF)</Rotulo>
                      <Input type="file" accept="application/pdf" className="bg-white" onChange={(e) => setPrevidenciaPdf(e.target.files?.[0] ?? null)} />
                    </div>
                  </div>
                )}
                <div>
                  <Rotulo>Instruções extras (opcional)</Rotulo>
                  <Textarea
                    rows={2}
                    className="bg-white"
                    placeholder='Ex.: "A cliente não quer capital de morte porque o cônjuge é o pilar financeiro."'
                    value={instrucoesExtras}
                    onChange={(e) => setInstrucoesExtras(e.target.value)}
                  />
                </div>
                <Button type="button" onClick={handleImportarIA} disabled={!podeImportar} className="self-start bg-indigo-600 hover:bg-indigo-700">
                  {importando ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  {importando ? "Lendo os PDFs..." : "Gerar com IA"}
                </Button>
              </div>
            )}

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
                        value={dados.seguradoraAtual}
                        onChange={(e) => {
                          atualizarCampo("seguradoraAtual", e.target.value);
                          selecionarSeguradora(idx, "atual", e.target.value);
                        }}
                      >
                        <option value="">Selecione a seguradora</option>
                        {SEGURADORAS.map((s) => (
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
                        value={dados.seguradoraNova}
                        onChange={(e) => {
                          atualizarCampo("seguradoraNova", e.target.value);
                          selecionarSeguradora(idx, "novo", e.target.value);
                        }}
                      >
                        <option value="">Selecione a seguradora</option>
                        {SEGURADORAS.map((s) => (
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

          <Secao titulo="Apresentação da seguradora">
            <p className="-mt-2 mb-4 text-xs text-muted-foreground">
              Opcional — o PDF enviado entra no arquivo final depois da tabela de resgate e antes do Comparative Board. Não fica salvo no sistema: vale só pro "Baixar PDF".
            </p>
            <div className="flex flex-col gap-2">
              {apresentacaoPdfs.map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const arq = e.target.files?.[0] ?? null;
                      setApresentacaoPdfs((prev) => prev.map((p, idx) => (idx === i ? arq : p)));
                    }}
                  />
                  {apresentacaoPdfs.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => setApresentacaoPdfs((prev) => prev.filter((_, idx) => idx !== i))}>
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setApresentacaoPdfs((prev) => [...prev, null])}>
                <Plus className="size-4" />
                Adicionar outra apresentação
              </Button>
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
                    <input type="radio" name="formato" checked={formato === f.valor} onChange={() => setFormato(f.valor)} className="accent-indigo-600" />
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
          <Button type="button" variant="outline" onClick={handleBaixarPdf} disabled={baixando}>
            {baixando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Baixar PDF
          </Button>
          <Button onClick={handleSalvar} disabled={salvando} className="bg-indigo-600 hover:bg-indigo-700">
            {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar na biblioteca
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
