import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  CheckCircle2,
  FileUp,
  ListChecks,
  Table2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/query-keys";
import { limparCpf, normalizarData, parseArquivo, extensaoSuportada, type CsvResultado } from "@/lib/csv";
import { formatarMoeda, paraNumero } from "@/lib/format";
import {
  STATUS_REJEITADA,
  normalizarNomeCobertura,
  normalizarNumeroApolice,
  normalizarStatusApolice,
  normalizarStatusCobertura,
} from "@/lib/seguros-taxonomia";
import {
  type ApoliceInsert,
  type ClienteInsert,
  type CoberturaInsert,
} from "@/lib/types";
import { cn } from "@/lib/utils";

// ============================================================
// Campos mapeáveis: cada coluna da planilha vira UM destino, agrupado em
// três categorias. "Cliente" e "Apólice" repetem valor em várias linhas de
// uma mesma apólice (usamos a primeira linha do grupo); "Cobertura" muda
// linha a linha — cada linha da planilha é uma cobertura.
// ============================================================

type Grupo = "cliente" | "apolice" | "cobertura";

interface Campo {
  key: string;
  label: string;
  grupo: Grupo;
  data?: boolean;
}

const CLIENTE_CAMPOS: Campo[] = [
  { key: "nome_completo", label: "Nome completo *", grupo: "cliente" },
  { key: "cpf", label: "CPF", grupo: "cliente" },
  { key: "email", label: "E-mail", grupo: "cliente" },
  { key: "celular", label: "Celular", grupo: "cliente" },
  { key: "data_nascimento", label: "Data de nascimento", grupo: "cliente", data: true },
  { key: "sexo", label: "Sexo", grupo: "cliente" },
  { key: "estado_civil", label: "Estado civil", grupo: "cliente" },
  { key: "profissao", label: "Profissão", grupo: "cliente" },
  { key: "empresa", label: "Empresa", grupo: "cliente" },
  { key: "cargo", label: "Cargo", grupo: "cliente" },
  { key: "cep", label: "CEP", grupo: "cliente" },
  { key: "endereco", label: "Logradouro", grupo: "cliente" },
  { key: "numero", label: "Número", grupo: "cliente" },
  { key: "complemento", label: "Complemento", grupo: "cliente" },
  { key: "bairro", label: "Bairro", grupo: "cliente" },
  { key: "cidade", label: "Cidade", grupo: "cliente" },
  { key: "uf", label: "UF", grupo: "cliente" },
  { key: "cliente_desde", label: "Cliente desde", grupo: "cliente", data: true },
];

const APOLICE_CAMPOS: Campo[] = [
  { key: "numero_apolice", label: "Número da apólice", grupo: "apolice" },
  { key: "seguradora", label: "Seguradora", grupo: "apolice" },
  { key: "tipo_produto", label: "Tipo de produto", grupo: "apolice" },
  { key: "status_apolice", label: "Status da apólice", grupo: "apolice" },
  { key: "data_emissao", label: "Data de emissão", grupo: "apolice", data: true },
  { key: "vencimento_apolice", label: "Vencimento da apólice", grupo: "apolice", data: true },
  { key: "melhor_dia_pagamento", label: "Melhor dia de pagamento", grupo: "apolice" },
  { key: "premio_mensal_total", label: "Prêmio mensal total (apólice)", grupo: "apolice" },
  { key: "capital_segurado_total", label: "Capital segurado total (apólice)", grupo: "apolice" },
];

const COBERTURA_CAMPOS: Campo[] = [
  { key: "nome_cobertura", label: "Nome da cobertura", grupo: "cobertura" },
  { key: "premio_cobertura", label: "Prêmio da cobertura", grupo: "cobertura" },
  { key: "capital_cobertura", label: "Capital segurado da cobertura", grupo: "cobertura" },
  { key: "tipo_cobertura", label: "Tipo da cobertura (base/opcional)", grupo: "cobertura" },
  { key: "status_cobertura", label: "Status da cobertura", grupo: "cobertura" },
];

const TODOS_CAMPOS: Campo[] = [...CLIENTE_CAMPOS, ...APOLICE_CAMPOS, ...COBERTURA_CAMPOS];

function campoPorKey(key: string): Campo | undefined {
  return TODOS_CAMPOS.find((c) => c.key === key);
}

const PASSOS = [
  { num: 1, label: "Upload", icon: FileUp },
  { num: 2, label: "Mapeamento", icon: ListChecks },
  { num: 3, label: "Pré-visualização", icon: Table2 },
  { num: 4, label: "Conclusão", icon: CheckCircle2 },
];

