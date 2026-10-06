import { Check, ExternalLink, MessageCircle, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { abrirWhatsapp, montarLinkWhatsapp } from "@/lib/whatsapp";

interface ClienteSelecionado {
  id: string;
  nome_completo: string;
  celular: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: ClienteSelecionado[];
}

export function WhatsappBulkDialog({ open, onOpenChange, clientes }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="size-5 text-primary" />
            Abrir WhatsApp em lote
          </DialogTitle>
          <DialogDescription>
            {clientes.length} cliente{clientes.length === 1 ? "" : "s"} selecionado{clientes.length === 1 ? "" : "s"}. Abra cada conversa individualmente — o envio é manual.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-3">
          <ul className="flex flex-col gap-2">
            {clientes.map((c) => {
              const link = montarLinkWhatsapp(c.celular);
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.nome_completo}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.celular || "Sem celular"}
                    </p>
                  </div>
                  {link ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => abrirWhatsapp(c.celular)}
                    >
                      <ExternalLink className="size-3.5" />
                      Abrir
                    </Button>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Check className="size-3.5 opacity-0" />
                      Indisponível
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </ScrollArea>
        <div className="mt-2 flex items-center justify-between rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5" />
            Abrir um por vez evita bloqueio de pop-up do navegador.
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Concluir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
