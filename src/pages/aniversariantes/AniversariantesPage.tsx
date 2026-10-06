import { useMemo, useState } from "react";
import { Cake, Pencil, Send } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/Feedback";
import { TemplatesManagerDialog } from "@/components/aniversariantes/TemplatesManagerDialog";
import { ParabenizarDialog } from "@/components/aniversariantes/ParabenizarDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAniversariantes, type Aniversariante } from "@/hooks/useAniversariantes";
import { formatarDataPorExtensoDate } from "@/lib/aniversario";

function chaveData(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function AniversariantesPage() {
  const { data, isLoading, isError, refetch } = useAniversariantes(30);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [parab, setParab] = useState<Aniversariante | null>(null);

  const grupos = useMemo(() => {
    const mapa = new Map<string, { label: string; items: Aniversariante[] }>();
    for (const a of data?.aniversariantes ?? []) {
      const key = chaveData(a.data);
      if (!mapa.has(key)) {
        mapa.set(key, {
          label: a.ehHoje ? "Hoje" : formatarDataPorExtensoDate(a.data),
          items: [],
        });
      }
      mapa.get(key)!.items.push(a);
    }
    return [...mapa.values()];
  }, [data]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Aniversariantes"
        description="Clientes que fazem aniversário hoje ou nos próximos 30 dias."
      >
        <Button variant="outline" onClick={() => setTemplateOpen(true)}>
          <Pencil className="size-4" />
          Editar templates
        </Button>
      </PageHeader>

      {data && data.hojeCount > 0 && (
        <Card className="mb-4 flex items-center gap-3 border-primary/30 bg-primary/5 p-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Cake className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary">
              {data.hojeCount} aniversariant{data.hojeCount === 1 ? "e" : "es"} hoje
            </p>
            <p className="text-xs text-muted-foreground">Não esqueça de parabenizar!</p>
          </div>
        </Card>
      )}

      {isLoading && <LoadingState className="py-16" />}
      {isError && <ErrorState onRetry={() => refetch()} message="Não foi possível carregar os aniversariantes." />}
      {!isLoading && !isError && (data?.aniversariantes.length ?? 0) === 0 && (
        <EmptyState icon={Cake} title="Nenhum aniversariante no período" description="Cadastre datas de nascimento nos clientes para vê-los aqui." />
      )}

      <div className="flex flex-col gap-6">
        {grupos.map((grupo) => (
          <div key={grupo.label} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold capitalize">{grupo.label}</h3>
              <Badge variant="secondary">{grupo.items.length}</Badge>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="flex flex-col gap-2">
              {grupo.items.map((a) => (
                <Card key={a.cliente.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground">
                      {a.cliente.nome_completo.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{a.cliente.nome_completo}</p>
                      <p className="text-xs text-muted-foreground">
                        Faz {a.idade} ano{a.idade === 1 ? "" : "s"}
                        {a.cliente.celular && ` · ${a.cliente.celular}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.cliente.estagio ? (
                      <Badge variant="outline" className="gap-1.5">
                        <span className="size-2 rounded-full" style={{ backgroundColor: a.cliente.estagio.cor }} />
                        {a.cliente.estagio.nome}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Sem estágio</Badge>
                    )}
                    <Button size="sm" onClick={() => setParab(a)}>
                      <Send className="size-3.5" />
                      Parabenizar
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <TemplatesManagerDialog open={templateOpen} onOpenChange={setTemplateOpen} />
      <ParabenizarDialog
        open={!!parab}
        onOpenChange={(o) => !o && setParab(null)}
        aniversariante={parab ? { nome_completo: parab.cliente.nome_completo, celular: parab.cliente.celular } : null}
      />
    </div>
  );
}
