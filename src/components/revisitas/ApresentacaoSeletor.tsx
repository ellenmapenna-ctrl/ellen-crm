import { ChevronDown, Presentation } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { APRESENTACOES } from "@/lib/apresentacoes";

interface Props {
  value: string[];
  onChange: (keys: string[]) => void;
}

/** Botão com a lista de apresentações de seguradora disponíveis (Azos etc.); a escolha vai junto com a revisita. */
export function ApresentacaoSeletor({ value, onChange }: Props) {
  const alternar = (key: string, marcado: boolean) => onChange(marcado ? [...new Set([...value, key])] : value.filter((k) => k !== key));
  const escolhidas = APRESENTACOES.filter((a) => value.includes(a.key));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <Presentation className="size-4" />
            Apresentação da seguradora
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {APRESENTACOES.map((a) => (
            <DropdownMenuCheckboxItem key={a.key} checked={value.includes(a.key)} onCheckedChange={(v) => alternar(a.key, v === true)} onSelect={(e) => e.preventDefault()}>
              {a.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {escolhidas.length === 0 ? (
        <span className="text-xs text-muted-foreground">Nenhuma escolhida</span>
      ) : (
        escolhidas.map((a) => (
          <Badge key={a.key} variant="secondary">
            {a.label}
          </Badge>
        ))
      )}
    </div>
  );
}
