import {
  CalendarClock,
  CheckCircle2,
  HelpCircle,
  MessageCircle,
  Phone,
  PhoneMissed,
  PhoneOff,
  Voicemail,
  XCircle,
  type LucideIcon,
} from "lucide-react";

// Réplica do dropdown "Status da ligação" do GlobalCRM (referência), com
// "Agendou OI" e "Agendou PC" renomeados pra terminologia própria da Ellen.

/** Data de hoje no formato yyyy-mm-dd, no fuso local (sem hora). */
export function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface StatusLigacaoOpcao {
  key: string;
  label: string;
  icon: LucideIcon;
  colorClass: string;
}

export const STATUS_LIGACAO_OPCOES: StatusLigacaoOpcao[] = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, colorClass: "text-emerald-600" },
  { key: "atendida", label: "Ligação atendida", icon: Phone, colorClass: "text-blue-600" },
  { key: "nao_atendida", label: "Ligação não atendida", icon: PhoneMissed, colorClass: "text-rose-600" },
  { key: "caixa_postal", label: "Caixa postal", icon: Voicemail, colorClass: "text-pink-600" },
  { key: "ocupado", label: "Ocupado", icon: PhoneOff, colorClass: "text-rose-600" },
  { key: "pediu_retornar", label: "Pediu para retornar", icon: CalendarClock, colorClass: "text-amber-600" },
  { key: "agendou_reuniao_01", label: "Agendou reunião 01", icon: CalendarClock, colorClass: "text-orange-600" },
  { key: "follow_up", label: "Follow up", icon: CheckCircle2, colorClass: "text-emerald-600" },
  { key: "agendou_revisita", label: "Agendou Revisita", icon: HelpCircle, colorClass: "text-purple-600" },
  { key: "sem_interesse", label: "Sem interesse", icon: XCircle, colorClass: "text-rose-600" },
];

export function statusLigacaoInfo(key: string | null | undefined): StatusLigacaoOpcao | null {
  if (!key) return null;
  return STATUS_LIGACAO_OPCOES.find((o) => o.key === key) ?? null;
}

/** Status que contam como "ligação feita" nas estatísticas do dia (qualquer resultado registrado). */
export function contaComoLigacaoFeita(key: string | null | undefined): boolean {
  return !!key;
}

/** Status que contam como "atendida" (a pessoa de fato falou, não caiu em caixa postal/ocupado/não atendeu). */
const STATUS_ATENDIDA: readonly string[] = [
  "atendida",
  "pediu_retornar",
  "agendou_reuniao_01",
  "follow_up",
  "agendou_revisita",
  "sem_interesse",
];
export function contaComoAtendida(key: string | null | undefined): boolean {
  return !!key && STATUS_ATENDIDA.includes(key);
}

/** Status que contam como "agendamento". */
const STATUS_AGENDAMENTO: readonly string[] = ["agendou_reuniao_01", "follow_up", "agendou_revisita"];
export function contaComoAgendamento(key: string | null | undefined): boolean {
  return !!key && STATUS_AGENDAMENTO.includes(key);
}
