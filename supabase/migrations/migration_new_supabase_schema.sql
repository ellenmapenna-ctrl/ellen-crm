-- ============================================================
-- Schema completo do CRM de Carteira de Clientes de Seguros
-- Migração de consolidação para o novo projeto Supabase próprio
-- (substitui a dependência do Supabase gerenciado pelo Enter.pro)
-- Inclui: schema original (3 migrações do Enter.pro) + tabela nova
-- sitplan_itens (SitPlan & TA).
-- ============================================================

-- 1) kanban_estagios (colunas do Funil TA / Kanban, editáveis)
create table if not exists public.kanban_estagios (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  nome text not null,
  cor text not null,
  ordem integer not null default 0
);
alter table public.kanban_estagios enable row level security;
drop policy if exists "kanban_estagios_read" on public.kanban_estagios;
create policy "kanban_estagios_read" on public.kanban_estagios for select using (true);
drop policy if exists "kanban_estagios_write" on public.kanban_estagios;
create policy "kanban_estagios_write" on public.kanban_estagios for all using (true) with check (true);

-- 2) tags
create table if not exists public.tags (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  nome text unique not null,
  cor text not null,
  categoria text
);
alter table public.tags enable row level security;
drop policy if exists "tags_read" on public.tags;
create policy "tags_read" on public.tags for select using (true);
drop policy if exists "tags_write" on public.tags;
create policy "tags_write" on public.tags for all using (true) with check (true);

-- 3) clientes
create table if not exists public.clientes (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  nome_completo text not null,
  cpf text unique,
  email text,
  celular text,
  data_nascimento date,
  sexo text,
  estado_civil text,
  profissao text,
  empresa text,
  cargo text,
  cep text,
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  cliente_desde date default now(),
  estagio_id uuid references public.kanban_estagios(id) on delete set null,
  observacoes text,
  updated_at timestamptz default now()
);
alter table public.clientes enable row level security;
drop policy if exists "clientes_read" on public.clientes;
create policy "clientes_read" on public.clientes for select using (true);
drop policy if exists "clientes_write" on public.clientes;
create policy "clientes_write" on public.clientes for all using (true) with check (true);

-- 4) apolices
create table if not exists public.apolices (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  cliente_id uuid references public.clientes(id) on delete cascade not null,
  numero_apolice text,
  seguradora text,
  tipo_produto text,
  status text not null default 'ativa' check (status in ('ativa','cancelada','suspensa')),
  data_emissao date,
  vencimento_apolice date,
  melhor_dia_pagamento smallint check (melhor_dia_pagamento between 1 and 31),
  premio_mensal_total numeric(12,2) default 0,
  capital_segurado_total numeric(14,2) default 0,
  updated_at timestamptz default now()
);
alter table public.apolices enable row level security;
drop policy if exists "apolices_read" on public.apolices;
create policy "apolices_read" on public.apolices for select using (true);
drop policy if exists "apolices_write" on public.apolices;
create policy "apolices_write" on public.apolices for all using (true) with check (true);

-- 5) coberturas
create table if not exists public.coberturas (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  apolice_id uuid references public.apolices(id) on delete cascade not null,
  nome_cobertura text not null,
  tipo text not null check (tipo in ('base','opcional')),
  capital_segurado numeric(14,2) default 0,
  premio_mensal numeric(12,2) default 0,
  status text not null default 'ativa' check (status in ('ativa','cancelada')),
  updated_at timestamptz default now()
);
alter table public.coberturas enable row level security;
drop policy if exists "coberturas_read" on public.coberturas;
create policy "coberturas_read" on public.coberturas for select using (true);
drop policy if exists "coberturas_write" on public.coberturas;
create policy "coberturas_write" on public.coberturas for all using (true) with check (true);

-- 6) cliente_tags (N:N)
create table if not exists public.cliente_tags (
  cliente_id uuid references public.clientes(id) on delete cascade,
  tag_id uuid references public.tags(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (cliente_id, tag_id)
);
alter table public.cliente_tags enable row level security;
drop policy if exists "cliente_tags_read" on public.cliente_tags;
create policy "cliente_tags_read" on public.cliente_tags for select using (true);
drop policy if exists "cliente_tags_write" on public.cliente_tags;
create policy "cliente_tags_write" on public.cliente_tags for all using (true) with check (true);

-- 7) mensagens_templates
create table if not exists public.mensagens_templates (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  nome text unique not null,
  corpo text not null,
  updated_at timestamptz default now()
);
alter table public.mensagens_templates enable row level security;
drop policy if exists "mensagens_templates_read" on public.mensagens_templates;
create policy "mensagens_templates_read" on public.mensagens_templates for select using (true);
drop policy if exists "mensagens_templates_write" on public.mensagens_templates;
create policy "mensagens_templates_write" on public.mensagens_templates for all using (true) with check (true);

-- 8) sitplan_itens (NOVA — lista diária do SitPlan & TA)
create table if not exists public.sitplan_itens (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  cliente_id uuid references public.clientes(id) on delete cascade not null,
  data date not null,
  ordem integer not null default 0,
  status_ligacao text,
  updated_at timestamptz default now(),
  unique (cliente_id, data)
);
alter table public.sitplan_itens enable row level security;
drop policy if exists "sitplan_itens_read" on public.sitplan_itens;
create policy "sitplan_itens_read" on public.sitplan_itens for select using (true);
drop policy if exists "sitplan_itens_write" on public.sitplan_itens;
create policy "sitplan_itens_write" on public.sitplan_itens for all using (true) with check (true);

-- ============================================================
-- Índices
-- ============================================================
create index if not exists idx_apolices_cliente_id on public.apolices(cliente_id);
create index if not exists idx_coberturas_apolice_id on public.coberturas(apolice_id);
create index if not exists idx_cliente_tags_cliente_id on public.cliente_tags(cliente_id);
create index if not exists idx_cliente_tags_tag_id on public.cliente_tags(tag_id);
create index if not exists idx_clientes_cpf on public.clientes(cpf);
create index if not exists idx_clientes_estagio_id on public.clientes(estagio_id);
create index if not exists idx_kanban_estagios_ordem on public.kanban_estagios(ordem);
create index if not exists idx_sitplan_itens_data on public.sitplan_itens(data);
create index if not exists idx_sitplan_itens_cliente_id on public.sitplan_itens(cliente_id);
