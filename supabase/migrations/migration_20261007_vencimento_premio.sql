-- Próximo vencimento do prêmio de cada apólice (vem do relatório "Próximos a
-- vencer" da Prudential), para a Ellen saber quem contatar antes da cobrança.
-- Só adiciona colunas novas e opcionais; nada que já existe é alterado.
alter table public.apolices add column if not exists proximo_vencimento_premio date;
alter table public.apolices add column if not exists forma_pagamento text;
alter table public.apolices add column if not exists responsavel_pagamento text;
alter table public.apolices add column if not exists vencimento_premio_atualizado_em timestamptz;
