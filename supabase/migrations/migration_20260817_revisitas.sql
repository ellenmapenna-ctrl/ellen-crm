-- Revisitas geradas pelo CRM (Prudential x Azos). "dados" guarda o JSON
-- estruturado (RevisitaDados, ver src/lib/revisita-template.ts) pra permitir
-- regenerar/editar depois; "html" guarda o documento já renderizado, servido
-- via iframe em /revisitas/:id. Sem policy de update proposital: revisita
-- salva não é editada em tela, só regenerada (nova linha) ou apagada.
create table if not exists public.revisitas (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  cliente_id uuid references public.clientes(id) on delete set null,
  cliente_nome text not null,
  dados jsonb not null,
  html text not null,
  instrucoes_extras text
);
alter table public.revisitas enable row level security;
drop policy if exists "revisitas_read" on public.revisitas;
create policy "revisitas_read" on public.revisitas for select using (true);
drop policy if exists "revisitas_write" on public.revisitas;
create policy "revisitas_write" on public.revisitas for all using (true) with check (true);

create index if not exists idx_revisitas_cliente_id on public.revisitas(cliente_id);
create index if not exists idx_revisitas_created_at on public.revisitas(created_at desc);
