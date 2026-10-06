import { useEffect, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/shared/Field";
import { useTemplatesAniversario } from "@/hooks/useMensagensTemplates";
import { substituirPrimeiroNome } from "@/lib/aniversario";
import { abrirWhatsapp, montarLinkWhatsapp } from "@/lib/whatsapp";
import { EmptyState, LoadingState } from "@/components/shared/Feedback";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aniversariante: { nome_completo: string; celular: string | null } | null;
}

export function ParabenizarDialog({ open, onOpenChange, aniversariante }: Props) {
  const { data: templates, isLoading } = useTemplatesAniversario();
  const [templateId, setTemplateId] = useState<string>("");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    if (!open || !templates || templates.length === 0) return;
    const escolhido = templates.find((t) => t.id === templateId) ?? templates[0];
    setTemplateId(escolhido.id);
    setMensagem(substituirPrimeiroNome(escolhido.corpo, aniversariante?.nome_completo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templates, aniversariante?.nome_completo]);

  const handleTrocarTemplate = (id: string) => {
    setTemplateId(id);
    const escolhido = templates?.find((t) => t.id === id);
    if (escolhido) setMensagem(substituirPrimeiroNome(escolhido.corpo, aniversariante?.nome_completo));
  };

  const temCelular = !!montarLinkWhatsapp(aniversariante?.celular);

  const handleEnviar = () => {
    if (!temCelular) {
      toast.error("Cliente sem celular válido para WhatsApp.");
      return;
    }
    abrirWhatsapp(aniversariante?.celular, mensagem);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Parabenizar {aniversariante?.nome_completo?.split(" ")[0] ?? ""}</DialogTitle>
          <DialogDescription>Revise a mensagem antes de enviar. O envio final é manual, dentro do WhatsApp.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <LoadingState />
        ) : !templates || templates.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="Nenhum template cadastrado"
            description="Crie um template de aniversário em 'Editar templates' antes de enviar."
          />
        ) : (
          <div className="flex flex-col gap-4">
            <Field label="Template">
              <Select value={templateId} onValueChange={handleTrocarTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Textarea rows={6} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
            <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageCircle className="size-3.5" />
                {temCelular ? "WhatsApp pronto para abrir" : "Celular inválido/ausente"}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
                <Button type="button" onClick={handleEnviar} disabled={!temCelular}>
                  <Send className="size-4" />
                  Enviar no WhatsApp
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