function sugerirCampo(coluna: string): string {
  const c = coluna.toLowerCase().normalize("NFD").replace(/[^a-z0-9_]/g, "_");
  const map: Record<string, string> = {
    nome: "nome_completo", nome_completo: "nome_completo", cliente: "nome_completo",
    cpf: "cpf", email: "email", e_mail: "email", mail: "email",
    celular: "celular", telefone: "celular", whatsapp: "celular",
    nascimento: "data_nascimento", data_nascimento: "data_nascimento", dn: "data_nascimento",
    sexo: "sexo", estado_civil: "estado_civil", civil: "estado_civil",
    profissao: "profissao", empresa: "empresa", cargo: "cargo",
    cep: "cep", endereco: "endereco", logradouro: "endereco", rua: "endereco",
    numero: "numero", complemento: "complemento", bairro: "bairro",
    cidade: "cidade", uf: "uf", estado: "uf",
    cliente_desde: "cliente_desde", desde: "cliente_desde",
    numero_apolice: "numero_apolice", num_apolice: "numero_apolice", apolice: "numero_apolice",
    seguradora: "seguradora",
    produto: "nome_cobertura", cobertura: "nome_cobertura", descricao_cobertura: "nome_cobertura",
    premio: "premio_cobertura", pa: "premio_cobertura", premio_mensal: "premio_cobertura",
    capital_segurado: "capital_cobertura", importancia_segurada: "capital_cobertura", is: "capital_cobertura",
  };
  return map[c] ?? "";
}

/** Inverte o mapeamento coluna→campo para campo→coluna (uso interno na leitura de cada linha). */
function construirColunaPorCampo(mapeamento: Record<string, string>): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const [coluna, campo] of Object.entries(mapeamento)) {
    if (campo) resultado[campo] = coluna;
  }
  return resultado;
}

function lerValor(linha: Record<string, string>, colunaPorCampo: Record<string, string>, campoKey: string): string {
  const coluna = colunaPorCampo[campoKey];
  if (!coluna) return "";
  return (linha[coluna] ?? "").toString().trim();
}

/** Verdadeiro quando o status de apólice bruto desta linha indica que ela nunca chegou a vigorar (rejeitada/desistência). */
function statusApoliceRejeitada(linha: Record<string, string>, colunaPorCampo: Record<string, string>): boolean {
  const bruto = lerValor(linha, colunaPorCampo, "status_apolice");
  return normalizarStatusApolice(bruto) === STATUS_REJEITADA;
}

/** Monta o cliente a partir dos campos do grupo "cliente" mapeados nessa linha. */
function construirClientePayload(
  linha: Record<string, string>,
  colunaPorCampo: Record<string, string>
): ClienteInsert | null {
  const registro: Record<string, unknown> = {};
  for (const campo of CLIENTE_CAMPOS) {
    let valor = lerValor(linha, colunaPorCampo, campo.key);
    if (!valor) continue;
    if (campo.data) {
      valor = normalizarData(valor) ?? "";
      if (!valor) continue;
      registro[campo.key] = valor;
      continue;
    }
    if (campo.key === "cpf") valor = limparCpf(valor) ?? "";
    registro[campo.key] = valor || null;
  }
  if (!registro.nome_completo) return null;
  return registro as ClienteInsert;
}

/** Monta os campos de apólice mapeados nessa linha (usada só na primeira linha de cada grupo). */
function construirApolicePayload(
  linha: Record<string, string>,
  colunaPorCampo: Record<string, string>
): Partial<ApoliceInsert> {
  const payload: Partial<ApoliceInsert> = {};

  const numero = lerValor(linha, colunaPorCampo, "numero_apolice");
  if (numero) payload.numero_apolice = normalizarNumeroApolice(numero);

  const seguradora = lerValor(linha, colunaPorCampo, "seguradora");
  if (seguradora) payload.seguradora = seguradora;

  const tipoProduto = lerValor(linha, colunaPorCampo, "tipo_produto");
  if (tipoProduto) payload.tipo_produto = tipoProduto;

  const statusBruto = lerValor(linha, colunaPorCampo, "status_apolice");
  const status = normalizarStatusApolice(statusBruto);
  if (status && status !== STATUS_REJEITADA) payload.status = status;

  const dataEmissao = lerValor(linha, colunaPorCampo, "data_emissao");
  if (dataEmissao) {
    const iso = normalizarData(dataEmissao);
    if (iso) payload.data_emissao = iso;
  }

  const vencimento = lerValor(linha, colunaPorCampo, "vencimento_apolice");
  if (vencimento) {
    const iso = normalizarData(vencimento);
    if (iso) payload.vencimento_apolice = iso;
  }

  const melhorDia = lerValor(linha, colunaPorCampo, "melhor_dia_pagamento");
  if (melhorDia) {
    const n = Number(melhorDia.replace(/\D/g, ""));
    if (n >= 1 && n <= 31) payload.melhor_dia_pagamento = n;
  }

  const premioTotal = lerValor(linha, colunaPorCampo, "premio_mensal_total");
  if (premioTotal) payload.premio_mensal_total = paraNumero(premioTotal);

  const capitalTotal = lerValor(linha, colunaPorCampo, "capital_segurado_total");
  if (capitalTotal) payload.capital_segurado_total = paraNumero(capitalTotal);

  return payload;
}

