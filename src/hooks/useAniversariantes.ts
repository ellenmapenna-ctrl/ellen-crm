import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/query-keys";
import type { AniversarianteRow } from "@/lib/types";
import { idadeQueFara, proximaDataAniversario } from "@/lib/aniversario";

export interface Aniversariante {
  cliente: AniversarianteRow;
  data: Date;
  idade: number;
  ehHoje: boolean;
}

export interface AniversariantesResultado {
  aniversariantes: Aniversariante[];
  hojeCount: number;
}

export function useAniversariantes(diasJanela = 30) {
  return useQuery({
    queryKey: qk.aniversariantes(diasJanela),
    queryFn: async (): Promise<AniversariantesResultado> => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome_completo, data_nascimento, celular, estagio:kanban_estagios(nome, cor)")
        .not("data_nascimento", "is", null);
      if (error) throw error;

      const rows = (data ?? []) as unknown as AniversarianteRow[];
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const limite = new Date(hoje);
      limite.setDate(limite.getDate() + diasJanela);

      const aniversariantes: Aniversariante[] = [];
      for (const cliente of rows) {
        const prox = proximaDataAniversario(cliente.data_nascimento, hoje);
        if (!prox) continue;
        const dia = new Date(prox);
        dia.setHours(0, 0, 0, 0);
        if (dia >= hoje && dia <= limite) {
          const idade = idadeQueFara(cliente.data_nascimento, hoje) ?? 0;
          aniversariantes.push({
            cliente,
            data: dia,
            idade,
            ehHoje: dia.getTime() === hoje.getTime(),
          });
        }
      }
      aniversariantes.sort((a, b) => a.data.getTime() - b.data.getTime());
      const hojeCount = aniversariantes.filter((a) => a.ehHoje).length;
      return { aniversariantes, hojeCount };
    },
  });
}
