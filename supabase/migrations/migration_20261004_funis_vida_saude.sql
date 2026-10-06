-- Funil dividido em categorias: Vida (Revisitas = manutenção da carteira,
-- Visitas = novos leads) e Saúde (só novos leads). Cada coluna
-- (kanban_estagios) pertence a um funil, e o cliente tem uma posição
-- independente por funil em funil_posicoes — o mesmo cliente pode estar na
-- revisita de Vida e como lead de Saúde ao mesmo tempo.
-- clientes.estagio_id fica no schema só por compatibilidade (não é mais lido
-- pelo app); posições existentes são copiadas pro funil Vida › Visitas.

alter table public.kanban_estagios
  add column if not exists funil text not null default 'vida_visitas';

alter table public.kanban_estagios
  drop constraint if exists kanban_estagios_funil_check;
alter table public.kanban_estagios
  add constraint kanban_estagios_funil_check
  check (funil in ('vida_revisitas', 'vida_visitas', 'saude'));

-- Alvo da FK composta abaixo: garante que a coluna pertence ao mesmo funil.
alter table public.kanban_estagios
  drop constraint if exists kanban_estagios_id_funil_key;
alter table public.kanban_estagios
  add constraint kanban_estagios_id_funil_key unique (id, funil);

create table if not exists public.funil_posicoes (
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  funil text not null,
  estagio_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (cliente_id, funil),
  foreign key (estagio_id, funil)
    references public.kanban_estagios(id, funil) on delete cascade
);
create index if not exists idx_funil_posicoes_estagio on public.funil_posicoes(estagio_id);

alter table public.funil_posicoes enable row level security;
drop policy if exists "funil_posicoes_read" on public.funil_posicoes;
create policy "funil_posicoes_read" on public.funil_posicoes for select using (true);
drop policy if exists "funil_posicoes_write" on public.funil_posicoes;
create policy "funil_posicoes_write" on public.funil_posicoes for all using (true) with check (true);

insert into public.funil_posicoes (cliente_id, funil, estagio_id)
select c.id, 'vida_visitas', c.estagio_id
from public.clientes c
where c.estagio_id is not null
on conflict (cliente_id, funil) do nothing;

-- Colunas iniciais dos funis novos (só se o funil ainda estiver vazio).
insert into public.kanban_estagios (nome, cor, ordem, funil)
select v.nome, v.cor, v.ordem, 'vida_revisitas'
from (values
  ('A agendar', '#94a3b8', 0),
  ('Agendada', '#0ea5e9', 1),
  ('Revisita feita', '#8b5cf6', 2),
  ('Proposta de ajuste', '#f59e0b', 3),
  ('Concluída', '#22c55e', 4)
) as v(nome, cor, ordem)
where not exists (select 1 from public.kanban_estagios where funil = 'vida_revisitas');

insert into public.kanban_estagios (nome, cor, ordem, funil)
select v.nome, v.cor, v.ordem, 'saude'
from (values
  ('Novo Lead', '#6366f1', 0),
  ('Em Contato', '#0ea5e9', 1),
  ('Cotação Enviada', '#f59e0b', 2),
  ('Fechado', '#22c55e', 3)
) as v(nome, cor, ordem)
where not exists (select 1 from public.kanban_estagios where funil = 'saude');
