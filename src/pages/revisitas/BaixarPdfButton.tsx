// Botão "Baixar PDF" reutilizado na lista, na visualização e na edição de uma
// revisita já salva. O clique principal baixa direto o quadro comparativo
// (gerado a partir dos dados salvos). Os arquivos originais (apólice, tabela
// de resgate, apresentação) não ficam guardados em lugar nenhum, então quem
// quiser o PDF completo usa o botão de clipe ao lado, que pede os anexos.
import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Paperclip, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { RevisitaDados, RevisitaFormato } from "@/lib/revisita-template";

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</p>;
}

function ListaArquivos({ arquivos, onChange, rotuloAdicionar }: { arquivos: (File | null)[]; onChange: (v: (File | null)[]) => void; rotuloAdicionar: string }) {
  return (
    <div className="flex flex-col gap-2">
      {arquivos.map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            type="file"
            accept="application/pdf"
            onChange={(e) => onChange(arquivos.map((p, idx) => (idx === i ? e.target.files?.[0] ?? null : p)))}
          />
          {arquivos.length > 1 && (
            <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => onChange(arquivos.filter((_, idx) => idx !== i))}>
              <X className="size-4" />
            </Button>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => onChange([...arquivos, null])}>
        <Plus className="size-4" />
        {rotuloAdicionar}
      </Button>
    </div>
  );
}

export function BaixarPdfButton({
  dados,
  formato,
  variant = "outline",
  size,
}: {
  dados: RevisitaDados;
  formato: RevisitaFormato;
  variant?: "outline" | "default" | "ghost";
  size?: "sm" | "default";
}) {
  const [aberto, setAberto] = useState(false);
  const [apolicePdfs, setApolicePdfs] = useState<(File | null)[]>([null]);
  const [tabelaResgatePdf, setTabelaResgatePdf] = useState<File | null>(null);
  const [apresentacaoPdfs, setApresentacaoPdfs] = useState<(File | null)[]>([null]);
  const [baixando, setBaixando] = useState(false);
  const iconeClasse = size === "sm" ? "size-3.5" : "size-4";

  const temLinhaResgateAtiva = dados.coberturas.some((c) => normalizar(c.titulo).includes("resgate") && !(c.atualSemCobertura && c.novoSemCobertura));
  const apolicesValidas = apolicePdfs.filter((f): f is File => !!f);
  const apresentacoesValidas = apresentacaoPdfs.filter((f): f is File => !!f);

  const baixar = async (anexos: boolean) => {
    setBaixando(true);
    try {
      const { baixarRevisitaPdf } = await import("@/lib/revisita-pdf");
      await baixarRevisitaPdf({
        apolices: anexos ? apolicesValidas : [],
        tabelaResgate: anexos ? tabelaResgatePdf : null,
        apresentacoes: anexos ? apresentacoesValidas : [],
        dados,
        formato,
      });
      if (anexos) setAberto(false);
    } catch (err) {
      toast.error("Não foi possível gerar o PDF.", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBaixando(false);
    }
  };

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => baixar(false)} disabled={baixando}>
        {baixando && !aberto ? <Loader2 className={cn("animate-spin", iconeClasse)} /> : <Download className={iconeClasse} />}
        {baixando && !aberto ? "Gerando..." : "Baixar PDF comparação"}
      </Button>
      <Button
        type="button"
        variant={variant}
        size={size === "sm" ? "sm" : "icon"}
        onClick={() => setAberto(true)}
        disabled={baixando}
        title="Baixar PDF da comparação incluindo arquivos que você anexar"
        aria-label="Baixar PDF da comparação incluindo arquivos que você anexar"
      >
        <Paperclip className={iconeClasse} />
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Baixar PDF completo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Para o PDF só com o quadro comparativo, use o botão "Baixar PDF". Aqui você monta o PDF completo: os arquivos originais não ficam salvos no sistema, então envie o que quiser incluir (tudo é opcional). Ordem do PDF final: apólice, tabela de resgate, apresentação da seguradora e comparativo.
          </p>
          <div className="flex flex-col gap-2">
            <Rotulo>Apólice atual (opcional, PDF)</Rotulo>
            <ListaArquivos arquivos={apolicePdfs} onChange={setApolicePdfs} rotuloAdicionar="Adicionar outro arquivo" />
          </div>
          {temLinhaResgateAtiva && (
            <div className="flex flex-col gap-2">
              <Rotulo>Tabela de evolução/resgate (opcional, PDF ou imagem)</Rotulo>
              <Input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setTabelaResgatePdf(e.target.files?.[0] ?? null)} />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Rotulo>Apresentação da seguradora (opcional, PDF)</Rotulo>
            <ListaArquivos arquivos={apresentacaoPdfs} onChange={setApresentacaoPdfs} rotuloAdicionar="Adicionar outra apresentação" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => baixar(true)} disabled={baixando}>
              {baixando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {baixando ? "Montando o PDF..." : "Baixar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
