import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CalendarClock, Copy, ExternalLink, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState, LoadingState } from "@/components/shared/Feedback";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useClientes } from "@/hooks/useClientes";
import { useRevisitas, useDuplicarRevisita, useExcluirRevisita, type RevisitaRow } from "@/hooks/useRevisitas";
import { REVISITAS } from "@/lib/revisitas";
import { abrirWhatsapp } from "@/lib/whatsapp";
import { BaixarPdfButton } from "./BaixarPdfButton";
import { BaixarPdfReuniaoButton } from "./BaixarPdfReuniaoButton";
import type { RevisitaFormato } from "@/lib/revisita-template";

function detectarFormato(html: string): RevisitaFormato {
  if (html.includes("van-banner")) return "vanguarda";
  if (html.includes("ess-topline")) return "essencial";
  return "vitrine";
}

function normalizar(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function formatarDataIso(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarDataHora(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

interface ItemLista {
  id: string;
  clienteNome: string;
  resumo: string;
  dataTexto: string;
  timestamp: number;
  celular: string | null | undefined;
  abrir: () => void;
  linha?: RevisitaRow;
}

export function RevisitasPage() {
  const navigate = useNavigate();
  const { data: clientes } = useClientes();
  const { data: revisitasDb, isLoading } = useRevisitas();
  const duplicar = useDuplicarRevisita();
  const excluir = useExcluirRevisita();
  const [excluindo, setExcluindo] = useState<ItemLista | null>(null);

  const itens = useMemo<ItemLista[]>(() => {
    const legado: ItemLista[] = REVISITAS.map((doc) => {
      const cliente = clientes?.find((c) => normalizar(c.nome_completo) === normalizar(doc.clienteNome));
      return {
        id: doc.id,
        clienteNome: doc.clienteNome,
        resumo: doc.resumo,
        dataTexto: formatarDataIso(doc.dataGeracao),
        timestamp: new Date(doc.dataGeracao).getTime(),
        celular: cliente?.celular,
        abrir: () => window.open(doc.arquivo, "_blank", "noopener,noreferrer"),
      };
    });
    const geradas: ItemLista[] = (revisitasDb ?? []).map((r) => ({
      id: r.id,
      clienteNome: r.cliente_nome,
      resumo: r.dados?.recomendacaoHeadline ?? `${r.dados?.seguradoraAtual ?? "Atual"} x ${r.dados?.seguradoraNova ?? "Nova"}`,
      dataTexto: formatarDataHora(r.created_at),
      timestamp: r.created_at ? new Date(r.created_at).getTime() : 0,
      celular: clientes?.find((c) => c.id === r.cliente_id)?.celular,
      abrir: () => navigate(`/revisitas/${r.id}`),
      linha: r,
    }));
    return [...geradas, ...legado].sort((a, b) => b.timestamp - a.timestamp);
  }, [clientes, revisitasDb, navigate]);

  const handleDuplicar = async (linha: RevisitaRow) => {
    try {
      const nova = await duplicar.mutateAsync(linha);
      toast.success("Revisita duplicada.");
      if (nova) navigate(`/revisitas/${nova.id}/editar`);
    } catch (err) {
      toast.error("Não foi possível duplicar.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const confirmarExclusao = async () => {
    if (!excluindo?.linha) return;
    try {
      await excluir.mutateAsync(excluindo.linha.id);
      toast.success("Revisita excluída.");
      setExcluindo(null);
    } catch (err) {
      toast.error("Não foi possível excluir.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Revisão Anual"
        description="Documentos de revisita de apólice (Prudential x Azos) prontos para apresentar ao cliente. Área protegida por senha — não compartilhe o link diretamente."
      >
        <Button onClick={() => navigate("/revisitas/nova")}>
          <Plus className="size-4" />
          Nova Revisita
        </Button>
      </PageHeader>

      {isLoading && <LoadingState className="py-16" />}

      {!isLoading && itens.length === 0 && (
        <EmptyState
          icon={CalendarClock}
          title="Nenhuma revisita ainda"
          description="Gere um comparativo Prudential x Azos para um cliente e ele aparece aqui."
        />
      )}

      <div className="flex flex-col gap-2">
        {itens.map((item) => (
          <Card key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium">{item.clienteNome}</p>
              <p className="text-xs text-muted-foreground">{item.resumo}</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline">Gerado em {item.dataTexto}</Badge>
                {!item.celular && <Badge variant="outline">Cliente não encontrado na carteira</Badge>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={item.abrir}>
                <ExternalLink className="size-3.5" />
                Abrir
              </Button>
              <Button
                size="sm"
                disabled={!item.celular}
                onClick={() =>
                  abrirWhatsapp(
                    item.celular,
                    `Olá, ${item.clienteNome.split(" ")[0]}! Segue em anexo a revisão da sua apólice com a comparação de mercado que conversamos.`
                  )
                }
              >
                <Send className="size-3.5" />
                Abrir conversa
              </Button>
              {item.linha && (
                <>
                  <BaixarPdfButton size="sm" variant="ghost" dados={item.linha.dados} formato={detectarFormato(item.linha.html)} />
                  <BaixarPdfReuniaoButton size="sm" variant="ghost" dados={item.linha.dados} formato={detectarFormato(item.linha.html)} clienteId={item.linha.cliente_id} />
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/revisitas/${item.linha!.id}/editar`)}>
                    <Pencil className="size-3.5" />
                    Editar
                  </Button>
                  <Button size="sm" variant="ghost" disabled={duplicar.isPending} onClick={() => handleDuplicar(item.linha!)}>
                    <Copy className="size-3.5" />
                    Duplicar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setExcluindo(item)}>
                    <Trash2 className="size-3.5" />
                    Excluir
                  </Button>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={!!excluindo}
        onOpenChange={(o) => !o && setExcluindo(null)}
        title="Excluir revisita?"
        description={`A revisita de "${excluindo?.clienteNome}" será removida definitivamente.`}
        confirmText="Excluir"
        destructive
        onConfirm={confirmarExclusao}
      />
    </div>
  );
}
