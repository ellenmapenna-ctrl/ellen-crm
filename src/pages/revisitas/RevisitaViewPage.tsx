import { useParams, useNavigate } from "react-router-dom";
import { Pencil } from "lucide-react";
import { LoadingState, ErrorState } from "@/components/shared/Feedback";
import { Button } from "@/components/ui/button";
import { useRevisita } from "@/hooks/useRevisitas";
import { BaixarPdfButton } from "./BaixarPdfButton";
import { BaixarPdfReuniaoButton } from "./BaixarPdfReuniaoButton";
import type { RevisitaFormato } from "@/lib/revisita-template";

function detectarFormato(html: string): RevisitaFormato {
  if (html.includes("van-banner")) return "vanguarda";
  if (html.includes("ess-topline")) return "essencial";
  return "vitrine";
}

export function RevisitaViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useRevisita(id);

  if (isLoading) return <LoadingState className="py-16" />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} message="Não foi possível carregar essa revisita." />;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-center justify-between gap-3 border-b bg-white px-4 py-2.5">
        <p className="truncate text-sm font-medium">{data.cliente_nome}</p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate(`/revisitas/${id}/editar`)}>
            <Pencil className="size-3.5" />
            Editar
          </Button>
          <BaixarPdfButton dados={data.dados} formato={detectarFormato(data.html)} />
          <BaixarPdfReuniaoButton dados={data.dados} formato={detectarFormato(data.html)} clienteId={data.cliente_id} />
        </div>
      </div>
      <iframe title={`Revisita — ${data.cliente_nome}`} srcDoc={data.html} className="w-full flex-1 border-0" />
    </div>
  );
}
