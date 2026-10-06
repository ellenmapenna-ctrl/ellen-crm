import { type FormEvent, type ReactNode, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { REVISITAS_SENHA } from "@/lib/revisitas";

const CHAVE_SESSAO = "revisitas_unlocked";

export function RevisitasGate({ children }: { children: ReactNode }) {
  const [liberado, setLiberado] = useState(() => sessionStorage.getItem(CHAVE_SESSAO) === "1");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(false);

  if (liberado) return <>{children}</>;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (senha === REVISITAS_SENHA) {
      sessionStorage.setItem(CHAVE_SESSAO, "1");
      setLiberado(true);
    } else {
      setErro(true);
    }
  };

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Lock className="size-5" />
      </div>
      <div>
        <h2 className="font-semibold">Revisão Anual</h2>
        <p className="text-sm text-muted-foreground">Área com dados de clientes. Digite a senha para continuar.</p>
      </div>
      <Card className="w-full p-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            type="password"
            autoFocus
            value={senha}
            onChange={(e) => {
              setSenha(e.target.value);
              setErro(false);
            }}
            placeholder="Senha"
          />
          {erro && <p className="text-xs text-destructive">Senha incorreta.</p>}
          <Button type="submit">Entrar</Button>
        </form>
      </Card>
    </div>
  );
}
