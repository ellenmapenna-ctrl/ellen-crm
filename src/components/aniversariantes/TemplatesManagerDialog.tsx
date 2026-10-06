import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, LoadingState } from "@/components/shared/Feedback";
import { TemplateFormDialog } from "@/components/aniversariantes/TemplateFormDialog";
import { useTemplatesAniversario } from "@/hooks/useMensagensTemplates";
import type { MensagemTemplate } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplatesManagerDialog({ open, onOpenChange }: Props) {
  const { data: templates, isLoading } = useTemplatesAniversario();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MensagemTemplate | null>(null);

  const abrirNovo = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const abrirEdicao = (template: MensagemTemplate) => {
    setEditing(template);
    setFormOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Templates de aniversário</DialogTitle>
            <DialogDescription>
              Crie quantas versões quiser (ex.: mais formal, mais próximo, curta e direta) e escolha qual usar na hora de parabenizar.
            </DialogDescription>
          </DialogHeader>

          {isLoading && <LoadingState className="py-8" />}

          {!isLoading && (templates?.length ?? 0) === 0 && (
            <EmptyState
              icon={Pencil}
              title="Nenhum template ainda"
              description="Crie o primeiro modelo de mensagem de aniversário."
              action={<Button onClick={abrirNovo}><Plus className="size-4" />Novo template</Button>}
            />
          )}

          {!isLoading && (templates?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-2">
              {templates!.map((t) => (
                <Card key={t.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{t.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.corpo}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => abrirEdicao(t)} aria-label={`Editar template ${t.nome}`}>
                    <Pencil className="size-4" />
                  </Button>
                </Card>
              ))}
              <Button variant="outline" className="mt-2" onClick={abrirNovo}>
                <Plus className="size-4" />
                Novo template
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <TemplateFormDialog open={formOpen} onOpenChange={setFormOpen} template={editing} />
    </>
  );
}
