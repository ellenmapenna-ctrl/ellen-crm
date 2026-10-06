import { useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  addDays,
  addWeeks,
  endOfWeek,
  format,
  isToday,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheck, ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/Feedback";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CompromissoFormDialog } from "@/components/agenda/CompromissoFormDialog";
import { useCompromissosPeriodo, useUpdateCompromisso } from "@/hooks/useCompromissos";
import { ETAPA_OPCOES, etapaInfo } from "@/lib/etapas";
import { buscarEventosGoogle, conectarGoogle, desconectarGoogle, tokenGoogleValido, type GoogleEvento } from "@/lib/googleCalendar";
import { cn } from "@/lib/utils";
import type { CompromissoWithCliente } from "@/lib/types";

const HORA_INICIAL = 7;
const HORA_FINAL = 20;
const ALTURA_HORA = 52;

function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

export function AgendaPage() {
  const [dataRef, setDataRef] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [compromissoEdit, setCompromissoEdit] = useState<CompromissoWithCliente | null>(null);
  const [dataParaNovo, setDataParaNovo] = useState<string | undefined>(undefined);
  const updateMut = useUpdateCompromisso();

  const [googleToken, setGoogleToken] = useState<string | null>(() => tokenGoogleValido());
  const [googleConectando, setGoogleConectando] = useState(false);
  const [googleCarregando, setGoogleCarregando] = useState(false);
  const [googleEventos, setGoogleEventos] = useState<GoogleEvento[]>([]);

  const inicioSemana = startOfWeek(dataRef, { weekStartsOn: 1 });
  const fimSemana = endOfWeek(dataRef, { weekStartsOn: 1 });
  const dias = Array.from({ length: 7 }, (_, i) => addDays(inicioSemana, i));

  const inicioIso = format(inicioSemana, "yyyy-MM-dd");
  const fimIso = format(fimSemana, "yyyy-MM-dd");
  const { data: compromissos, isLoading } = useCompromissosPeriodo(inicioIso, fimIso);

  useEffect(() => {
    if (!googleToken) {
      setGoogleEventos([]);
      return;
    }
    let cancelado = false;
    setGoogleCarregando(true);
    buscarEventosGoogle(googleToken, inicioIso, fimIso)
      .then((eventos) => {
        if (!cancelado) setGoogleEventos(eventos);
      })
      .catch((err) => {
        if (cancelado) return;
        if (!tokenGoogleValido()) setGoogleToken(null);
        toast.error("Erro ao buscar eventos do Google.", { description: err instanceof Error ? err.message : String(err) });
      })
      .finally(() => {
        if (!cancelado) setGoogleCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [googleToken, inicioIso, fimIso]);

  const handleConectarGoogle = async () => {
    setGoogleConectando(true);
    try {
      const token = await conectarGoogle();
      setGoogleToken(token);
      toast.success("Google Agenda conectado.");
    } catch (err) {
      toast.error("Não foi possível conectar.", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setGoogleConectando(false);
    }
  };

  const handleDesconectarGoogle = () => {
    desconectarGoogle();
    setGoogleToken(null);
    toast.success("Google Agenda desconectado.");
  };

  const googlePorDia = useMemo(() => {
    const map = new Map<string, GoogleEvento[]>();
    for (const e of googleEventos) {
      const arr = map.get(e.data) ?? [];
      arr.push(e);
      map.set(e.data, arr);
    }
    return map;
  }, [googleEventos]);

  const porDia = useMemo(() => {
    const map = new Map<string, CompromissoWithCliente[]>();
    for (const c of compromissos ?? []) {
      const arr = map.get(c.data) ?? [];
      arr.push(c);
      map.set(c.data, arr);
    }
    return map;
  }, [compromissos]);

  const placar = useMemo(() => {
    const lista = compromissos ?? [];
    const contarTipo = (tipo: string | null) => {
      const doTipo = tipo ? lista.filter((c) => c.tipo === tipo) : lista;
      return { realizados: doTipo.filter((c) => c.realizado).length, total: doTipo.length };
    };
    return {
      total: contarTipo(null),
      porEtapa: ETAPA_OPCOES.map((o) => ({ ...o, ...contarTipo(o.key) })),
    };
  }, [compromissos]);

  const horas = Array.from({ length: HORA_FINAL - HORA_INICIAL + 1 }, (_, i) => HORA_INICIAL + i);

  const abrirNovo = (dataIso?: string) => {
    setCompromissoEdit(null);
    setDataParaNovo(dataIso ?? format(dataRef, "yyyy-MM-dd"));
    setDialogOpen(true);
  };
  const abrirEdicao = (c: CompromissoWithCliente) => {
    setCompromissoEdit(c);
    setDataParaNovo(undefined);
    setDialogOpen(true);
  };

  const toggleRealizado = (c: CompromissoWithCliente, e: MouseEvent) => {
    e.stopPropagation();
    updateMut.mutate({ id: c.id, realizado: !c.realizado });
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Agenda" description="Compromissos da semana, por linha de negócio.">
        <Button variant="outline" size="sm" onClick={() => setDataRef(new Date())}>
          Hoje
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setDataRef((d) => subWeeks(d, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setDataRef((d) => addWeeks(d, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <span className="text-sm font-medium capitalize">
          {format(inicioSemana, "d 'de' MMM", { locale: ptBR })} – {format(fimSemana, "d 'de' MMM 'de' yyyy", { locale: ptBR })}
        </span>
        <Button onClick={() => abrirNovo()}>
          <Plus className="size-4" />
          Compromisso
        </Button>
        {googleToken ? (
          <Button variant="outline" size="sm" onClick={handleDesconectarGoogle} className="text-emerald-600">
            {googleCarregando ? <RefreshCw className="size-4 animate-spin" /> : <CalendarCheck className="size-4" />}
            Google conectado
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={handleConectarGoogle} disabled={googleConectando}>
            <CalendarCheck className="size-4" />
            {googleConectando ? "Conectando..." : "Conectar Google"}
          </Button>
        )}
      </PageHeader>

      {/* Placar da semana */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Card className="p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="text-lg font-bold tabular-nums">
            {placar.total.realizados}<span className="text-sm text-muted-foreground">/{placar.total.total}</span>
          </p>
        </Card>
        {placar.porEtapa.map((o) => (
          <Card key={o.key} className="p-3">
            <p className={cn("mb-1 flex items-center gap-1 text-[11px] font-semibold", o.colorClass)}>
              <o.icon className="size-3" />
              {o.label}
            </p>
            <p className="text-lg font-bold tabular-nums">
              {o.realizados}<span className="text-sm text-muted-foreground">/{o.total}</span>
            </p>
          </Card>
        ))}
      </div>

      {isLoading && <LoadingState className="py-16" />}

      {!isLoading && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Cabeçalho dos dias */}
              <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b bg-muted/40">
                <div />
                {dias.map((d) => (
                  <div key={d.toISOString()} className="border-l px-2 py-2 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {format(d, "EEE", { locale: ptBR })}
                    </p>
                    <p className={cn("text-sm font-semibold", isToday(d) && "inline-flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground")}>
                      {format(d, "d")}
                    </p>
                  </div>
                ))}
              </div>

              {/* Grade de horas */}
              <div className="relative grid grid-cols-[56px_repeat(7,1fr)]">
                <div>
                  {horas.map((h) => (
                    <div key={h} style={{ height: ALTURA_HORA }} className="border-b px-1.5 pt-1 text-right text-[10px] text-muted-foreground">
                      {String(h).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>
                {dias.map((d) => {
                  const dataIso = format(d, "yyyy-MM-dd");
                  const doDia = porDia.get(dataIso) ?? [];
                  return (
                    <div
                      key={dataIso}
                      className="relative border-l"
                      style={{ height: horas.length * ALTURA_HORA }}
                      onClick={() => abrirNovo(dataIso)}
                    >
                      {horas.map((h) => (
                        <div key={h} style={{ height: ALTURA_HORA }} className="cursor-pointer border-b hover:bg-accent/40" />
                      ))}
                      {doDia.map((c) => {
                        const inicioMin = horaParaMinutos(c.hora_inicio);
                        const fimMin = c.hora_fim ? horaParaMinutos(c.hora_fim) : inicioMin + 60;
                        const top = ((inicioMin - HORA_INICIAL * 60) / 60) * ALTURA_HORA;
                        const altura = Math.max(((fimMin - inicioMin) / 60) * ALTURA_HORA, 22);
                        const info = etapaInfo(c.tipo);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirEdicao(c);
                            }}
                            style={{ top, height: altura }}
                            className={cn(
                              "absolute left-1 right-1 overflow-hidden rounded-md border px-1.5 py-1 text-left text-[11px] shadow-sm transition-opacity",
                              c.realizado ? "opacity-50" : "opacity-100",
                              info ? "border-current bg-current/10" : "border-primary bg-primary/10"
                            )}
                          >
                            <div className={cn("flex items-center gap-1 font-semibold", info?.colorClass ?? "text-primary")}>
                              <span
                                className="size-2.5 shrink-0 cursor-pointer rounded-sm border"
                                onClick={(e) => toggleRealizado(c, e)}
                                title={c.realizado ? "Marcar como não realizado" : "Marcar como realizado"}
                              >
                                {c.realizado && <span className="block size-full bg-current" />}
                              </span>
                              <span className="truncate">{c.hora_inicio.slice(0, 5)} {c.titulo}</span>
                            </div>
                            {c.cliente && <p className="truncate text-muted-foreground">{c.cliente.nome_completo}</p>}
                          </button>
                        );
                      })}
                      {(googlePorDia.get(dataIso) ?? [])
                        .filter((e) => !e.diaInteiro && e.horaInicio)
                        .map((e) => {
                          const inicioMin = horaParaMinutos(e.horaInicio!);
                          const fimMin = e.horaFim ? horaParaMinutos(e.horaFim) : inicioMin + 60;
                          const top = ((inicioMin - HORA_INICIAL * 60) / 60) * ALTURA_HORA;
                          const altura = Math.max(((fimMin - inicioMin) / 60) * ALTURA_HORA, 22);
                          return (
                            <div
                              key={e.id}
                              onClick={(ev) => ev.stopPropagation()}
                              style={{ top, height: altura }}
                              title="Evento do Google Agenda (somente leitura)"
                              className="absolute left-1 right-1 overflow-hidden rounded-md border border-blue-400 bg-blue-400/10 px-1.5 py-1 text-left text-[11px] text-blue-700 shadow-sm"
                            >
                              <span className="truncate font-semibold">{e.horaInicio} {e.titulo}</span>
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

      <CompromissoFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        dataInicial={dataParaNovo}
        compromisso={compromissoEdit}
      />
    </div>
  );
}
