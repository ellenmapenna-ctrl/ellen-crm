-- Observação livre sobre o vencimento do prêmio (ex.: EM ATRASO), preenchida à mão.
-- Só adiciona uma coluna nova e opcional.
alter table public.apolices add column if not exists observacao_vencimento text;
