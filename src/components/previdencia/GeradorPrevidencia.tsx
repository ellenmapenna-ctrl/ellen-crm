import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Download, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Field } from "@/components/shared/Field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useClientes } from "@/hooks/useClientes";
import { usePrevidenciaEstudoInfo, useSalvarPrevidenciaEstudo } from "@/hooks/usePrevidenciaEstudo";
import { blobParaBase64 } from "@/lib/base64";
import { cn } from "@/lib/utils";
import { gerarEstudoPrevidencia, type PrazoPensao, type ProdutoPrevidencia, type Sexo } from "@/lib/previdencia-calc";
import { renderPrevidenciaHtml } from "@/lib/previdencia-template";
import type { PrevidenciaInput, PrevidenciaResultado } from "@/lib/previdencia-calc";

const PRODUTOS: ProdutoPrevidencia[] = ["Unique Prev", "Atitude", "Atitude + Simples"];
const PRAZOS_PENSAO: PrazoPensao[] = [1, 5, 10, 15, 20];

function parseNumero(v: string): number {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Idade completa a partir de uma data "YYYY-MM-DD" (como vem do Postgres). */
function calcularIdade(dataNascimentoIso: string): number | null {
  const data = new Date(dataNascimentoIso);
  if (Number.isNaN(data.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - data.getFullYear();
  const aindaNaoFezAniversario = hoje.getMonth() < data.getMonth() || (hoje.getMonth() === data.getMonth() && hoje.getDate() < data.getDate());
  if (aindaNaoFezAniversario) idade--;
  return idade;
}

interface Props {
  /** Cliente já definido (ex.: o da revisita): o nome fica fixo e o estudo é guardado nele. */
  clienteIdInicial?: string;
  nomeInicial?: string;
  /** Dentro de outra tela (a revisita): sem título e sem margens da página. */
  embutido?: boolean;
  /** Chamado depois que o PDF foi gerado (e guardado no cliente, quando há um). */
  aoGerar?: (info: { input: PrevidenciaInput; resultado: PrevidenciaResultado; clienteId: string }) => void;
  /** Quando informado, aparece o botão "Aplicar na revisita": usa o estudo atual sem precisar baixar o PDF. */
  aoAplicar?: (info: { input: PrevidenciaInput; resultado: PrevidenciaResultado; clienteId: string }) => void;
}

/** Gerador de estudo de previdência (Icatu): usado na aba Previdência e dentro da revisita. */
export function GeradorPrevidencia({ clienteIdInicial, nomeInicial, embutido = false, aoGerar, aoAplicar }: Props) {
  const { data: clientes } = useClientes();

  const [clientePopoverOpen, setClientePopoverOpen] = useState(false);
  const [clienteId, setClienteId] = useState(clienteIdInicial ?? "");
  const [clienteNomeLivre, setClienteNomeLivre] = useState(nomeInicial ?? "");
  const [cidade, setCidade] = useState("");
  const [produto, setProduto] = useState<ProdutoPrevidencia>("Unique Prev");
  const [idadeAtual, setIdadeAtual] = useState("40");
  const [idadeAposentadoria, setIdadeAposentadoria] = useState("60");
  const [sexo, setSexo] = useState<Sexo>("F");
  const [contribuicaoMensal, setContribuicaoMensal] = useState("100");
  const [aporteInicial, setAporteInicial] = useState("0");
  const [rentabilidadeAnual, setRentabilidadeAnual] = useState("5");

  const [temCoberturas, setTemCoberturas] = useState(false);
  const [rendaInvalidezValor, setRendaInvalidezValor] = useState("");
  const [peculioMorteValor, setPeculioMorteValor] = useState("");
  const [pensaoValor, setPensaoValor] = useState("");
  const [pensaoPrazo, setPensaoPrazo] = useState<PrazoPensao>(15);

  const [baixando, setBaixando] = useState(false);

  const clienteSelecionado = clientes?.find((c) => c.id === clienteId);
  const clienteFixo = !!clienteIdInicial;

  useEffect(() => {
    if (clienteIdInicial) setClienteId(clienteIdInicial);
    else if (nomeInicial !== undefined && !clienteId) setClienteNomeLivre(nomeInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteIdInicial, nomeInicial]);

  // Cliente definido de fora: traz idade e sexo do cadastro (igual ao escolher o cliente na lista).
  useEffect(() => {
    if (!clienteFixo || !clienteSelecionado) return;
    if (clienteSelecionado.data_nascimento) {
      const idade = calcularIdade(clienteSelecionado.data_nascimento);
      if (idade !== null) setIdadeAtual(String(idade));
    }
    if (clienteSelecionado.sexo === "masculino") setSexo("M");
    else if (clienteSelecionado.sexo === "feminino") setSexo("F");
  }, [clienteFixo, clienteSelecionado?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const clienteNome = clienteSelecionado?.nome_completo ?? clienteNomeLivre.trim();
  const { data: estudoSalvo } = usePrevidenciaEstudoInfo(clienteId || undefined);
  const salvarEstudo = useSalvarPrevidenciaEstudo();

  const input = useMemo(
    () => ({
      nomeCliente: clienteNome || "Cliente",
      cidade: cidade.trim() || undefined,
      produto,
      idadeAtual: parseNumero(idadeAtual),
      idadeAposentadoria: parseNumero(idadeAposentadoria),
      sexo,
      contribuicaoMensal: parseNumero(contribuicaoMensal),
      aporteInicial: parseNumero(aporteInicial),
      rentabilidadeAnual: parseNumero(rentabilidadeAnual) / 100,
      rendaInvalidezValor: temCoberturas && rendaInvalidezValor ? parseNumero(rendaInvalidezValor) : undefined,
      peculioMorteValor: temCoberturas && peculioMorteValor ? parseNumero(peculioMorteValor) : undefined,
      pensaoPrazoCertoValor: temCoberturas && pensaoValor ? parseNumero(pensaoValor) : undefined,
      pensaoPrazoCertoAnos: temCoberturas && pensaoValor ? pensaoPrazo : undefined,
    }),
    [
      clienteNome,
      cidade,
      produto,
      idadeAtual,
      idadeAposentadoria,
      sexo,
      contribuicaoMensal,
      aporteInicial,
      rentabilidadeAnual,
      temCoberturas,
      rendaInvalidezValor,
      peculioMorteValor,
      pensaoValor,
      pensaoPrazo,
    ]
  );

  const valido = !!clienteNome && input.idadeAtual > 0 && input.idadeAposentadoria > input.idadeAtual && input.contribuicaoMensal >= 0;

  const html = useMemo(() => {
    if (!valido) return null;
    try {
      const resultado = gerarEstudoPrevidencia(input);
      return renderPrevidenciaHtml(input, resultado);
    } catch {
      return null;
    }
  }, [input, valido]);

  const handleBaixarPdf = async () => {
    if (!html) return;
    setBaixando(true);
    try {
      const res = await fetch("/api/baixar-previdencia-pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "Erro ao gerar o PDF.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Estudo_Previdencia_${clienteNome.replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      if (clienteId) {
        try {
          await salvarEstudo.mutateAsync({ clienteId, pdfBase64: await blobParaBase64(blob), dados: input });
          toast.success("PDF baixado e guardado no cliente.", { description: "A Revisão Anual vai usar este estudo automaticamente." });
        } catch (err) {
          toast.warning("O PDF baixou, mas não foi possível guardá-lo no cliente.", { description: err instanceof Error ? err.message : String(err) });
        }
      } else {
        toast.info("PDF baixado. Para guardá-lo no cliente, selecione um cliente da carteira na lista.");
      }
      aoGerar?.({ input, resultado: gerarEstudoPrevidencia(input), clienteId });
    } catch (err) {
      toast.error("Não foi possível gerar o PDF.", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBaixando(false);
    }
  };

  return (
    <div className={cn("grid gap-4 lg:grid-cols-[380px_1fr]", !embutido && "mx-auto max-w-6xl")}>
      <div className="flex flex-col gap-4">
        {!embutido && <PageHeader title="Gerador de Previdência" description="Estudo de previdência individual (Icatu) — preencha e baixe o PDF." />}

        <Card className="flex flex-col gap-4 p-5">
          {clienteFixo ? (
            <Field label="Cliente">
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">{clienteNome || "—"}</p>
            </Field>
          ) : (
          <Field label="Cliente *" htmlFor="cliente">
            <Popover open={clientePopoverOpen} onOpenChange={setClientePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {clienteSelecionado ? clienteSelecionado.nome_completo : clienteNomeLivre || "Selecionar ou digitar nome..."}
                  <ChevronsUpDown className="size-4 opacity-50" />
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
                            if (c.data_nascimento) {
                              const idade = calcularIdade(c.data_nascimento);
                              if (idade !== null) setIdadeAtual(String(idade));
                            }
                            if (c.sexo === "masculino") setSexo("M");
                            else if (c.sexo === "feminino") setSexo("F");
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
          </Field>
          )}

          <Field label="Cidade (opcional)" htmlFor="cidade">
            <Input id="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: São Paulo" />
          </Field>

          <Field label="Produto" htmlFor="produto">
            <Select value={produto} onValueChange={(v) => setProduto(v as ProdutoPrevidencia)}>
              <SelectTrigger id="produto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUTOS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Idade Atual *" htmlFor="idade-atual">
              <Input id="idade-atual" type="number" value={idadeAtual} onChange={(e) => setIdadeAtual(e.target.value)} />
            </Field>
            <Field label="Idade de Aposentadoria *" htmlFor="idade-aposent">
              <Input id="idade-aposent" type="number" value={idadeAposentadoria} onChange={(e) => setIdadeAposentadoria(e.target.value)} />
            </Field>
          </div>

          <Field label="Sexo" htmlFor="sexo">
            <Select value={sexo} onValueChange={(v) => setSexo(v as Sexo)}>
              <SelectTrigger id="sexo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="F">Feminino</SelectItem>
                <SelectItem value="M">Masculino</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Contribuição Mensal (R$) *" htmlFor="contrib">
              <Input id="contrib" type="number" value={contribuicaoMensal} onChange={(e) => setContribuicaoMensal(e.target.value)} />
            </Field>
            <Field label="Aporte Inicial (R$)" htmlFor="aporte">
              <Input id="aporte" type="number" value={aporteInicial} onChange={(e) => setAporteInicial(e.target.value)} />
            </Field>
          </div>

          <Field label="Rentabilidade Real Estimada (% a.a.)" htmlFor="rentab">
            <Input id="rentab" type="number" step="0.1" value={rentabilidadeAnual} onChange={(e) => setRentabilidadeAnual(e.target.value)} />
          </Field>

          <div className="rounded-lg border p-4">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <Checkbox checked={temCoberturas} onCheckedChange={(v) => setTemCoberturas(!!v)} className="mt-0.5" />
              <span>
                <span className="font-medium">Incluir Coberturas de Proteção Familiar</span>
                <p className="mt-0.5 text-xs text-muted-foreground">Renda por invalidez, pecúlio por morte e/ou pensão por prazo certo.</p>
              </span>
            </label>
            {temCoberturas && (
              <div className="mt-4 flex flex-col gap-3">
                <Field label="Renda por Invalidez — valor mensal (R$)" htmlFor="renda-inv">
                  <Input id="renda-inv" type="number" value={rendaInvalidezValor} onChange={(e) => setRendaInvalidezValor(e.target.value)} />
                </Field>
                <Field label="Pecúlio por Morte — valor (R$)" htmlFor="pec-morte">
                  <Input id="pec-morte" type="number" value={peculioMorteValor} onChange={(e) => setPeculioMorteValor(e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Pensão por Prazo Certo — valor mensal (R$)" htmlFor="pensao-valor">
                    <Input id="pensao-valor" type="number" value={pensaoValor} onChange={(e) => setPensaoValor(e.target.value)} />
                  </Field>
                  <Field label="Prazo (anos)" htmlFor="pensao-prazo">
                    <Select value={String(pensaoPrazo)} onValueChange={(v) => setPensaoPrazo(Number(v) as PrazoPensao)}>
                      <SelectTrigger id="pensao-prazo">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRAZOS_PENSAO.map((p) => (
                          <SelectItem key={p} value={String(p)}>
                            {p} anos
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </div>
            )}
          </div>

          {estudoSalvo?.updated_at && (
            <p className="text-xs text-muted-foreground">
              Este cliente já tem um estudo guardado, de {new Date(estudoSalvo.updated_at).toLocaleDateString("pt-BR")}. Ao baixar um novo, ele substitui o anterior.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleBaixarPdf} disabled={!valido || baixando} variant={aoAplicar ? "outline" : "default"}>
              {baixando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {baixando ? "Montando o PDF..." : "Baixar PDF"}
            </Button>
            {aoAplicar && (
              <Button
                type="button"
                disabled={!valido}
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={() => aoAplicar({ input, resultado: gerarEstudoPrevidencia(input), clienteId })}
              >
                Aplicar na revisita
              </Button>
            )}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        {html ? (
          <iframe title="Preview do estudo de previdência" srcDoc={html} className={cn("w-full border-0", embutido ? "h-[620px]" : "h-[calc(100vh-140px)]")} />
        ) : (
          <div className={cn("flex items-center justify-center p-8 text-center text-sm text-muted-foreground", embutido ? "h-[320px]" : "h-[calc(100vh-140px)]")}>
            Preencha cliente, idade atual, idade de aposentadoria e contribuição mensal pra ver o preview.
          </div>
        )}
      </Card>
    </div>
  );
}
