# Carteira de Clientes + Espelho da Apólice — visual e lógica de negócio (referência GlobalCRM)

## Contexto
Foi enviada uma referência HTML decupada do GlobalCRM real (`globalcrm.app.br/carteira`),
com estrutura, cores e hierarquia exatas, cobrindo 3 telas: (1) Carteira de
Clientes, (2) Espelho da Apólice, (3) Mapeamento do Excel → tela. O objetivo é
alinhar visualmente as telas 1 e 2 do nosso CRM a essa referência, e aplicar
a lógica de negócio da tela 3 (normalização de produto/status, agrupamento
por apólice, coberturas "incluso") na nossa importação — como uma camada
adicional, sem remover o mapeamento manual que já existe.

Decisões confirmadas com o usuário:
- Detalhe do cliente adota o menu lateral de 5 seções da referência
  (Coberturas, Apólices, Contatos e Agendamentos, Tarefas, Dados pessoais);
  **Tags** entra como 6º item (não existe na referência, mas é feature real
  nossa); "Contatos e Agendamentos" e "Tarefas" ficam como placeholders "em
  breve" (sem funcionalidade nova).
- Botões/ícones sem dado real hoje (Revisão Anual, + Recomendações, Chat,
  Agenda) ficam visíveis mas desabilitados ("em breve"); os que têm dado
  real (Ligar → `tel:`, Email → `mailto:`, Funil → `/kanban`,
  Aniversariantes → `/aniversariantes`) são ligados de verdade.
- Taxonomia de produto/status/cobertura entra como **camada automática** por
  cima do importador atual — o mapeamento manual de colunas continua
  exatamente como está e sempre disponível; a normalização só decide o
  *valor* gravado quando o usuário não sobrescreveu manualmente.
- O espelho da apólice sempre renderiza uma **lista fixa de 13 tipos de
  cobertura** (mesmo não contratados, mostrando "-"), com coberturas
  "incluso" calculadas em tela via regra — nada de coluna nova no banco.

## Nova lib de taxonomia (base de tudo)
`src/lib/seguros-taxonomia.ts` (novo arquivo, puro TS, sem I/O):
- `TAXONOMIA_COBERTURA`: lista ordenada de padrões (regex, acento/case
  insensitive) → `{ rotulo, tipo }`, replicando a tabela da referência
  (Vida Inteira/Temporário/Temporário Decrescente/Temporário Preferencial →
  "Morte Qualquer Causa" `base`; Quebra de Ossos → "Fraturas" `opcional`;
  Cirurgia/Cirurgia Ampliada/Doenças Graves (Plus/Básica/Ampliadas)/Invalidez
  Total e Parcial por Acidente → "Invalidez Parcial"/Renda Hospitalar/Perda
  da Autonomia Pessoal/Assistência Funeral → "Funeral"/Vida e Saúde, todos
  `opcional`).
- `normalizarNomeCobertura(bruto)` → `{ rotulo, tipo } | null`.
- `RIDERS_INCLUSOS = ["Morte Acidental", "Doença Terminal", "Invalidez Total"]`.
- `COBERTURAS_CANONICAS`: lista fixa e ordenada dos 13 tipos (1 básica +
  3 inclusos + 9 opcionais) — fonte única usada tanto pelo espelho quanto
  pelas oportunidades de venda.
