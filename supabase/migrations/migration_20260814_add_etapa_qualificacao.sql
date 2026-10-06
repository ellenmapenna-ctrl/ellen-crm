-- Adiciona à tabela clientes:
-- - qualificacao: nota de 0 a 5 estrelas (like a Qualificação da referência GlobalCRM)
-- - etapa: linha de negócio do cliente (categorias próprias da Ellen, não é o
--   funil de vendas — isso já existe em estagio_id / kanban_estagios)
alter table public.clientes
  add column if not exists qualificacao smallint not null default 0 check (qualificacao between 0 and 5),
  add column if not exists etapa text check (etapa in ('internacional','credito','investimentos','consorcio','vida','imoveis'));

create index if not exists idx_clientes_etapa on public.clientes(etapa);