type CoberturaSemApolice = Omit<CoberturaInsert, "apolice_id">;

/** Normaliza um valor manual de "Tipo da cobertura" (mapeamento explícito do usuário) contra o enum do banco. */
function normalizarTipoManual(bruto: string): "base" | "opcional" | null {
  const v = bruto.trim().toLowerCase();
  if (v === "base") return "base";
  if (v === "opcional") return "opcional";
  return null;
}

/**
 * Monta a cobertura desta linha específica. Retorna null se a linha não
 * nomeia uma cobertura, ou se o status bruto indica que ela nunca vigorou
 * (rejeitada/desistência em período de graça).
 *
 * Camada automática: quando o usuário não mapeou uma coluna própria de
 * "Tipo da cobertura", o nome bruto passa pela taxonomia de seguros
 * (`normalizarNomeCobertura`) para virar o rótulo canônico + tipo inferido.
 * Se o usuário mapeou "Tipo da cobertura" manualmente, esse valor manual
 * sempre vence — a taxonomia nunca sobrescreve uma escolha explícita.
 */
function construirCoberturaPayload(
  linha: Record<string, string>,
  colunaPorCampo: Record<string, string>
): CoberturaSemApolice | null {
  const nomeBruto = lerValor(linha, colunaPorCampo, "nome_cobertura");
  if (!nomeBruto) return null;

  const statusBrutoCobertura = lerValor(linha, colunaPorCampo, "status_cobertura");
  const statusNormalizado = normalizarStatusCobertura(statusBrutoCobertura);
  if (statusNormalizado === STATUS_REJEITADA) return null;

  const tipoMapeadoManualmente = !!colunaPorCampo["tipo_cobertura"];
  const taxonomia = !tipoMapeadoManualmente ? normalizarNomeCobertura(nomeBruto) : null;

  const nome = taxonomia?.rotulo ?? nomeBruto;
  const tipoManualBruto = lerValor(linha, colunaPorCampo, "tipo_cobertura");
  const tipo = tipoManualBruto
    ? normalizarTipoManual(tipoManualBruto) ?? "opcional"
    : taxonomia?.tipo ?? "opcional";
  const status = statusNormalizado ?? "ativa";
  const premio = paraNumero(lerValor(linha, colunaPorCampo, "premio_cobertura"));
  const capital = paraNumero(lerValor(linha, colunaPorCampo, "capital_cobertura"));

  return { nome_cobertura: nome, tipo, status, premio_mensal: premio, capital_segurado: capital };
}

/** Chave de agrupamento de apólice: pelo número (repete em várias linhas) ou sintética por linha. */
function chaveApolice(linha: Record<string, string>, colunaPorCampo: Record<string, string>, idx: number): string {
  const numero = lerValor(linha, colunaPorCampo, "numero_apolice");
  return numero ? `num:${normalizarNumeroApolice(numero)}` : `linha:${idx}`;
}

function numeroDaChave(chave: string): string | null {
  return chave.startsWith("num:") ? chave.slice(4) : null;
}

interface GrupoApoliceAmostra {
  chave: string;
  numero: string | null;
  apolicePayload: Partial<ApoliceInsert>;
  coberturas: { nome: string; premio: number; capital: number }[];
  totalCoberturas: number;
}

