import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SEGURADORAS, juntarSeguradoras, listarSeguradoras } from "@/lib/revisita-opcoes";

interface Props {
  /** Seguradoras separadas por " + " (ex.: "Azos + Icatu"), o mesmo formato usado no documento. */
  value: string;
  onChange: (valor: string) => void;
  /** Texto do botão de adicionar. */
  rotuloAdicionar?: string;
}

/** Seguradoras da revisita como etiquetas, com botão para adicionar mais uma (da lista ou digitando). */
export function SeguradorasField({ value, onChange, rotuloAdicionar = "Adicionar seguradora" }: Props) {
  const [aberto, setAberto] = useState(false);
  const [outra, setOutra] = useState("");
  const escolhidas = listarSeguradoras(value);
  const disponiveis = SEGURADORAS.filter((s) => !escolhidas.some((e) => e.toLowerCase() === s.toLowerCase()));

  const adicionar = (nome: string) => {
    const limpo = nome.trim();
    if (!limpo || escolhidas.some((e) => e.toLowerCase() === limpo.toLowerCase())) return;
    onChange(juntarSeguradoras([...escolhidas, limpo]));
    setOutra("");
    setAberto(false);
  };
  const remover = (nome: string) => onChange(juntarSeguradoras(escolhidas.filter((e) => e !== nome)));

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-white px-2 py-1.5">
      {escolhidas.map((s) => (
        <Badge key={s} variant="secondary" className="gap-1 pr-1">
          {s}
          <button type="button" onClick={() => remover(s)} className="rounded-sm p-0.5 hover:bg-background" aria-label={`Remover ${s}`}>
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground">
            <Plus className="size-3.5" />
            {escolhidas.length === 0 ? "Escolher seguradora" : rotuloAdicionar}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-2">
          <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
            {disponiveis.map((s) => (
              <button key={s} type="button" onClick={() => adicionar(s)} className="rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent">
                {s}
              </button>
            ))}
          </div>
          <form
            className="mt-2 flex gap-1.5 border-t pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              adicionar(outra);
            }}
          >
            <Input value={outra} onChange={(e) => setOutra(e.target.value)} placeholder="Outra seguradora" className="h-8 text-sm" />
            <Button type="submit" size="sm" className="h-8" disabled={!outra.trim()}>
              OK
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
