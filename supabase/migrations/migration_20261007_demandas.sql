-- Painel de Demandas: acompanhamento das demandas da Ellen e do assistente
-- (Renan), com status, responsável, prazo e prioridade. Mesmo padrão de
-- acesso das demais tabelas do CRM (uso interno, sem login).
create table if not exists public.demandas (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  titulo text not null,
  descricao text,
  responsavel text not null default 'Renan' check (responsavel in ('Ellen','Renan')),
  status text not null default 'a_fazer' check (status in ('a_fazer','em_andamento','aguardando','concluida')),
  prioridade text not null default 'normal' check (prioridade in ('baixa','normal','alta')),
  prazo date,
  cliente_id uuid references public.clientes(id) on delete set null,
  concluida_em timestamptz
);
alter table public.demandas enable row level security;
drop policy if exists "demandas_read" on public.demandas;
create policy "demandas_read" on public.demandas for select using (true);
drop policy if exists "demandas_write" on public.demandas;
create policy "demandas_write" on public.demandas for all using (true) with check (true);

create index if not exists idx_demandas_status on public.demandas(status);
create index if not exists idx_demandas_cliente_id on public.demandas(cliente_id);