/** Varre uma amostra do arquivo e agrupa por apólice, para a pré-visualização mostrar o agrupamento real. */
function agruparAmostraApolices(
  csv: CsvResultado,
  colunaPorCampo: Record<string, string>,
  maxGrupos = 2,
  maxLinhasVarredura = 200,
  maxCoberturasPorGrupo = 8
): GrupoApoliceAmostra[] {
  const grupos: GrupoApoliceAmostra[] = [];
  const indicePorChave = new Map<string, number>();
  const limite = Math.min(csv.linhas.length, maxLinhasVarredura);

  for (let idx = 0; idx < limite; idx++) {
    const linha = csv.linhas[idx];
    if (statusApoliceRejeitada(linha, colunaPorCampo)) continue; // nunca vigorou — não entra no agrupamento
    const chave = chaveApolice(linha, colunaPorCampo, idx);
    let grupoIdx = indicePorChave.get(chave);
    const cobertura = construirCoberturaPayload(linha, colunaPorCampo);

    if (grupoIdx === undefined) {
      const apolicePayload = construirApolicePayload(linha, colunaPorCampo);
      // Linha sem nenhum campo de apólice mapeado/preenchido e sem cobertura:
      // não forma um grupo de apólice — só os dados de cliente serão importados.
      if (Object.keys(apolicePayload).length === 0 && !cobertura) continue;
      if (grupos.length >= maxGrupos) continue;
      grupoIdx = grupos.length;
      indicePorChave.set(chave, grupoIdx);
      grupos.push({
        chave,
        numero: numeroDaChave(chave),
        apolicePayload,
        coberturas: [],
        totalCoberturas: 0,
      });
    }

    if (cobertura) {
      const grupo = grupos[grupoIdx];
      grupo.totalCoberturas++;
      if (grupo.coberturas.length < maxCoberturasPorGrupo) {
        grupo.coberturas.push({
          nome: cobertura.nome_cobertura,
          premio: Number(cobertura.premio_mensal ?? 0),
          capital: Number(cobertura.capital_segurado ?? 0),
        });
      }
      // Mesma regra da importação real: sem coluna de prêmio total mapeada,
      // o total exibido é a soma do que já foi visto das coberturas ativas
      // deste grupo (aproximação — a importação real soma todas, não só a amostra).
      if (grupo.apolicePayload.premio_mensal_total === undefined && cobertura.status === "ativa") {
        const somaAtual = grupo.coberturas.reduce((s, c) => s + c.premio, 0);
        grupo.apolicePayload = { ...grupo.apolicePayload, premio_mensal_total: somaAtual };
      }
    }
  }

  return grupos;
}

interface RelatorioImportacao {
  totalLinhas: number;
  clientesCriados: number;
  clientesReaproveitados: number;
  apolicesCriadas: number;
  apolicesReaproveitadas: number;
  coberturasCriadas: number;
  linhasRejeitadas: number;
  erros: string[];
}

interface ProgressoImportacao {
  etapaLabel: string;
  processadas: number;
  total: number;
}

const APOLICE_CAMPO_LABEL: Record<string, string> = {
  numero_apolice: "Número",
  seguradora: "Seguradora",
  tipo_produto: "Produto",
  status: "Status",
  data_emissao: "Emissão",
  vencimento_apolice: "Vencimento",
  melhor_dia_pagamento: "Dia pagamento",
  premio_mensal_total: "Prêmio total",
  capital_segurado_total: "Capital total",
};

