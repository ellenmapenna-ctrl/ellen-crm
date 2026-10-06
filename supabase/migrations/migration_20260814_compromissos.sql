-- Compromissos com hora marcada, pra alimentar a tela de Agenda (grade
-- semanal + placar por linha de negócio). Diferente do sitplan_itens (que só
-- tem o dia, sem horário) e do estagio_id do Funil (sem data nenhuma).
create table if not exists public.compromissos (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  cliente_id uuid references public.clientes(id) on delete set null,
  titulo text not null,
  tipo text check (tipo in ('internacional','credito','investimentos','consorcio','vida','imoveis')),
  data date not null,
  hora_inicio time not null,
  hora_fim time,
  realizado boolean not null default false,
  updated_at timestamptz default now()
);
alter table public.compromissos enable row level security;
drop policy if exists "compromissos_read" on public.compromissos;
create policy "compromissos_read" on public.compromissos for select using (true);
drop policy if exists "compromissos_write" on public.compromissos;
create policy "compromissos_write" on public.compromissos for all using (true) with check (true);

create index if not exists idx_compromissos_data on public.compromissos(data);
create index if not exists idx_compromissos_cliente_id on public.compromissos(cliente_id);
