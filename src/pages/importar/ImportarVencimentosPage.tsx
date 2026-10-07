import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { parseArquivo } from "@/lib/csv";
import { formatarData } from "@/lib/format";
import { qk } from "@/lib/query-keys";
import {
  detectarColunasVencimento,
  planejarVencimentos,
  situacaoVencimento,
  type ApoliceVencimentoDb,
  type PlanoVencimentos,
} from "@/lib/vencimentos";

const PAGINA = 1000;
const LOTE = 20;
const LINHAS_PREVIA = 40;

async function buscarApolices(): Promise<ApoliceVencimentoDb[]> {
  const todas: ApoliceVencimentoDb[] = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await supabase
      .from("apolices")
      .select("id, numero_apolice, status, proximo_vencimento_premio")
      .order("id")
      .range(inicio, inicio + PAGINA - 1);
    if (error) throw error;
    todas.push(...((data ?? []) as ApoliceVencimentoDb[]));
    if (!data || data.length < PAGINA) break;
  }
  return todas;
}

function Resumo({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <Card className={destaque ? "border-primary/40 p-3" : "p-3"}>
      <p className="text-2xl font-semibold tabular-nums">{valor}</p>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
    </Card>
  );
}

export function ImportarVencimentosPage() {
  const qc = useQueryClient();
  const [lendo, setLendo] = useState(false);
  const [plano, setPlano] = useState<PlanoVencimentos | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [limpar, setLimpar] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [colunasFaltando, setColunasFaltando] = useState(false);
  const [resultado, setResultado] = useState<{ gravadas: number; limpas: number; erros: string[] } | null>(null);

  const total = plano ? plano.atualizacoes.length + (limpar ? plano.paraLimpar.length : 0) : 0;

  const handleArquivo = async (file: File | null | undefined) => {
    if (!file) return;
    setLendo(true);
    setPlano(null);
    setResultado(null);
    setColunasFaltando(false);
    try {
      const csv = await parseArquivo(file);
      const { colunas, faltando } = detectarColunasVencimento(csv.colunas);
      if (!colunas) {
        toast.error("Esta planilha não parece ser o relatório “Próximos a vencer”.", { description: `Colunas não encontradas: ${faltando.join(", ")}.` });
        return;
      }
      let apolices: ApoliceVencimentoDb[];
      try {
        apolices = await buscarApolices();
      } catch {
        setColunasFaltando(true);
        return;
      }
      setPlano(planejarVencimentos(csv.linhas, colunas, apolices));
      setNomeArquivo(file.name);
    } catch (err) {
      toast.error("Não foi possível ler a planilha.", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setLendo(false);
    }
  };

  const aplicar = async () => {
    if (!plano || total === 0) return;
    setAplicando(true);
    setProgresso(0);
    const erros: string[] = [];
    let gravadas = 0;
    let limpas = 0;
    const agora = new Date().toISOString();

    for (let i = 0; i < plano.atualizacoes.length; i += LOTE) {
      await Promise.all(
        plano.atualizacoes.slice(i, i + LOTE).map(async (a) => {
          const { data, error } = await supabase
            .from("apolices")
            .update({
              proximo_vencimento_premio: a.vencimento,
              forma_pagamento: a.forma,
              responsavel_pagamento: a.responsavel,
              vencimento_premio_atualizado_em: agora,
            })
            .eq("id", a.apoliceId)
            .select("id");
          if (error || !data || data.length === 0) erros.push(`Apólice ${a.numero}: ${error?.message ?? "nenhuma linha atualizada"}`);
          else gravadas++;
        }),
      );
      setProgresso(Math.min(i + LOTE, plano.atualizacoes.length));
    }

    if (limpar) {
      for (let i = 0; i < plano.paraLimpar.length; i += LOTE) {
        await Promise.all(
          plano.paraLimpar.slice(i, i + LOTE).map(async (a) => {
            const { error } = await supabase
              .from("apolices")
              .update({ proximo_vencimento_premio: null, vencimento_premio_atualizado_em: agora })
              .eq("id", a.apoliceId);
            if (error) erros.push(`Apólice ${a.numero}: ${error.message}`);
            else limpas++;
          }),
        );
      }
    }

    qc.invalidateQueries({ queryKey: qk.clientes.all });
    setResultado({ gravadas, limpas, erros });
    setPlano(null);
    setAplicando(false);
  };

  const amostra = plano ? [...plano.atualizacoes].sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, LINHAS_PREVIA) : [];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Importar vencimentos"
        description="Grava o próximo vencimento do prêmio de cada apólice a partir do relatório “Próximos a vencer” da Prudential. Só altera os campos de vencimento: nada é criado nem apagado."
      >
        <Button variant="outline" asChild>
          <Link to="/importar">
            <ArrowLeft className="size-4" />
            Voltar para Importar
          </Link>
        </Button>
      </PageHeader>

      {resultado && (
        <Card className="mb-4 flex flex-col gap-2 border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="size-5" />
            Vencimento gravado em {resultado.gravadas} apólices
            {resultado.limpas > 0 ? ` e limpo em ${resultado.limpas} que não constam no arquivo` : ""}.
          </p>
          <p className="text-sm">
            Veja na lista de <Link to="/clientes" className="underline">Clientes</Link>, coluna “Próx. vencimento”.
          </p>
          {resultado.erros.length > 0 && (
            <div className="text-sm text-destructive">
              <p className="font-medium">{resultado.erros.length} não puderam ser atualizadas:</p>
              <ul className="mt-1 list-disc pl-5">
                {resultado.erros.slice(0, 10).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {colunasFaltando && (
        <Card className="mb-4 flex gap-3 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <p>
            O banco ainda não tem os campos de vencimento. Rode o SQL <code className="rounded bg-white px-1">migration_20261007_vencimento_premio.sql</code> no Supabase (SQL Editor) e tente de novo.
          </p>
        </Card>
      )}

      <Card className="mb-4 flex flex-col gap-3 p-5">
        <p className="flex items-center gap-2 text-sm font-medium">
          <CalendarClock className="size-4" />
          1. Envie o relatório “Próximos a vencer” (.xls, .xlsx ou .csv)
        </p>
        <Input type="file" accept=".csv,.xls,.xlsx,.xlsm" disabled={lendo || aplicando} onChange={(e) => handleArquivo(e.target.files?.[0])} />
        {lendo && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Lendo a planilha e comparando com o banco...
          </p>
        )}
      </Card>

      {plano && (
        <>
          <Card className="mb-4 flex flex-col gap-4 p-5">
            <p className="text-sm font-medium">2. Confira o que vai ser gravado ({nomeArquivo})</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Resumo rotulo="apólices terão o vencimento gravado" valor={plano.atualizacoes.length} destaque />
              <Resumo rotulo="do arquivo não encontradas no sistema" valor={plano.apolicesNaoEncontradas.length} />
              <Resumo rotulo="linhas com data inválida" valor={plano.dataInvalida.length} />
              <Resumo rotulo="apólices ativas que não constam no arquivo" valor={plano.ativasForaDoArquivo} />
            </div>

            {plano.paraLimpar.length > 0 && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm">
                <Checkbox checked={limpar} onCheckedChange={(v) => setLimpar(!!v)} className="mt-0.5" />
                <span>
                  <span className="font-medium">Limpar o vencimento de {plano.paraLimpar.length} apólices que não constam neste arquivo</span>
                  <p className="mt-0.5 text-xs text-muted-foreground">Evita ficar com uma data antiga de uma importação anterior. Elas passam a aparecer sem vencimento informado.</p>
                </span>
              </label>
            )}

            {amostra.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Vencimento</th>
                      <th className="px-3 py-2">Segurado</th>
                      <th className="px-3 py-2">Apólice</th>
                      <th className="px-3 py-2">Forma de pagamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {amostra.map((a) => {
                      const s = situacaoVencimento(a.vencimento);
                      return (
                        <tr key={a.apoliceId} className="border-t">
                          <td className="px-3 py-1.5">
                            <span className="font-mono text-xs">{formatarData(a.vencimento)}</span>{" "}
                            <span className={s.situacao === "vencido" ? "text-xs text-destructive" : s.situacao === "hoje" || s.situacao === "breve" ? "text-xs text-amber-600" : "text-xs text-muted-foreground"}>
                              {s.texto}
                            </span>
                          </td>
                          <td className="px-3 py-1.5">{a.segurado}</td>
                          <td className="px-3 py-1.5 font-mono text-xs">{a.numero}</td>
                          <td className="px-3 py-1.5 text-xs">{a.forma ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {plano.atualizacoes.length > LINHAS_PREVIA && (
                  <p className="border-t px-3 py-2 text-xs text-muted-foreground">Mostrando os {LINHAS_PREVIA} primeiros por data, de {plano.atualizacoes.length}.</p>
                )}
              </div>
            )}

            {(plano.apolicesNaoEncontradas.length > 0 || plano.dataInvalida.length > 0) && (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium">{plano.apolicesNaoEncontradas.length + plano.dataInvalida.length} linhas do arquivo que não serão gravadas</summary>
                <ul className="mt-2 list-disc pl-5 text-xs">
                  {plano.apolicesNaoEncontradas.map((a) => (
                    <li key={a.numero}>
                      Apólice {a.numero} {a.segurado}: não encontrada no sistema
                    </li>
                  ))}
                  {plano.dataInvalida.map((a) => (
                    <li key={a.numero}>
                      Apólice {a.numero} {a.segurado}: data inválida (“{a.valor}”)
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="flex items-center gap-3">
              <Button onClick={() => setConfirmando(true)} disabled={total === 0 || aplicando}>
                {aplicando ? <Loader2 className="size-4 animate-spin" /> : null}
                {aplicando ? `Gravando... ${progresso}/${plano.atualizacoes.length}` : `Gravar vencimentos de ${plano.atualizacoes.length} apólices`}
              </Button>
              <p className="text-xs text-muted-foreground">Os status das apólices não são alterados.</p>
            </div>
          </Card>

          <ConfirmDialog
            open={confirmando}
            onOpenChange={setConfirmando}
            title={`Gravar o vencimento de ${plano.atualizacoes.length} apólices?`}
            description="Só os campos de vencimento, forma de pagamento e responsável pelo pagamento serão gravados. Status, capital e demais dados não mudam."
            confirmText="Gravar"
            onConfirm={aplicar}
          />
        </>
      )}
    </div>
  );
}