export function ImportarClientesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [etapa, setEtapa] = useState(1);
  const [csv, setCsv] = useState<CsvResultado | null>(null);
  const [mapeamento, setMapeamento] = useState<Record<string, string>>({});
  const [importando, setImportando] = useState(false);
  const [progresso, setProgresso] = useState<ProgressoImportacao | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioImportacao | null>(null);

  const colunaPorCampo = useMemo(() => construirColunaPorCampo(mapeamento), [mapeamento]);

  const handleFile = async (file: File) => {
    if (!extensaoSuportada(file)) {
      toast.error("Formato não suportado.", { description: "Envie um arquivo .csv, .xls, .xlsx ou .xlsm." });
      return;
    }
    try {
      const resultado = await parseArquivo(file);
      if (resultado.linhas.length === 0) {
        toast.error("O arquivo está vazio.");
        return;
      }
      setCsv(resultado);
      const inicial: Record<string, string> = {};
      resultado.colunas.forEach((col) => (inicial[col] = sugerirCampo(col)));
      setMapeamento(inicial);
      setRelatorio(null);
      setEtapa(2);
    } catch {
      toast.error("Não foi possível ler o arquivo.");
    }
  };

  const campoMapeado = (coluna: string, campo: string) =>
    setMapeamento((m) => ({ ...m, [coluna]: campo }));

  const registrosPreview = csv ? csv.linhas.slice(0, 5) : [];
  const camposMapeados = Object.entries(mapeamento)
    .filter(([, campo]) => !!campo)
    .map(([coluna, campo]) => ({ coluna, campo }));
  const camposClienteMapeados = camposMapeados.filter(({ campo }) => campoPorKey(campo)?.grupo === "cliente");
  const nomeCompletoMapeado = Object.values(mapeamento).includes("nome_completo");

  const previewGrupos = useMemo(
    () => (csv ? agruparAmostraApolices(csv, colunaPorCampo) : []),
    [csv, colunaPorCampo]
  );

  const handleImportar = async () => {
    if (!csv || !nomeCompletoMapeado) return;
    setImportando(true);
    setRelatorio(null);
    setProgresso(null);

    const erros: string[] = [];

    // ---- Monta os payloads de todas as linhas em memória (síncrono) ----
    interface LinhaProcessada {
      idx: number;
      clientePayload: ClienteInsert;
      cpfLimpo: string | null;
      apoliceChave: string;
      apolicePayloadParcial: Partial<ApoliceInsert>;
      coberturaPayload: CoberturaSemApolice | null;
    }

    const linhasValidas: LinhaProcessada[] = [];
    let linhasRejeitadas = 0;
    csv.linhas.forEach((linha, idx) => {
      if (statusApoliceRejeitada(linha, colunaPorCampo)) {
        linhasRejeitadas++;
        return;
      }
      const clientePayload = construirClientePayload(linha, colunaPorCampo);
      if (!clientePayload) {
        erros.push(`Linha ${idx + 2}: sem nome — ignorada.`);
        return;
      }
      linhasValidas.push({
        idx,
        clientePayload,
        cpfLimpo: clientePayload.cpf ?? null,
        apoliceChave: chaveApolice(linha, colunaPorCampo, idx),
        apolicePayloadParcial: construirApolicePayload(linha, colunaPorCampo),
        coberturaPayload: construirCoberturaPayload(linha, colunaPorCampo),
      });
    });

    // ================= FASE A: resolver cliente_id por CPF =================
    const cpfsDistintos = [...new Set(linhasValidas.map((l) => l.cpfLimpo).filter((c): c is string => !!c))];
    const cpfParaClienteId = new Map<string, string>();

    setProgresso({ etapaLabel: "Consultando clientes existentes", processadas: 0, total: cpfsDistintos.length });
    for (let i = 0; i < cpfsDistintos.length; i += 300) {
      const chunk = cpfsDistintos.slice(i, i + 300);
      const { data, error } = await supabase.from("clientes").select("id, cpf").in("cpf", chunk);
      if (error) {
        erros.push(`Falha ao consultar clientes existentes: ${error.message}`);
      } else {
        for (const row of data ?? []) {
          if (row.cpf) cpfParaClienteId.set(row.cpf, row.id);
        }
      }
      setProgresso((p) => (p ? { ...p, processadas: p.processadas + chunk.length } : p));
    }
    const clientesReaproveitados = cpfParaClienteId.size;

    const clienteIdPorLinha = new Map<number, string>();
    for (const l of linhasValidas) {
      if (l.cpfLimpo && cpfParaClienteId.has(l.cpfLimpo)) {
        clienteIdPorLinha.set(l.idx, cpfParaClienteId.get(l.cpfLimpo)!);
      }
    }

    const gruposNovoCliente = new Map<string, { payload: ClienteInsert; linhas: number[] }>();
    for (const l of linhasValidas) {
      if (clienteIdPorLinha.has(l.idx)) continue;
      const chave = l.cpfLimpo ?? `linha:${l.idx}`;
      if (!gruposNovoCliente.has(chave)) gruposNovoCliente.set(chave, { payload: l.clientePayload, linhas: [] });
      gruposNovoCliente.get(chave)!.linhas.push(l.idx);
    }

    let clientesCriados = 0;
    const chavesNovoCliente = [...gruposNovoCliente.keys()];
    setProgresso({ etapaLabel: "Criando clientes novos", processadas: 0, total: chavesNovoCliente.length });
    for (let i = 0; i < chavesNovoCliente.length; i += 20) {
      const chunk = chavesNovoCliente.slice(i, i + 20);
      await Promise.all(
        chunk.map(async (chave) => {
          const grupo = gruposNovoCliente.get(chave)!;
          const { data, error } = await supabase.from("clientes").insert(grupo.payload).select("id").maybeSingle();
          if (error || !data) {
            erros.push(`Cliente "${grupo.payload.nome_completo}" (linha ${grupo.linhas[0] + 2}): ${error?.message ?? "falha ao criar"}`);
            return;
          }
          clientesCriados++;
          for (const idx of grupo.linhas) clienteIdPorLinha.set(idx, data.id);
          if (!chave.startsWith("linha:")) cpfParaClienteId.set(chave, data.id);
        })
      );
      setProgresso((p) => (p ? { ...p, processadas: p.processadas + chunk.length } : p));
    }

    // ================= FASE B: agrupar e resolver apolice_id por número =================
    interface GrupoApolice {
      chave: string;
      numero: string | null;
      clienteId: string;
      apolicePayload: Partial<ApoliceInsert>;
      coberturas: CoberturaSemApolice[];
    }

    const gruposApolice = new Map<string, GrupoApolice>();
    for (const l of linhasValidas) {
      const clienteId = clienteIdPorLinha.get(l.idx);
      if (!clienteId) continue; // cliente falhou ao criar; erro já registrado
      const temDadosApolice = Object.keys(l.apolicePayloadParcial).length > 0;
      if (!temDadosApolice && !l.coberturaPayload) continue; // só dados de cliente — não cria apólice
      if (!gruposApolice.has(l.apoliceChave)) {
        gruposApolice.set(l.apoliceChave, {
          chave: l.apoliceChave,
          numero: numeroDaChave(l.apoliceChave),
          clienteId,
          apolicePayload: l.apolicePayloadParcial,
          coberturas: [],
        });
      }
      if (l.coberturaPayload) gruposApolice.get(l.apoliceChave)!.coberturas.push(l.coberturaPayload);
    }

    const numerosDistintos = [...new Set(
      [...gruposApolice.values()].map((g) => g.numero).filter((n): n is string => !!n)
    )];
    const numeroParaApoliceId = new Map<string, string>();

    setProgresso({ etapaLabel: "Consultando apólices existentes", processadas: 0, total: numerosDistintos.length });
    for (let i = 0; i < numerosDistintos.length; i += 300) {
      const chunk = numerosDistintos.slice(i, i + 300);
      const { data, error } = await supabase.from("apolices").select("id, numero_apolice").in("numero_apolice", chunk);
      if (error) {
        erros.push(`Falha ao consultar apólices existentes: ${error.message}`);
      } else {
        for (const row of data ?? []) {
          if (row.numero_apolice) numeroParaApoliceId.set(row.numero_apolice, row.id);
        }
      }
      setProgresso((p) => (p ? { ...p, processadas: p.processadas + chunk.length } : p));
    }
    const apolicesReaproveitadas = numeroParaApoliceId.size;

    const apoliceIdPorChave = new Map<string, string>();
    for (const g of gruposApolice.values()) {
      if (g.numero && numeroParaApoliceId.has(g.numero)) {
        apoliceIdPorChave.set(g.chave, numeroParaApoliceId.get(g.numero)!);
      }
    }

    let apolicesCriadas = 0;
    const gruposParaCriarApolice = [...gruposApolice.values()].filter((g) => !apoliceIdPorChave.has(g.chave));
    setProgresso({ etapaLabel: "Criando apólices novas", processadas: 0, total: gruposParaCriarApolice.length });
    for (let i = 0; i < gruposParaCriarApolice.length; i += 20) {
      const chunk = gruposParaCriarApolice.slice(i, i + 20);
      await Promise.all(
        chunk.map(async (g) => {
          const apolicePayload = { ...g.apolicePayload };
          // "A soma de todas as linhas da apólice vira o Total do rodapé":
          // quando o usuário não mapeou uma coluna de prêmio total da
          // apólice, calculamos a partir da soma das coberturas ativas
          // dessa mesma apólice — nunca sobrescreve um valor mapeado manualmente.
          if (apolicePayload.premio_mensal_total === undefined) {
            const somaAtivas = g.coberturas
              .filter((c) => c.status === "ativa")
              .reduce((soma, c) => soma + Number(c.premio_mensal ?? 0), 0);
            if (somaAtivas > 0) apolicePayload.premio_mensal_total = somaAtivas;
          }
          const payload: ApoliceInsert = { cliente_id: g.clienteId, ...apolicePayload };
          const { data, error } = await supabase.from("apolices").insert(payload).select("id").maybeSingle();
          if (error || !data) {
            erros.push(`Apólice${g.numero ? ` "${g.numero}"` : ""}: ${error?.message ?? "falha ao criar"}`);
            return;
          }
          apolicesCriadas++;
          apoliceIdPorChave.set(g.chave, data.id);
        })
      );
      setProgresso((p) => (p ? { ...p, processadas: p.processadas + chunk.length } : p));
    }

    // ================= Coberturas: 1 insert em lote por grupo =================
    let coberturasCriadas = 0;
    const gruposComCobertura = [...gruposApolice.values()].filter(
      (g) => apoliceIdPorChave.has(g.chave) && g.coberturas.length > 0
    );
    setProgresso({ etapaLabel: "Salvando coberturas", processadas: 0, total: gruposComCobertura.length });
    for (let i = 0; i < gruposComCobertura.length; i += 25) {
      const chunk = gruposComCobertura.slice(i, i + 25);
      await Promise.all(
        chunk.map(async (g) => {
          const apoliceId = apoliceIdPorChave.get(g.chave)!;
          const payload: CoberturaInsert[] = g.coberturas.map((c) => ({ ...c, apolice_id: apoliceId }));
          const { error } = await supabase.from("coberturas").insert(payload);
          if (error) {
            erros.push(`Coberturas da apólice${g.numero ? ` "${g.numero}"` : ""}: ${error.message}`);
            return;
          }
          coberturasCriadas += payload.length;
        })
      );
      setProgresso((p) => (p ? { ...p, processadas: p.processadas + chunk.length } : p));
    }

    setRelatorio({
      totalLinhas: csv.linhas.length,
      clientesCriados,
      clientesReaproveitados,
      apolicesCriadas,
      apolicesReaproveitadas,
      coberturasCriadas,
      linhasRejeitadas,
      erros,
    });
    qc.invalidateQueries({ queryKey: qk.clientes.all });
    qc.invalidateQueries({ queryKey: qk.aniversariantes(30) });
    setProgresso(null);
    setImportando(false);
    setEtapa(4);
  };

  const resetar = () => {
    setCsv(null);
    setMapeamento({});
    setRelatorio(null);
    setProgresso(null);
    setEtapa(1);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Importar clientes" description="Importe clientes, apólices e coberturas a partir de um arquivo CSV ou Excel (.xls, .xlsx, .xlsm).">
        {etapa === 4 && (
          <Button variant="outline" onClick={resetar}>
            Nova importação
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link to="/importar/capital">Atualizar capital das coberturas</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/importar/vencimentos">Importar vencimentos</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/importar/apolices">Importar dados das apólices</Link>
        </Button>
      </PageHeader>

      {/* Stepper */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2">
        {PASSOS.map((p, i) => {
          const ativo = etapa === p.num;
          const concluido = etapa > p.num;
          return (
            <div key={p.num} className="flex items-center gap-2">
              <div className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-smooth", ativo ? "border-primary bg-primary/10 text-primary" : concluido ? "border-primary/40 text-primary" : "text-muted-foreground")}>
                {concluido ? <CheckCircle2 className="size-4" /> : <p.icon className="size-4" />}
                <span className="whitespace-nowrap">{p.label}</span>
              </div>
              {i < PASSOS.length - 1 && <div className="h-px w-6 bg-border sm:w-10" />}
            </div>
          );
        })}
      </div>

      {/* Etapa 1: upload */}
      {etapa === 1 && (
        <Card className="flex flex-col items-center justify-center gap-4 p-10 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Upload className="size-7" />
          </div>
          <div>
            <p className="font-medium">Selecione um arquivo CSV ou Excel</p>
            <p className="mt-1 text-sm text-muted-foreground">O arquivo deve ter cabeçalho na primeira linha. Formatos aceitos: .csv, .xls, .xlsx, .xlsm.</p>
          </div>
          <Input
            type="file"
            accept=".csv,text/csv,.xls,.xlsx,.xlsm,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
            className="max-w-xs"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </Card>
      )}

      {/* Etapa 2: mapeamento */}
      {etapa === 2 && csv && (
        <Card className="p-4 sm:p-6">
          <div className="mb-4">
            <h3 className="font-semibold">Mapear colunas</h3>
            <p className="text-sm text-muted-foreground">
              {csv.linhas.length} linhas detectadas. Associe cada coluna do arquivo a um campo do cliente, da
              apólice, ou da cobertura (a cobertura muda de linha em linha; se o mesmo número de apólice repetir em
              várias linhas, elas formam uma única apólice com várias coberturas).
            </p>
          </div>
          {!nomeCompletoMapeado && (
            <Alert variant="destructive" className="mb-4">
              <TriangleAlert className="size-4" />
              <AlertTitle>Mapeie a coluna de Nome completo</AlertTitle>
              <AlertDescription>
                É obrigatório associar uma coluna do arquivo ao campo <strong>Nome completo *</strong> antes de continuar. Selecione essa opção em uma das colunas abaixo.
              </AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {csv.colunas.map((col) => (
              <div key={col} className="flex items-center gap-2">
                <span className="w-40 shrink-0 truncate text-sm font-medium" title={col}>{col}</span>
                <Select value={mapeamento[col] ?? "__ignore__"} onValueChange={(v) => { if (v) campoMapeado(col, v === "__ignore__" ? "" : v); }}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Ignorar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ignore__">Ignorar</SelectItem>
                    <SelectGroup>
                      <SelectLabel>Dados do cliente</SelectLabel>
                      {CLIENTE_CAMPOS.map((c) => (
                        <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Dados da apólice</SelectLabel>
                      {APOLICE_CAMPOS.map((c) => (
                        <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Cobertura (muda por linha)</SelectLabel>
                      {COBERTURA_CAMPOS.map((c) => (
                        <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={resetar}>Cancelar</Button>
            <Button onClick={() => setEtapa(3)} disabled={!nomeCompletoMapeado}>Pré-visualizar</Button>
          </div>
        </Card>
      )}

      {/* Etapa 3: preview */}
      {etapa === 3 && csv && (
        <Card className="p-4 sm:p-6">
          <div className="mb-4">
            <h3 className="font-semibold">Pré-visualização</h3>
            <p className="text-sm text-muted-foreground">Primeiras 5 linhas já com o mapeamento aplicado.</p>
          </div>
          {!nomeCompletoMapeado && (
            <Alert variant="destructive" className="mb-4">
              <TriangleAlert className="size-4" />
              <AlertTitle>Mapeie a coluna de Nome completo</AlertTitle>
              <AlertDescription>
                Volte ao mapeamento e associe uma coluna ao campo <strong>Nome completo *</strong> antes de importar.
              </AlertDescription>
            </Alert>
          )}

          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Dados do cliente</h4>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {camposClienteMapeados.map(({ coluna, campo }) => (
                    <TableHead key={coluna} className="whitespace-nowrap">{campoPorKey(campo)?.label ?? campo}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrosPreview.map((linha, i) => (
                  <TableRow key={i}>
                    {camposClienteMapeados.map(({ coluna, campo }) => {
                      let valor = (linha[coluna] ?? "").toString();
                      if (campo === "data_nascimento" || campo === "cliente_desde") valor = normalizarData(valor) ?? valor;
                      if (campo === "cpf") valor = limparCpf(valor) ?? valor;
                      return <TableCell key={coluna} className="whitespace-nowrap">{valor}</TableCell>;
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {previewGrupos.length > 0 && (
            <>
              <h4 className="mb-2 mt-6 text-sm font-semibold text-muted-foreground">
                Apólices e coberturas (agrupadas pelo número da apólice)
              </h4>
              <div className="flex flex-col gap-4">
                {previewGrupos.map((grupo) => (
                  <div key={grupo.chave} className="rounded-lg border p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{grupo.numero ? `Apólice ${grupo.numero}` : "Apólice sem número (1 por linha)"}</Badge>
                      {Object.entries(grupo.apolicePayload).map(([campo, valor]) => (
                        <span key={campo} className="text-xs text-muted-foreground">
                          {APOLICE_CAMPO_LABEL[campo] ?? campo}: <strong className="text-foreground">{String(valor)}</strong>
                        </span>
                      ))}
                    </div>
                    {grupo.coberturas.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma cobertura mapeada para este grupo.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Cobertura</TableHead>
                              <TableHead className="text-right">Prêmio</TableHead>
                              <TableHead className="text-right">Capital segurado</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {grupo.coberturas.map((c, i) => (
                              <TableRow key={i}>
                                <TableCell className="whitespace-nowrap">{c.nome}</TableCell>
                                <TableCell className="whitespace-nowrap text-right font-mono text-xs">{formatarMoeda(c.premio)}</TableCell>
                                <TableCell className="whitespace-nowrap text-right font-mono text-xs">{formatarMoeda(c.capital)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {grupo.totalCoberturas > grupo.coberturas.length && (
                          <p className="p-2 text-xs text-muted-foreground">
                            +{grupo.totalCoberturas - grupo.coberturas.length} cobertura(s) a mais nesta apólice
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {importando && progresso && progresso.total > 0 && (
            <div className="mt-6 flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                {progresso.etapaLabel}... ({progresso.processadas}/{progresso.total})
              </p>
              <Progress value={(progresso.processadas / progresso.total) * 100} />
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEtapa(2)} disabled={importando}>Voltar</Button>
            <Button onClick={handleImportar} disabled={importando || !nomeCompletoMapeado}>
              {importando ? "Importando..." : `Importar ${csv.linhas.length} linhas`}
            </Button>
          </div>
        </Card>
      )}

      {/* Etapa 4: conclusão */}
      {etapa === 4 && relatorio && (
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="size-7" />
            </div>
            <div>
              <p className="text-lg font-semibold">Importação concluída</p>
              <p className="text-sm text-muted-foreground">{relatorio.totalLinhas} linha(s) processada(s).</p>
            </div>
            <div className="grid w-full grid-cols-2 gap-3 text-left sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Clientes criados</p>
                <p className="text-lg font-semibold">{relatorio.clientesCriados}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Clientes reaproveitados</p>
                <p className="text-lg font-semibold">{relatorio.clientesReaproveitados}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Apólices criadas</p>
                <p className="text-lg font-semibold">{relatorio.apolicesCriadas}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Apólices reaproveitadas</p>
                <p className="text-lg font-semibold">{relatorio.apolicesReaproveitadas}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Coberturas criadas</p>
                <p className="text-lg font-semibold">{relatorio.coberturasCriadas}</p>
              </div>
              {relatorio.linhasRejeitadas > 0 && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Linhas nunca vigoraram (rejeitadas)</p>
                  <p className="text-lg font-semibold text-muted-foreground">{relatorio.linhasRejeitadas}</p>
                </div>
              )}
            </div>
            {relatorio.erros.length > 0 && (
              <div className="w-full max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-left">
                <p className="mb-1 text-sm font-medium text-destructive">{relatorio.erros.length} aviso(s)/erro(s)</p>
                <ul className="max-h-40 overflow-y-auto text-xs text-muted-foreground">
                  {relatorio.erros.map((e, i) => <li key={i} className="py-0.5">{e}</li>)}
                </ul>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetar}>Nova importação</Button>
              <Button onClick={() => navigate("/clientes")}>Ver clientes</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