- `normalizarStatusApolice(bruto)` / `normalizarStatusCobertura(bruto)` →
  `ApoliceStatus | CoberturaStatus | "rejeitada" | null`, reconhecendo
  frases longas ("Ativa - Pagando Prêmios (Premium Paying)", "Cancelada sem
  Valor de Resgate (Lapsed)", "Rejeitada (Rejected)", "Desistência Dentro do
  Período de Graça (Not Taken)" → `"rejeitada"`, sinal de "pular linha").
- `classificarTipoProduto(tipoProdutoBruto)` → `{ temporario, decrescente }`
  (usa o texto livre já existente em `apolices.tipo_produto`, sem precisar
  de coluna nova) — usado pelos chips de oportunidade da lista.

## 1) Importação — camada automática (aditiva)
Arquivo: `src/pages/importar/ImportarClientesPage.tsx` (só a lógica interna,
UI de mapeamento manual intocada).
- `construirCoberturaPayload`: nome bruto passa por `normalizarNomeCobertura`;
  se houver match E o usuário não mapeou coluna própria de "Tipo da
  cobertura", usa `{ nome_cobertura: rotulo, tipo }` normalizados; mapeamento
  manual de tipo, quando existir, continua vencendo. `status_cobertura`
  bruto passa por `normalizarStatusCobertura`; resultado `"rejeitada"` faz a
  função retornar `null` (linha de cobertura ignorada, resto da apólice segue).
- `construirApolicePayload`: `status_apolice` bruto passa por
  `normalizarStatusApolice` no lugar do `normalizarEnum` atual (que exige
  igualdade exata) — assim reconhece as frases longas da Prudential.
- `handleImportar`: linha cujo status de apólice normaliza para
  `"rejeitada"` é pulada inteira (nunca vigorou) — cliente/apólice já
  existentes por outras linhas não são afetados.
- `agruparAmostraApolices` (pré-visualização) usa as mesmas funções, para o
  usuário ver os nomes/status já normalizados antes de importar.

## 2) Espelho da apólice — lista fixa + estados
Arquivo: `src/components/clientes/ApoliceResumoCard.tsx` (reescrita visual e
de lógica, mesma responsabilidade/props).
- Visual: replica `mirror-card` da referência com Tailwind + novos tokens
  (ver seção de design system) — nome centralizado com borda navy
  topo/base, bio centralizada, linha "Apólice: nº · Seguradora: X" em
  `mirror-link`, cabeçalho de tabela navy, linhas zebradas
  (`--mirror-row-alt`), disclaimer idêntico ao da referência.
- Lógica: itera `COBERTURAS_CANONICAS` (sempre as 13); para cada rótulo,
  procura cobertura(s) da apólice cujo nome (após `normalizarNomeCobertura`)
  bata — soma prêmio/capital se houver mais de uma:
  - existe e `status === "ativa"` → linha normal com valores reais.
  - existe e `status === "cancelada"` → linha itálico/tachado (comportamento
    já existente, mantido).
  - não existe, rótulo ∈ `RIDERS_INCLUSOS`, e há ao menos 1 cobertura
    `tipo="base"` ativa na apólice → linha "incluso" (itálico, sem prêmio).
  - não existe e nenhuma das condições acima → linha inativa ("-").
- Cobertura real na apólice cujo nome não bate com nenhum canônico continua
  aparecendo (linha extra ao final, "Outras coberturas") — nunca some.
- Subtotal opcionais e Total continuam calculados como hoje (dados reais do
  banco, a lista fixa não altera esses totais).
- Botões de ação: "Copiar" copia um resumo em texto para a área de
  transferência (`navigator.clipboard`); "Enviar ao cliente" abre WhatsApp
  com esse resumo via `abrirWhatsapp` (`lib/whatsapp.ts`, já usado em
  Aniversariantes) usando `cliente.celular` — desabilitado se não houver
  celular.

## 3) Detalhe do cliente — menu lateral
Arquivo: `src/pages/clientes/ClienteDetailPage.tsx` (reestruturação de
navegação; conteúdo de cada seção existente é reaproveitado, não recriado).
- Header: ícones Ligar (`tel:`) / Email (`mailto:`) funcionais (desabilitados
  se o dado faltar); Chat/Agenda e "+ Recomendações" desabilitados com
  tooltip "Em breve" (usa `Tooltip` já disponível no projeto). Meta line
  ganha "Próx. Venc." e "Melhor Dia" (calculados a partir da apólice ativa
  com vencimento mais próximo, já disponível via `apolicesData`).
- Troca `Tabs` por `detail-grid` (nav lateral 200px + conteúdo), estado
  `secao` controla qual bloco renderiza:
  1. **Coberturas** (era "Resumo"): banner "N coberturas ainda não
     contratadas" (conta rótulos canônicos inativos, deduplicado entre
     apólices ativas) + `ApoliceResumoCard` por apólice — reaproveitado.
  2. **Apólices**: conteúdo atual da aba "Apólices e coberturas"
     (Collapsible + CRUD) — reaproveitado sem mudança de lógica.
  3. **Contatos e Agendamentos**: `EmptyState` "Em breve".
  4. **Tarefas**: `EmptyState` "Em breve".
  5. **Dados pessoais**: conteúdo atual — reaproveitado.
  6. **Tags**: conteúdo atual — reaproveitado.

## 4) Carteira de Clientes — visual + KPIs reais + oportunidades reais
Arquivo: `src/pages/clientes/ClientesListPage.tsx`.
- `page-head`: ícone + título "Carteira de Clientes", badge "Importado há
  N dias" (calculado do `created_at` mais recente entre clientes/apólices;
  some se não houver dados). Ações: Funil (`/kanban`), Aniversariantes
  (`/aniversariantes`), Revisão Anual (desabilitado), Importar (`/importar`)
  — adicionadas **antes** do "+ Novo cliente" já existente (nada é removido).
- `stat-grid` (5 cards, sobre a base **completa**, não afetada pelos filtros
  da tabela): Clientes ativos/cancelados (tem ≥1 apólice ativa vs. só
  cancelada/suspensa), Apólices ativas/canceladas, Prêmio mensal, CS Total
  (nova `formatarMoedaCompacta` em `lib/format.ts` para o formato "R$ X mi"),
  Ticket médio (prêmio mensal ÷ clientes com ao menos 1 apólice).
- `opp-panel`: 7 chips reais (toggle, OR entre si, combinam em AND com os
  filtros de busca/tag/status já existentes): Temp. vencendo (90d), Temp.
  Expirado, Com Temp. Decrescente (via `classificarTipoProduto` sobre
  `apolice.tipo_produto`), Sem Cirurgia / Sem Doenças Graves / Sem Vida e
  Saúde (via `normalizarNomeCobertura` sobre as coberturas ativas do
  cliente), Venc. Anual — Próximo Mês (vencimento dentro do mês seguinte).
