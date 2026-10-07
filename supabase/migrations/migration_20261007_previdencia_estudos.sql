-- Último estudo de previdência (PDF) gerado para cada cliente. Uma linha por
-- cliente: gerar um novo estudo substitui o anterior (upsert por cliente_id).
-- A Revisão Anual usa esse PDF automaticamente quando o produto atual é
-- resgatável, sem precisar reenviar o arquivo. O PDF fica em base64 (poucos
-- KB), evitando a necessidade de configurar o Storage.
create table if not exists public.previdencia_estudos (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  cliente_id uuid not null unique references public.clientes(id) on delete cascade,
  pdf_base64 text not null,
  input jsonb
);
alter table public.previdencia_estudos enable row level security;
drop policy if exists "previdencia_estudos_read" on public.previdencia_estudos;
create policy "previdencia_estudos_read" on public.previdencia_estudos for select using (true);
drop policy if exists "previdencia_estudos_write" on public.previdencia_estudos;
create policy "previdencia_estudos_write" on public.previdencia_estudos for all using (true) with check (true);
