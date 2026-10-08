import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { parseArquivo } from "@/lib/csv";
import { formatarMoeda } from "@/lib/format";
import { qk } from "@/lib/query-keys";
import {
  detectarColunasCapital,
  planejarAtualizacaoCapital,
  type AlteracaoCapital,
  type ApoliceDb,
  type CoberturaDb,
  type PlanoCapital,
} from "@/lib/atualizar-capital";

const PAGINA = 1000;
const LOTE_GRAVACAO = 20;
const LINHAS_PREVIA = 60;

/** Busca todas as linhas de uma tabela, paginando (o Supabase devolve no máximo 1000 por consulta). */
async function buscarTudo<T>(tabela: "apolices" | "coberturas", colunas: string): Promise<T[]> {
  const todas: T[] = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await supabase
      .from(tabela)
      .select(colunas)
      .order("id")
      .range(inicio, inicio + PAGINA - 1);
    if (error) throw error;
    todas.push(...((data ?? []) as unknown as T[]));
    if (!data || data.length < PAGINA) break;
  }
  return todas;
}

function baixarBackupCsv(alteracoes: AlteracaoCapital[]) {
  const linhas = [
    "cobertura_id;apolice;cobertura;capital_anterior;capital_novo",
    ...alteracoes.map((a) => [a.coberturaId, a.apoliceNumero, `"${a.nome.replace(/"/g, '""')}"`, a.de, a.para].join(";")),
  ];
  const blob = new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup-capital-coberturas-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Resumo({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <Card className={destaque ? "border-primary/40 p-3" : "p-3"}>
      <p className="text-2xl font-semibold tabular-nums">{valor}</p>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
    </Card>
  );
}

export function AtualizarCapitalPage() {
  const qc = useQueryClient();
  const [lendo, setLendo] = useState(false);
  const [plano, setPlano] = useState<PlanoCapital | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [incluirPremioDiferente, setIncluirPremioDiferente] = useState(false);
  const [preencherSeguradora, setPreencherSeguradora] = useState(false);
  const [nomeSeguradora, setNomeSeguradora] = useState("Prudential");
  const [confirmando, setConfirmando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultado, setResultado] = useState<{ atualizadas: number; seguradorasPreenchidas: number; erros: string[] } | null>(null);

  const divergentesTodos = plano ? [...plano.divergentes, ...plano.muitoDiferentes] : [];
  const alteracoesAAplicar = plano ? [...plano.alteracoes, ...(incluirPremioDiferente ? plano.premioDiferente : [])] : [];
  const seguradorasAAplicar = plano && preencherSeguradora && nomeSeguradora.trim() ? plano.apolicesSemSeguradora : [];
  const totalAcoes = alteracoesAAplicar.length + seguradorasAAplicar.length;

  const handleArquivo = async (file: File | null | undefined) => {
    if (!file) return;
    setLendo(true);
    setPlano(null);
    setResultado(null);
    setIncluirPremioDiferente(false);
    setPreencherSeguradora(false);
    try {
      const csv = await parseArquivo(file);
      const { colunas, faltando } = detectarColunasCapital(csv.colunas);
      if (!colunas) {
        toast.error("Esta planilha não parece ser o relatório da seguradora.", { description: `Colunas não encontradas: ${faltando.join(", ")}.` });
        return;
      }
      const [apolices, coberturas] = await Promise.all([
        buscarTudo<ApoliceDb>("apolices", "id, numero_apolice, seguradora"),
        buscarTudo<CoberturaDb>("coberturas", "id, apolice_id, nome_cobertura, capital_segurado, premio_mensal, status"),
      ]);
      setPlano(planejarAtualizacaoCapital(csv.linhas, colunas, apolices, coberturas));
      setNomeArquivo(file.name);
    } catch (err) {
      toast.error("Não foi possível ler a planilha.", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setLendo(false);
    }
  };

  const aplicar = async () => {
    if (totalAcoes === 0) return;
    setAplicando(true);
    setProgresso(0);
    if (alteracoesAAplicar.length > 0) baixarBackupCsv(alteracoesAAplicar);
    const erros: string[] = [];
    let atualizadas = 0;
    for (let i = 0; i < alteracoesAAplicar.length; i += LOTE_GRAVACAO) {
      const lote = alteracoesAAplicar.slice(i, i + LOTE_GRAVACAO);
      await Promise.all(
        lote.map(async (a) => {
          const { data, error } = await supabase
            .from("coberturas")
            .update({ capital_segurado: a.para, updated_at: new Date().toISOString() })
            .eq("id", a.coberturaId)
            .select("id");
          if (error || !data || data.length === 0) erros.push(`Apólice ${a.apoliceNumero} · ${a.nome}: ${error?.message ?? "nenhuma linha atualizada"}`);
          else atualizadas++;
        }),
      );
      setProgresso(Math.min(i + LOTE_GRAVACAO, alteracoesAAplicar.length));
    }
    let seguradorasPreenchidas = 0;
    for (const a of seguradorasAAplicar) {
      const { data, error } = await supabase
        .from("apolices")
        .update({ seguradora: nomeSeguradora.trim(), updated_at: new Date().toISOString() })
        .eq("id", a.id)
        .is("seguradora", null)
        .select("id");
      if (error || !data || data.length === 0) erros.push(`Seguradora da apólice ${a.numero}: ${error?.message ?? "nenhuma linha atualizada"}`);
      else seguradorasPreenchidas++;
    }
    qc.invalidateQueries({ queryKey: qk.clientes.all });
    setResultado({ atualizadas, seguradorasPreenchidas, erros });
    setPlano(null);
    setAplicando(false);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Atualizar capital segurado"
        description="Preenche o capital das coberturas já importadas usando a coluna “Valor do Benefício” do relatório da seguradora. Só altera o capital: nada é criado nem apagado."
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
            {resultado.atualizadas} coberturas atualizadas
            {resultado.seguradorasPreenchidas > 0 ? ` e seguradora preenchida em ${resultado.seguradorasPreenchidas} apólices` : ""}.
          </p>
          {resultado.atualizadas > 0 && <p className="text-sm">O arquivo de backup com os valores anteriores foi baixado antes da gravação.</p>}
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

      <Card className="mb-4 flex flex-col gap-3 p-5">
        <p className="flex items-center gap-2 text-sm font-medium">
          <FileUp className="size-4" />
          1. Envie o relatório da seguradora (.xls, .xlsx ou .csv)
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
            <p className="text-sm font-medium">2. Confira o que vai mudar ({nomeArquivo})</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Resumo rotulo="coberturas serão atualizadas" valor={plano.alteracoes.length} destaque />
              <Resumo rotulo="já estão corretas" valor={plano.jaCorretas} />
              <Resumo rotulo="com capital diferente (não alteradas)" valor={divergentesTodos.length} />
              <Resumo rotulo="sem correspondência no banco" valor={plano.semCorrespondencia.length + plano.apolicesNaoEncontradas.length} />
            </div>

            {plano.premioDiferente.length > 0 && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm">
                <Checkbox checked={incluirPremioDiferente} onCheckedChange={(v) => setIncluirPremioDiferente(!!v)} className="mt-0.5" />
                <span>
                  <span className="font-medium">Incluir também {plano.premioDiferente.length} coberturas em que o prêmio mudou</span>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    A apólice e a cobertura são as mesmas, mas o prêmio do arquivo é diferente do que está no banco (provável reajuste). Só o capital seria preenchido.
                  </p>
                </span>
              </label>
            )}

            {plano.apolicesSemSeguradora.length > 0 && (
              <div className="rounded-lg border p-3 text-sm">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <Checkbox checked={preencherSeguradora} onCheckedChange={(v) => setPreencherSeguradora(!!v)} className="mt-0.5" />
                  <span>
                    <span className="font-medium">Preencher a seguradora em {plano.apolicesSemSeguradora.length} apólices que estão sem seguradora no sistema</span>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Vale para as apólices que constam neste arquivo. Necessário para a Nova Revisita agrupar as apólices do cliente por seguradora. Só preenche apólices com o campo vazio.
                    </p>
                  </span>
                </label>
                {preencherSeguradora && (
                  <div className="mt-2 flex items-center gap-2 pl-7">
                    <span className="text-xs text-muted-foreground">Seguradora do relatório:</span>
                    <Input className="h-8 w-48" value={nomeSeguradora} onChange={(e) => setNomeSeguradora(e.target.value)} />
                  </div>
                )}
              </div>
            )}

            {alteracoesAAplicar.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Apólice</th>
                      <th className="px-3 py-2">Cobertura</th>
                      <th className="px-3 py-2 text-right">Capital hoje</th>
                      <th className="px-3 py-2 text-right">Capital novo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alteracoesAAplicar.slice(0, LINHAS_PREVIA).map((a) => (
                      <tr key={a.coberturaId} className="border-t">
                        <td className="px-3 py-1.5 font-mono text-xs">{a.apoliceNumero}</td>
                        <td className="px-3 py-1.5">{a.nome}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-xs text-muted-foreground">{formatarMoeda(a.de)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-xs font-semibold">{formatarMoeda(a.para)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {alteracoesAAplicar.length > LINHAS_PREVIA && (
                  <p className="border-t px-3 py-2 text-xs text-muted-foreground">Mostrando as primeiras {LINHAS_PREVIA} de {alteracoesAAplicar.length}.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma cobertura precisa ser atualizada com este arquivo.</p>
            )}

            {divergentesTodos.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium">{divergentesTodos.length} coberturas com capital diferente (não serão alteradas)</summary>
                <p className="mt-1 text-xs text-muted-foreground">
                  O banco já tem um capital preenchido e diferente do arquivo (por exemplo, capital corrigido pela inflação). Por segurança, estas ficam como estão.
                </p>
                <ul className="mt-2 list-disc pl-5 text-xs">
                  {divergentesTodos.map((d) => (
                    <li key={d.coberturaId}>
                      Apólice {d.apoliceNumero} · {d.nome}: banco {formatarMoeda(d.de)} / arquivo {formatarMoeda(d.para)}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {(plano.semCorrespondencia.length > 0 || plano.apolicesNaoEncontradas.length > 0) && (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium">
                  {plano.semCorrespondencia.length + plano.apolicesNaoEncontradas.length} itens do arquivo sem correspondência no banco
                </summary>
                <ul className="mt-2 list-disc pl-5 text-xs">
                  {plano.apolicesNaoEncontradas.map((n) => (
                    <li key={n}>Apólice {n}: não encontrada no banco</li>
                  ))}
                  {plano.semCorrespondencia.map((s, i) => (
                    <li key={i}>
                      Apólice {s.apoliceNumero} · {s.produto}: {s.motivo}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="flex items-center gap-3">
              <Button onClick={() => setConfirmando(true)} disabled={totalAcoes === 0 || aplicando}>
                {aplicando ? <Loader2 className="size-4 animate-spin" /> : null}
                {aplicando
                  ? `Atualizando... ${progresso}/${alteracoesAAplicar.length}`
                  : seguradorasAAplicar.length > 0
                    ? `Aplicar (${alteracoesAAplicar.length} coberturas + ${seguradorasAAplicar.length} seguradoras)`
                    : `Atualizar ${alteracoesAAplicar.length} coberturas`}
              </Button>
              <p className="text-xs text-muted-foreground">Um arquivo de backup com os valores anteriores é baixado antes de gravar.</p>
            </div>
          </Card>

          <ConfirmDialog
            open={confirmando}
            onOpenChange={setConfirmando}
            title={`Aplicar ${alteracoesAAplicar.length} atualizações de capital${seguradorasAAplicar.length > 0 ? ` e preencher a seguradora de ${seguradorasAAplicar.length} apólices` : ""}?`}
            description="Só os campos capital segurado e (se marcado) seguradora, hoje vazia, serão alterados. Antes, um arquivo de backup com os valores atuais de capital será baixado."
            confirmText="Atualizar"
            onConfirm={aplicar}
          />
        </>
      )}
    </div>
  );
}
