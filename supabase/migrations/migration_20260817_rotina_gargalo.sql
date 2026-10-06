-- Painel de Atenção / Rotina & Gargalo: gestão por gargalos (teoria das
-- restrições) entre os negócios da Ellen (MPG, Remax, Seguro de Vida - MP,
-- SPENA). Portado do app standalone em /Users/adm/Painel-Atencao para dentro
-- do CRM. IDs são texto (não uuid) para preservar os ids do app original
-- (ex.: "mpg", "g-mpg-1") sem precisar remapear na migração dos dados.

create table if not exists public.rotina_negocios (
  id text primary key,
  nome text not null,
  tipo text not null default 'negocio',
  pai_id text references public.rotina_negocios(id),
  retorno text not null check (retorno in ('alto', 'baixo')),
  dependencia text not null check (dependencia in ('alta', 'baixa')),
  atencao_alvo_pct numeric,
  cor text not null default '#4c5fd6',
  ativo boolean not null default true,
  projeto_total_apolices integer,
  projeto_apolices_migradas integer,
  projeto_data_alvo date,
  created_at timestamptz not null default now()
);

create table if not exists public.rotina_gargalos (
  id text primary key,
  negocio_id text not null references public.rotina_negocios(id),
  descricao text not null,
  aberto_em date not null,
  resolvido_em date,
  status text not null default 'aberto' check (status in ('aberto', 'resolvido', 'arquivado')),
  created_at timestamptz not null default now()
);
create index if not exists rotina_gargalos_negocio_idx on public.rotina_gargalos (negocio_id);

create table if not exists public.rotina_acoes (
  id text primary key,
  gargalo_id text not null references public.rotina_gargalos(id),
  descricao text not null,
  dono text not null default 'Ellen',
  prazo date,
  concluida_em date,
  created_at timestamptz not null default now()
);
create index if not exists rotina_acoes_gargalo_idx on public.rotina_acoes (gargalo_id);

create table if not exists public.rotina_passos (
  id text primary key,
  acao_id text not null references public.rotina_acoes(id) on delete cascade,
  descricao text not null,
  concluido_em date,
  created_at timestamptz not null default now()
);
create index if not exists rotina_passos_acao_idx on public.rotina_passos (acao_id);

create table if not exists public.rotina_registros (
  id text primary key,
  negocio_id text not null references public.rotina_negocios(id),
  data date not null,
  horas numeric not null,
  created_at timestamptz not null default now(),
  unique (negocio_id, data)
);

create table if not exists public.rotina_notas (
  id text primary key,
  data date not null,
  texto text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.rotina_semanas (
  id text primary key,
  inicio date not null unique,
  fechada boolean not null default true,
  observacoes text,
  created_at timestamptz not null default now()
);

create table if not exists public.rotina_radar (
  id text primary key,
  negocio_id text references public.rotina_negocios(id),
  texto text not null,
  criado_em date not null,
  concluido_em date,
  created_at timestamptz not null default now()
);

alter table public.rotina_negocios enable row level security;
alter table public.rotina_gargalos enable row level security;
alter table public.rotina_acoes enable row level security;
alter table public.rotina_passos enable row level security;
alter table public.rotina_registros enable row level security;
alter table public.rotina_notas enable row level security;
alter table public.rotina_semanas enable row level security;
alter table public.rotina_radar enable row level security;

create policy "acesso interno" on public.rotina_negocios for all using (true) with check (true);
create policy "acesso interno" on public.rotina_gargalos for all using (true) with check (true);
create policy "acesso interno" on public.rotina_acoes for all using (true) with check (true);
create policy "acesso interno" on public.rotina_passos for all using (true) with check (true);
create policy "acesso interno" on public.rotina_registros for all using (true) with check (true);
create policy "acesso interno" on public.rotina_notas for all using (true) with check (true);
create policy "acesso interno" on public.rotina_semanas for all using (true) with check (true);
create policy "acesso interno" on public.rotina_radar for all using (true) with check (true);
