-- Dados da apólice no padrão do relatório da Prudential (proposta, vigência,
-- segurado, responsável pelo pagamento, coberturas e pagamento), guardados por
-- apólice para a revisita montar a página "Detalhes da Apólice" sem precisar
-- baixar a apólice no site da seguradora. Uma linha por apólice (substituída
-- a cada nova importação). Só cria uma tabela nova.
create table if not exists public.apolice_detalhes (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  apolice_id uuid not null unique references public.apolices(id) on delete cascade,
  dados jsonb not null
);
alter table public.apolice_detalhes enable row level security;
drop policy if exists "apolice_detalhes_read" on public.apolice_detalhes;
create policy "apolice_detalhes_read" on public.apolice_detalhes for select using (true);
drop policy if exists "apolice_detalhes_write" on public.apolice_detalhes;
create policy "apolice_detalhes_write" on public.apolice_detalhes for all using (true) with check (true);