- Tabela: pill "N ativ." (verde), "Prêmio" com "mensal" abaixo do valor,
  "Local" com ícone (lucide `MapPin`, sem emoji). Colunas/ações existentes
  (Tags, editar/excluir) são mantidas ao final — não fazem parte da
  referência mas são funcionalidade real já existente.
- Toolbar da tabela ganha botões visuais "Compartilhar"/"Colunas"
  desabilitados (fidelidade visual, sem funcionalidade nova).

## 5) Hooks e tipos (suporte às oportunidades/KPIs)
- `src/hooks/useClientes.ts`: `useClientes` e `useCliente` passam a
  selecionar `apolices(*, coberturas(*))` (hoje só `apolices(*)`) — aditivo,
  não remove nada, só passa a trazer as coberturas junto.
- `src/lib/types.ts`: `ClienteWithRelations.apolices` passa de `Apolice[]`
  para `ApoliceWithCoberturas[]` (tipo já existe, só amplia o campo).

## 6) Design system — novos tokens
- `src/index.css`: novos tokens fixos (não trocam com dark mode, imitam
  documento impresso) `--mirror-navy: #1b2f6e`, `--mirror-navy-deep:
  #14204a`, `--mirror-row-alt: #e9effa`, `--mirror-row-border: #e3e8f4`,
  `--mirror-rail: #b3c1e0`, `--mirror-link: #2a53c0`; mais um par
  `--success`/`--success-foreground` (emerald, para pill/badge de "ativo").
- `tailwind.config.ts`: expõe `mirror.{navy,navyDeep,rowAlt,rowBorder,rail,
  link}` e `success.{DEFAULT,foreground}` mapeados às novas variáveis,
  seguindo o padrão já usado por `primary`/`secondary`.

## Fora de escopo (não alterado)
Kanban, Aniversariantes, Tags (página), sidebar/`AppLayout`, `TagFormDialog`,
`ColumnFormDialog`, estrutura de mapeamento manual do importador (colunas,
grupos, obrigatoriedade de Nome completo), schema do banco (nenhuma
migração).

## Implementation checklist
- [ ] `src/lib/seguros-taxonomia.ts` com taxonomia de cobertura, lista
      canônica de 13 tipos, normalização de status (com sinal "rejeitada")
      e classificação de tipo de produto
- [ ] Importador usa a taxonomia para nome/tipo de cobertura e status de
      apólice/cobertura, mantendo mapeamento manual com prioridade
- [ ] Linha com status de apólice "rejeitada" é pulada inteira na importação
- [ ] `ApoliceResumoCard` renderiza os 13 tipos canônicos com os 4 estados
      (ativo/cancelado/incluso/inativo) e nunca esconde cobertura real
      sem correspondência canônica
- [ ] Botões Copiar/Enviar ao cliente funcionais no espelho
- [ ] `ClienteDetailPage` com menu lateral de 6 seções, placeholders para
      Contatos e Agendamentos/Tarefas, ícones de contato funcionais
- [ ] `ClientesListPage` com KPIs reais sobre a base completa e 7 chips de
      oportunidade funcionando como filtro OR combinado em AND com os
      filtros existentes
- [ ] `useClientes`/`useCliente` trazendo coberturas aninhadas; nenhuma
      query nem comportamento existente removido
- [ ] Novos tokens de design aplicados sem alterar tokens existentes

## Verification checklist
- [ ] Lint (`pnpm lint`) sem erros
- [ ] Importar planilha com status longo tipo "Ativa - Pagando Prêmios
      (Premium Paying)" grava `status = "ativa"`; status "Rejeitada
      (Rejected)" faz a linha ser ignorada (sem cliente/apólice/cobertura
      criados a partir dela)
- [ ] Importar cobertura com nome bruto "Cirurgia Ampliada por 10 anos G"
      grava rótulo normalizado "Cirurgia Ampliada" e `tipo="opcional"`
- [ ] Cliente com apólice ativa contendo só a cobertura básica: espelho
      mostra Morte Qualquer Causa ativa, os 3 riders como "incluso", e as
      9 opcionais restantes como "-"
- [ ] Cliente com cobertura cujo nome não bate com nenhum canônico: ainda
      aparece no espelho (seção "Outras coberturas"), não desaparece
- [ ] Lista: KPIs não mudam ao digitar na busca ou marcar filtros de tabela
      (refletem a base completa)
- [ ] Chip "Sem Cirurgia" filtra corretamente clientes ativos sem cobertura
      "Cirurgia"/"Cirurgia Ampliada" ativa; 2 chips marcados juntos retornam
      união (OR) dos dois grupos
- [ ] Detalhe do cliente: seções "Contatos e Agendamentos" e "Tarefas"
      mostram placeholder, sem erro; ícone Ligar/Email abre `tel:`/`mailto:`
      quando o dado existe, fica desabilitado quando não existe
- [ ] Nenhuma mudança visual/funcional em Kanban, Aniversariantes, página de
      Tags ou sidebar
- [ ] Screenshots: `/clientes` (lista nova completa), `/clientes/:id` nas
      seções Coberturas (espelho), Apólices, Dados pessoais, Tags, e uma das
      seções placeholder
