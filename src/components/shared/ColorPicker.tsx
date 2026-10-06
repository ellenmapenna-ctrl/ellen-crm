import { Check } from "lucide-react";
import { contrasteTexto } from "@/lib/cor";
import { Input } from "@/components/ui/input";

const PRESETS = [
  "#6366f1", "#0ea5e9", "#06b6d4", "#14b8a6", "#22c55e", "#84cc16",
  "#eab308", "#f59e0b", "#f97316", "#ef4444", "#ec4899", "#a855f7",
  "#64748b", "#0f172a",
];

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (cor: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((cor) => {
          const ativo = value.toLowerCase() === cor.toLowerCase();
          return (
            <button
              key={cor}
              type="button"
              onClick={() => onChange(cor)}
              className="flex size-8 items-center justify-center rounded-md border-2 transition-smooth hover:scale-110"
              style={{ backgroundColor: cor, borderColor: ativo ? contrasteTexto(cor) : "transparent" }}
              aria-label={`Cor ${cor}`}
              aria-pressed={ativo}
            >
              {ativo && <Check className="size-4" style={{ color: contrasteTexto(cor) }} />}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value?.match(/^#([0-9a-fA-F]{6})$/) ? value : "#6366f1"}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 cursor-pointer rounded-md border bg-transparent p-0.5"
          aria-label="Seletor de cor"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-32 font-mono"
          placeholder="#RRGGBB"
        />
      </div>
    </div>
  );
}
