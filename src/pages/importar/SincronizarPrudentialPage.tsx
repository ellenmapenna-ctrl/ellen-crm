import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileSpreadsheet, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { parseArquivo } from "@/lib/csv";
import { formatarData, formatarMoeda } from "@/lib/format";
import { qk } from "@/lib/query-keys";
import type { CoberturaDb } from "@/lib/atualizar-capital";
import {
  detectarColunasSincronizacao,
  planejarSincronizacao,
  type ApoliceSync,
  type PlanoSincronizacao,
} from "@/lib/sincronizar-prudential";

const PAGINA = 1000;
const LOTE = 20;

async function buscarTudo<T>(tabela: string, colunas: string, ordem: string): Promise<T[]> {
  const todas: T[] = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await supabase.from(tabela as never).select(colunas).order(ordem).range(inicio, inicio + PAGINA - 1);
    if (error) throw error;
    todas.push(...((data ?? []) as unknown as T[]));
    if (!data || data.length < PAGINA) break;
  }
  return todas;
}

function baixarBackup(conteudo: unknown) {
  const blob = new Blob([JSON.stringify(conteudo, null, 1)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup-sincronizacao-prudential-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function Secao({
  marcada,
  onMarcar,
  titulo,
  descricao,
  total,
  children,
  destaque,
}: {
  marcada: boolean;
  onMarcar: (v: boolean) => void;
  titulo: string;
  descricao: string;
  total: number;
  children?: React.ReactNode;
  destaque?: boolean;
}) {
  return (
    <Card className={`p-4 ${destaque ? "border-amber-300" : ""}`}>
      <label className="flex cursor-pointer items-start gap-2.5">
        <Checkbox checked={marcada} onCheckedChange={(v) => onMarcar(!!v)} disabled={total === 0} className="mt-0.5" />
        <span className="flex-1">
          <span className="flex items-center gap-2 text-sm font-semibold">
            {titulo}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">{total}</span>
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{descricao}</span>
        </span>
      </label>
      {total > 0 && children && (
        <details className="mt-2 pl-7 text-xs">
          <summary className="cursor-pointer text-primary">Ver lista</summary>
          <div className="mt-2 max-h-64 overflow-y-auto rounded border bg-muted/20 p-2">{children}</div>
        </details>
      )}
    </Card>
  );
}

export function SincronizarPrudentialPage() {
  const qc = useQueryClient();
  const [lendo, setLendo] = useState(false);
  const [plano, setPlano] = useState<PlanoSincronizacao | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [sStatus, setSStatus] = useState(true);
  const [sVenc, setSVenc] = useState(true);
  const [sAtraso, setSAtraso] = useState(true);
  const [sCapital, setSCapital] = useState(true);
  const [sIpca, setSIpca] = useState(false);
  const [sDetalhes, setSDetalhes] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [etapa, setEtapa] = useState("");
  const [resultado, setResultado] = useState<string[] | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [falhaColunas, setFalhaColunas] = useState(false);

  const capitalItens = useMemo(() => (plano ? [...plano.capital.alteracoes, ...plano.capital.premioDiferente] : []), [plano]);
  const ipcaItens = plano?.capital.divergentes ?? [];

  const totais = plano
    ? {
        status: sStatus ? plano.cancelamentos.length : 0,
        venc: sVenc ? plano.vencimentos.length : 0,
        atraso: sAtraso ? plano.atrasos.length : 0,
        capital: (sCapital ? capitalItens.length : 0) + (sIpca ? ipcaItens.length : 0),
        detalhes: sDetalhes ? plano.detalhes.gravar.length : 0,
      }
    : null;
  const totalAcoes = totais ? Object.values(totais).reduce((a, b) => a + b, 0) : 0;

  const handleArquivo = async (file: File | null | undefined) => {
    if (!file) return;
    setLendo(true);
    setPlano(null);
    setResultado(null);
    setErros([]);
    setFalhaColunas(false);
    try {
      const csv = await parseArquivo(file);
      const { colunas, faltando } = detectarColunasSincronizacao(csv.colunas);
      if (!colunas) {
        toast.error("Esta planilha não parece ser a exportação completa da Prudential.", { description: `Colunas não encontradas: ${faltando.join(", ")}.` });
        return;
      }
      let banco;
      try {
        const [apolices, coberturas, clientes, detalhes] = await Promise.all([
          buscarTudo<ApoliceSync>("apolices", "id, cliente_id, numero_apolice, status, proximo_vencimento_premio, forma_pagamento, responsavel_pagamento, observacao_vencimento", "id"),
          buscarTudo<CoberturaDb>("coberturas", "id, apolice_id, nome_cobertura, status, capital_segurado, premio_mensal", "id"),
          buscarTudo<{ id: string; nome_completo: string }>("clientes", "id, nome_completo", "id"),
          buscarTudo<{ apolice_id: string }>("apolice_detalhes", "apolice_id", "apolice_id"),
        ]);
        banco = {
          apolices,
          coberturas,
          jaTemDetalhe: new Set(detalhes.map((d) => d.apolice_id)),
          nomeCliente: new Map(clientes.map((c) => [c.id, c.nome_completo])),
        };
      } catch {
        setFalhaColunas(true);
        return;
      }
      setPlano(planejarSincronizacao(csv.linhas, colunas, banco));
      setNomeArquivo(file.name);
    } catch (err) {
      toast.error("Não foi possível ler a planilha.", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setLendo(false);
    }
  };

  const aplicar = async () => {
    if (!plano || totalAcoes === 0) return;
    setAplicando(true);
    const falhas: string[] = [];
    const feitos: string[] = [];
    const agora = new Date().toISOString();

    // Backup dos valores anteriores de tudo o que vai ser alterado
    baixarBackup({
      geradoEm: agora,
      arquivo: nomeArquivo,
      cancelamentos: sStatus ? plano.cancelamentos : [],
      vencimentos: sVenc ? plano.vencimentos.map((v) => ({ apoliceId: v.apoliceId, numero: v.numero, anterior: v.de })) : [],
      atrasos: sAtraso ? plano.atrasos.map((a) => ({ apoliceId: a.apoliceId, numero: a.numero, observacaoAnterior: a.de })) : [],
      capital: [...(sCapital ? capitalItens : []), ...(sIpca ? ipcaItens : [])].map((c) => ({ coberturaId: c.coberturaId, apolice: c.apoliceNumero, cobertura: c.nome, capitalAnterior: c.de })),
      observacao: "Os dados da página 'Detalhes da Apólice' são recriados a cada sincronização a partir do arquivo da Prudential.",
    });

    const emLotes = async <T,>(itens: T[], fn: (x: T) => Promise<void>) => {
      for (let i = 0; i < itens.length; i += LOTE) await Promise.all(itens.slice(i, i + LOTE).map(fn));
    };

    // 1) Cancelamentos (apólice + coberturas ativas dela; some o vencimento e o aviso de atraso)
    if (sStatus && plano.cancelamentos.length > 0) {
      setEtapa("Marcando apólices canceladas...");
      let ok = 0;
      await emLotes(plano.cancelamentos, async (c) => {
        const r1 = await supabase
          .from("apolices")
          .update({ status: "cancelada", proximo_vencimento_premio: null, observacao_vencimento: null, vencimento_premio_atualizado_em: agora, updated_at: agora })
          .eq("id", c.apoliceId)
          .select("id");
        if (r1.error || !r1.data?.length) return void falhas.push(`Cancelar apólice ${c.numero}: ${r1.error?.message ?? "nenhuma linha atualizada"}`);
        const r2 = await supabase.from("coberturas").update({ status: "cancelada", updated_at: agora }).eq("apolice_id", c.apoliceId).eq("status", "ativa");
        if (r2.error) falhas.push(`Coberturas da apólice ${c.numero}: ${r2.error.message}`);
        else ok++;
      });
      feitos.push(`${ok} apólices marcadas como canceladas`);
    }

    // 2) Vencimento + aviso de atraso: um único ajuste por apólice
    const patches = new Map<string, { numero: string; patch: Record<string, unknown> }>();
    const pegar = (id: string, numero: string) => {
      if (!patches.has(id)) patches.set(id, { numero, patch: {} });
      return patches.get(id)!.patch;
    };
    if (sVenc)
      for (const v of plano.vencimentos) Object.assign(pegar(v.apoliceId, v.numero), { proximo_vencimento_premio: v.para.data, forma_pagamento: v.para.forma, responsavel_pagamento: v.para.responsavel, vencimento_premio_atualizado_em: agora });
    if (sAtraso) for (const a of plano.atrasos) Object.assign(pegar(a.apoliceId, a.numero), { observacao_vencimento: a.para });
    if (patches.size > 0) {
      setEtapa("Atualizando vencimentos e atrasos...");
      let ok = 0;
      await emLotes([...patches.entries()], async ([id, { numero, patch }]) => {
        const r = await supabase.from("apolices").update({ ...patch, updated_at: agora }).eq("id", id).select("id");
        if (r.error || !r.data?.length) falhas.push(`Apólice ${numero}: ${r.error?.message ?? "nenhuma linha atualizada"}`);
        else ok++;
      });
      feitos.push(`${ok} apólices com vencimento/atraso atualizados`);
    }

    // 3) Capital das coberturas
    const capital = [...(sCapital ? capitalItens : []), ...(sIpca ? ipcaItens : [])];
    if (capital.length > 0) {
      setEtapa("Atualizando capital das coberturas...");
      let ok = 0;
      await emLotes(capital, async (c) => {
        const r = await supabase.from("coberturas").update({ capital_segurado: c.para, updated_at: agora }).eq("id", c.coberturaId).select("id");
        if (r.error || !r.data?.length) falhas.push(`Apólice ${c.apoliceNumero} · ${c.nome}: ${r.error?.message ?? "nenhuma linha atualizada"}`);
        else ok++;
      });
      feitos.push(`${ok} coberturas com o capital atualizado`);
    }

    // 4) Dados da página "Detalhes da Apólice" (PDF reunião)
    if (sDetalhes && plano.detalhes.gravar.length > 0) {
      setEtapa("Atualizando os dados do PDF reunião...");
      let ok = 0;
      for (let i = 0; i < plano.detalhes.gravar.length; i += 25) {
        const lote = plano.detalhes.gravar.slice(i, i + 25);
        const { error } = await supabase.from("apolice_detalhes").upsert(
          lote.map((g) => ({ apolice_id: g.apoliceId, dados: g.dados as unknown as Json, updated_at: agora })),
          { onConflict: "apolice_id" },
        );
        if (error) falhas.push(`Dados do PDF (apólices ${lote[0].numero} a ${lote[lote.length - 1].numero}): ${error.message}`);
        else ok += lote.length;
      }
      feitos.push(`${ok} apólices com os dados do PDF reunião atualizados`);
    }

    qc.invalidateQueries({ queryKey: qk.clientes.all });
    qc.invalidateQueries({ queryKey: qk.apolices.all });
    setResultado(feitos);
    setErros(falhas);
    setPlano(null);
    setEtapa("");
    setAplicando(false);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Sincronizar com a Prudential"
        description="Envie a exportação completa da Prudential (a mesma usada para importar as apólices). A ferramenta compara com o sistema e mostra o que mudou. Nada é gravado antes da sua confirmação, e um backup dos valores anteriores é baixado antes."
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
            Sincronização concluída.
          </p>
          <ul className="list-disc pl-6 text-sm">
            {resultado.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="text-sm">O backup dos valores anteriores foi baixado antes da gravação.</p>
          {erros.length > 0 && (
            <div className="text-sm text-destructive">
              <p className="font-medium">{erros.length} itens com erro:</p>
              <ul className="mt-1 list-disc pl-5">
                {erros.slice(0, 10).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {falhaColunas && (
        <Card className="mb-4 flex gap-3 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <p>Não foi possível ler os dados do sistema. Confira se os SQLs do vencimento e dos detalhes das apólices já foram rodados no Supabase e tente de novo.</p>
        </Card>
      )}

      <Card className="mb-4 flex flex-col gap-3 p-5">
        <p className="flex items-center gap-2 text-sm font-medium">
          <FileSpreadsheet className="size-4" />
          1. Envie a exportação completa da Prudential (.xls, .xlsx ou .csv)
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
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">
            2. Escolha o que atualizar ({nomeArquivo} · {plano.totalApolicesArquivo} apólices no arquivo)
          </p>

          <Secao
            marcada={sStatus}
            onMarcar={setSStatus}
            titulo="Marcar como canceladas"
            descricao="Apólices ativas no sistema que a Prudential mostra como canceladas. As coberturas ativas delas também são canceladas, e o vencimento é limpo."
            total={plano.cancelamentos.length}
            destaque
          >
            <ul className="space-y-0.5">
              {plano.cancelamentos.map((c) => (
                <li key={c.apoliceId}>
                  <span className="font-medium">{c.cliente}</span> · apólice {c.numero} <span className="text-muted-foreground">({c.statusArquivo.slice(0, 40)})</span>
                </li>
              ))}
            </ul>
          </Secao>

          <Secao
            marcada={sVenc}
            onMarcar={setSVenc}
            titulo="Vencimento do prêmio, forma de pagamento e responsável"
            descricao={`Atualiza a data do próximo vencimento das apólices ativas. ${plano.vencimentosInalterados} já estão iguais e não mudam.`}
            total={plano.vencimentos.length}
          >
            <ul className="space-y-0.5">
              {plano.vencimentos.map((v) => (
                <li key={v.apoliceId}>
                  <span className="font-medium">{v.cliente}</span>: {v.de.data ? formatarData(v.de.data) : "sem data"} → <strong>{formatarData(v.para.data)}</strong>
                  {v.para.forma ? ` · ${v.para.forma}` : ""}
                </li>
              ))}
            </ul>
          </Secao>

          <Secao
            marcada={sAtraso}
            onMarcar={setSAtraso}
            titulo="Aviso de atraso"
            descricao='Escreve "EM ATRASO (N dias)" nas apólices atrasadas e tira o aviso de quem regularizou. Observações escritas à mão (de outro tipo) nunca são trocadas.'
            total={plano.atrasos.length}
            destaque
          >
            <ul className="space-y-0.5">
              {plano.atrasos.map((a) => (
                <li key={a.apoliceId}>
                  <span className="font-medium">{a.cliente}</span> · apólice {a.numero}: {a.de ?? "—"} → <strong>{a.para ?? "(sem aviso)"}</strong>
                </li>
              ))}
            </ul>
          </Secao>

          <Secao
            marcada={sCapital}
            onMarcar={setSCapital}
            titulo="Preencher capital que está zerado"
            descricao="Coberturas ativas sem capital no sistema, preenchidas com o “Valor do Benefício” da Prudential."
            total={capitalItens.length}
          >
            <ul className="space-y-0.5">
              {capitalItens.map((c) => (
                <li key={c.coberturaId}>
                  Apólice {c.apoliceNumero} · {c.nome}: <strong>{formatarMoeda(c.para)}</strong>
                </li>
              ))}
            </ul>
          </Secao>

          <Secao
            marcada={sIpca}
            onMarcar={setSIpca}
            titulo="Atualizar capital reajustado (IPCA)"
            descricao="Coberturas em que a Prudential já tem um capital maior que o do sistema (reajuste anual, geralmente +3% a +6%). Opcional: fica desmarcado por padrão."
            total={ipcaItens.length}
          >
            <ul className="space-y-0.5">
              {ipcaItens.map((c) => (
                <li key={c.coberturaId}>
                  Apólice {c.apoliceNumero} · {c.nome.split(" por ")[0]}: {formatarMoeda(c.de)} → <strong>{formatarMoeda(c.para)}</strong>
                </li>
              ))}
            </ul>
          </Secao>

          <Secao
            marcada={sDetalhes}
            onMarcar={setSDetalhes}
            titulo="Dados da página da apólice (PDF reunião)"
            descricao="Guarda de novo, para cada apólice ativa, os dados que aparecem na página “Detalhes da Apólice” do PDF reunião."
            total={plano.detalhes.gravar.length}
          />

          {(plano.informativos.ativasForaDoArquivo.length > 0 || plano.atrasosComObservacaoManual.length > 0) && (
            <Card className="border-dashed p-4 text-xs">
              <p className="mb-1 text-sm font-semibold">Para você conferir (nada é alterado)</p>
              {plano.informativos.ativasForaDoArquivo.length > 0 && (
                <p className="mb-1">
                  <strong>Ativas no sistema que não constam neste arquivo ({plano.informativos.ativasForaDoArquivo.length}):</strong>{" "}
                  {plano.informativos.ativasForaDoArquivo.map((a) => `${a.cliente} (${a.numero || "sem número"})`).join("; ")}.
                </p>
              )}
              {plano.atrasosComObservacaoManual.length > 0 && (
                <p>
                  <strong>Em atraso, mas com uma observação sua (não trocada):</strong> {plano.atrasosComObservacaoManual.map((a) => `${a.cliente} (${a.numero})`).join("; ")}.
                </p>
              )}
            </Card>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={() => setConfirmando(true)} disabled={totalAcoes === 0 || aplicando}>
              {aplicando ? <Loader2 className="size-4 animate-spin" /> : null}
              {aplicando ? etapa || "Gravando..." : `Sincronizar (${totalAcoes} alterações)`}
            </Button>
            <p className="text-xs text-muted-foreground">Um backup com os valores anteriores é baixado antes de gravar.</p>
          </div>
        </div>
      )}

      {totais && (
        <ConfirmDialog
          open={confirmando}
          onOpenChange={setConfirmando}
          title={`Sincronizar com a Prudential (${totalAcoes} alterações)?`}
          description={[
            totais.status ? `${totais.status} apólices serão marcadas como canceladas` : null,
            totais.venc ? `${totais.venc} vencimentos serão atualizados` : null,
            totais.atraso ? `${totais.atraso} avisos de atraso` : null,
            totais.capital ? `${totais.capital} capitais de cobertura` : null,
            totais.detalhes ? `${totais.detalhes} páginas de apólice do PDF reunião` : null,
          ]
            .filter(Boolean)
            .join(" · ") + ". Um arquivo de backup com os valores anteriores será baixado antes."}
          confirmText="Sincronizar"
          onConfirm={aplicar}
        />
      )}
    </div>
  );
}
