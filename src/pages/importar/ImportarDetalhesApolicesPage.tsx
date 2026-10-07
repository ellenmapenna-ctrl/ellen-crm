import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { parseArquivo } from "@/lib/csv";
import {
  detectarColunasDetalhes,
  montarDetalhesDasApolices,
  planejarDetalhes,
  type ApoliceBancoDetalhe,
  type PlanoDetalhes,
} from "@/lib/apolice-detalhes-import";

const PAGINA = 1000;
const LOTE = 25;
const LINHAS_PREVIA = 30;

async function buscarApolices(): Promise<ApoliceBancoDetalhe[]> {
  const todas: ApoliceBancoDetalhe[] = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await supabase.from("apolices").select("id, numero_apolice, status").order("id").range(inicio, inicio + PAGINA - 1);
    if (error) throw error;
    todas.push(...((data ?? []) as ApoliceBancoDetalhe[]));
    if (!data || data.length < PAGINA) break;
  }
  return todas;
}

async function buscarApolicesComDetalhe(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await supabase.from("apolice_detalhes").select("apolice_id").order("apolice_id").range(inicio, inicio + PAGINA - 1);
    if (error) throw error;
    (data ?? []).forEach((d) => ids.add(d.apolice_id));
    if (!data || data.length < PAGINA) break;
  }
  return ids;
}

function Resumo({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <Card className={destaque ? "border-primary/40 p-3" : "p-3"}>
      <p className="text-2xl font-semibold tabular-nums">{valor}</p>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
    </Card>
  );
}

