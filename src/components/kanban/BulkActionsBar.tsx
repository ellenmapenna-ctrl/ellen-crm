import { CheckCheck, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  count: number;
  busy?: boolean;
  onClear: () => void;
  onMarcarContatado: () => void;
  onAbrirWhatsapp: () => void;
}

export function BulkActionsBar({ count, busy, onClear, onMarcarContatado, onAbrirWhatsapp }: Props) {
  if (count === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-3xl items-center gap-2 px-4 pb-4">
      <div className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card/95 p-3 shadow-elegant backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {count}
          </span>
          <span className="text-sm font-medium">
            {count === 1 ? "cliente selecionado" : "clientes selecionados"}
          </span>
          <Button type="button" variant="ghost" size="icon" className="size-7" onClick={onClear} aria-label="Limpar seleção">
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onMarcarContatado} disabled={busy}>
            <CheckCheck className="size-4" />
            Marcar como contatado
          </Button>
          <Button type="button" size="sm" onClick={onAbrirWhatsapp} disabled={busy}>
            <MessageCircle className="size-4" />
            Abrir WhatsApp
          </Button>
        </div>
      </div>
    </div>
  );
}
