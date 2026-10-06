import { useState } from "react";
import { Pencil, Plus, Tags as TagsIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState, LoadingState, ErrorState } from "@/components/shared/Feedback";
import { TagBadge } from "@/components/shared/TagBadge";
import { TagFormDialog } from "@/components/tags/TagFormDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTags } from "@/hooks/useTags";
import type { Tag } from "@/lib/types";

export function TagsPage() {
  const { data: tags, isLoading, isError, refetch } = useTags();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tag | null>(null);

  const abrirNovo = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const abrirEdicao = (tag: Tag) => {
    setEditing(tag);
    setDialogOpen(true);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Tags" description="Etiquetas para classificar e filtrar clientes.">
        <Button onClick={abrirNovo}>
          <Plus className="size-4" />
          Nova tag
        </Button>
      </PageHeader>

      {isLoading && <LoadingState className="py-16" />}
      {isError && <ErrorState onRetry={() => refetch()} message="Não foi possível carregar as tags." />}
      {!isLoading && !isError && tags?.length === 0 && (
        <EmptyState
          icon={TagsIcon}
          title="Nenhuma tag cadastrada"
          description="Crie tags para organizar sua carteira (ex.: VIP, Auto, Vida)."
          action={<Button onClick={abrirNovo}><Plus className="size-4" />Nova tag</Button>}
        />
      )}

      {tags && tags.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag) => (
            <Card key={tag.id} className="flex items-center justify-between gap-3 p-3 transition-smooth hover:shadow-soft">
              <div className="flex min-w-0 flex-col gap-1.5">
                <TagBadge tag={tag} />
                <span className="text-xs text-muted-foreground">
                  {tag.categoria ?? "Sem categoria"}
                </span>
              </div>
              <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => abrirEdicao(tag)} aria-label={`Editar tag ${tag.nome}`}>
                <Pencil className="size-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <TagFormDialog open={dialogOpen} onOpenChange={setDialogOpen} tag={editing} />
    </div>
  );
}