export function ImportarDetalhesApolicesPage() {
  const [lendo, setLendo] = useState(false);
  const [plano, setPlano] = useState<PlanoDetalhes | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [soAtivas, setSoAtivas] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [semTabela, setSemTabela] = useState(false);
  const [resultado, setResultado] = useState<{ gravadas: number; erros: string[] } | null>(null);

  const aGravar = plano ? plano.gravar.filter((g) => !soAtivas || g.ativa) : [];

  const handleArquivo = async (file: File | null | undefined) => {
    if (!file) return;
    setLendo(true);
    setPlano(null);
    setResultado(null);
    setSemTabela(false);
    try {
      const csv = await parseArquivo(file);
      const { colunas, faltando } = detectarColunasDetalhes(csv.colunas);
      if (!colunas) {
        toast.error("Esta planilha não parece ser a exportação completa da Prudential.", { description: `Colunas não encontradas: ${faltando.join(", ")}.` });
        return;
      }
      let apolices: ApoliceBancoDetalhe[];
      let jaTem: Set<string>;
      try {
        [apolices, jaTem] = await Promise.all([buscarApolices(), buscarApolicesComDetalhe()]);
      } catch {
        setSemTabela(true);
        return;
      }
      setPlano(planejarDetalhes(montarDetalhesDasApolices(csv.linhas, colunas), apolices, jaTem));
      setNomeArquivo(file.name);
    } catch (err) {
      toast.error("Não foi possível ler a planilha.", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setLendo(false);
    }
  };

  const aplicar = async () => {
    if (aGravar.length === 0) return;
    setAplicando(true);
    setProgresso(0);
    const erros: string[] = [];
    let gravadas = 0;
    const agora = new Date().toISOString();
    for (let i = 0; i < aGravar.length; i += LOTE) {
      const lote = aGravar.slice(i, i + LOTE);
      const { error } = await supabase
        .from("apolice_detalhes")
        .upsert(
          lote.map((g) => ({ apolice_id: g.apoliceId, dados: g.dados as unknown as Json, updated_at: agora })),
          { onConflict: "apolice_id" },
        );
      if (error) erros.push(`Apólices ${lote[0].numero} a ${lote[lote.length - 1].numero}: ${error.message}`);
      else gravadas += lote.length;
      setProgresso(Math.min(i + LOTE, aGravar.length));
    }
    setResultado({ gravadas, erros });
    setPlano(null);
    setAplicando(false);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Importar dados das apólices"
        description="Lê a exportação completa da Prudential e guarda, por apólice, os dados que aparecem na página “Detalhes da Apólice” do PDF reunião. Só grava na tabela de detalhes: nada do resto do cadastro muda."
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
            Dados guardados para {resultado.gravadas} apólices.
          </p>
          <p className="text-sm">Agora o “Baixar PDF reunião” da Revisão Anual já consegue montar a página da apólice.</p>
          {resultado.erros.length > 0 && (
            <div className="text-sm text-destructive">
              <p className="font-medium">{resultado.erros.length} lotes com erro:</p>
              <ul className="mt-1 list-disc pl-5">
                {resultado.erros.slice(0, 10).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {semTabela && (
        <Card className="mb-4 flex gap-3 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <p>
            O banco ainda não tem a tabela de detalhes. Rode o SQL <code className="rounded bg-white px-1">migration_20261007_apolice_detalhes.sql</code> no Supabase (SQL Editor) e tente de novo.
          </p>
        </Card>
      )}

      <Card className="mb-4 flex flex-col gap-3 p-5">
        <p className="flex items-center gap-2 text-sm font-medium">
          <FileText className="size-4" />
          1. Envie a exportação completa da Prudential (a mesma usada para importar as apólices: .xls, .xlsx ou .csv)
        </p>
        <Input type="file" accept=".csv,.xls,.xlsx,.xlsm" disabled={lendo || aplicando} onChange={(e) => handleArquivo(e.target.files?.[0])} />
        {lendo && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Lendo a planilha e comparando com o sistema...
          </p>
        )}
      </Card>

      {plano && (
        <>
          <Card className="mb-4 flex flex-col gap-4 p-5">
            <p className="text-sm font-medium">2. Confira o que vai ser guardado ({nomeArquivo})</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Resumo rotulo="apólices terão os dados guardados" valor={aGravar.length} destaque />
              <Resumo rotulo="já tinham dados (serão atualizados)" valor={aGravar.filter((g) => g.jaTinha).length} />
              <Resumo rotulo="do arquivo sem cadastro no sistema" valor={plano.semCadastro.length} />
              <Resumo rotulo="apólices no arquivo" valor={plano.total} />
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm">
              <Checkbox checked={soAtivas} onCheckedChange={(v) => setSoAtivas(!!v)} className="mt-0.5" />
              <span>
                <span className="font-medium">Guardar só as apólices ativas</span>
                <p className="mt-0.5 text-xs text-muted-foreground">Recomendado: as canceladas não entram em revisitas. Desmarque para guardar todas as {plano.gravar.length} que têm cadastro.</p>
              </span>
            </label>

            {aGravar.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Apólice</th>
                      <th className="px-3 py-2">Segurado</th>
                      <th className="px-3 py-2">Situação</th>
                      <th className="px-3 py-2 text-right">Coberturas ativas</th>
                      <th className="px-3 py-2">Pagamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aGravar.slice(0, LINHAS_PREVIA).map((g) => (
                      <tr key={g.apoliceId} className="border-t">
                        <td className="px-3 py-1.5 font-mono text-xs">{g.numero}</td>
                        <td className="px-3 py-1.5">{g.segurado}</td>
                        <td className="px-3 py-1.5 text-xs">{g.dados.status}</td>
                        <td className="px-3 py-1.5 text-right text-xs">{g.dados.coberturas.length}</td>
                        <td className="px-3 py-1.5 text-xs">
                          {[g.dados.pagamento.periodicidade, g.dados.pagamento.formaPagamento].filter(Boolean).join(" · ") || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {aGravar.length > LINHAS_PREVIA && <p className="border-t px-3 py-2 text-xs text-muted-foreground">Mostrando as primeiras {LINHAS_PREVIA} de {aGravar.length}.</p>}
              </div>
            )}

            {plano.semCadastro.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium">{plano.semCadastro.length} apólices do arquivo que não existem no sistema (não serão guardadas)</summary>
                <ul className="mt-2 list-disc pl-5 text-xs">
                  {plano.semCadastro.map((a) => (
                    <li key={a.numero}>
                      Apólice {a.numero} · {a.segurado}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="flex items-center gap-3">
              <Button onClick={() => setConfirmando(true)} disabled={aGravar.length === 0 || aplicando}>
                {aplicando ? <Loader2 className="size-4 animate-spin" /> : null}
                {aplicando ? `Guardando... ${progresso}/${aGravar.length}` : `Guardar dados de ${aGravar.length} apólices`}
              </Button>
              <p className="text-xs text-muted-foreground">Apólices já importadas têm os dados substituídos pelos do arquivo novo.</p>
            </div>
          </Card>

          <ConfirmDialog
            open={confirmando}
            onOpenChange={setConfirmando}
            title={`Guardar os dados de ${aGravar.length} apólices?`}
            description="Os dados vão para a tabela de detalhes das apólices (usada só no PDF reunião). Capital, status, vencimentos e o resto do cadastro não mudam."
            confirmText="Guardar"
            onConfirm={aplicar}
          />
        </>
      )}
    </div>
  );
}
