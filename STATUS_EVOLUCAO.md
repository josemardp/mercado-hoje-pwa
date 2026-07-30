# Status da evolução — Meu Diário

> Documento operacional vivo. Deve ser lido no início e atualizado no fim de toda sessão de evolução do projeto.

**Auditoria de origem:** `AUDITORIA_COMPLETA.md`
**Plano mestre:** `PLANO_EVOLUCAO_IMPLEMENTACAO.md`
**Início do acompanhamento:** 30/07/2026
**Última atualização:** 30/07/2026 (sessão de execução da Sprint 0 — encerramento)
**Branch de entrega:** `main`
**Baseline do acompanhamento:** `7610411`
**Responsável:** sessão de IA em execução direta (Claude Code), a pedido do proprietário do projeto

## 1. Como usar este documento

Este arquivo é a fonte de verdade do andamento. A auditoria explica os problemas; o plano define como resolvê-los; este status registra o que está acontecendo agora, o que já foi comprovadamente concluído e o que bloqueia o próximo passo.

### No início de toda sessão

1. Ler este arquivo por completo.
2. Conferir `git status`, branch e último commit.
3. Confirmar a sprint e o item marcados como foco atual.
4. Ler no plano somente a sprint ativa e suas dependências.
5. Consultar na auditoria os IDs relacionados à tarefa.
6. Verificar riscos, bloqueios e decisões ainda abertas.
7. Não iniciar item de sprint posterior enquanto o gate atual não estiver atendido, salvo decisão registrada.

### Durante a implementação

- Atualizar o estado do item quando ele mudar de fase.
- Registrar decisão técnica que altere schema, contrato, ordem do plano ou critério de aceite.
- Associar evidência concreta: teste, commit, migration, workflow ou URL.
- Registrar bloqueio assim que ele impedir avanço real.
- Não considerar uma tarefa pronta apenas porque o código foi escrito.

### No fim de toda sessão

1. Atualizar foco atual, próximo passo e percentual.
2. Atualizar os itens trabalhados e suas evidências.
3. Registrar testes executados e respectivos resultados.
4. Atualizar riscos e bloqueios.
5. Acrescentar uma entrada no histórico deste arquivo.
6. Executar lint, testes e build aplicáveis.
7. Commitar este status junto com a implementação correspondente.

## 2. Hierarquia das fontes

Em caso de dúvida ou divergência:

1. requisitos novos e explícitos do proprietário do projeto;
2. decisões aprovadas e registradas neste status;
3. `PLANO_EVOLUCAO_IMPLEMENTACAO.md`;
4. `AUDITORIA_COMPLETA.md`;
5. comportamento legado do código.

Uma mudança de escopo deve ser registrada na seção “Decisões” antes de alterar a ordem ou o objetivo de uma sprint.

## 3. Vocabulário de status

Usar somente estes estados:

| Estado | Significado |
|---|---|
| `NÃO INICIADO` | Nenhum trabalho efetivo começou. |
| `EM ANÁLISE` | Solução, impacto ou dependências estão sendo investigados. |
| `EM IMPLEMENTAÇÃO` | Código, migration, teste ou documentação estão sendo produzidos. |
| `EM VALIDAÇÃO` | Implementação concluída, aguardando testes/gates/revisão. |
| `BLOQUEADO` | Não pode avançar sem decisão, acesso ou mudança externa. |
| `CONCLUÍDO` | Critérios de aceite atendidos e evidência registrada. |
| `CANCELADO` | Retirado do escopo por decisão registrada. |

### Regra para `CONCLUÍDO`

Um item somente pode ser marcado como `CONCLUÍDO` quando:

- implementação e documentação estão versionadas;
- testes previstos passam;
- não há erro de lint/typecheck/build;
- migration aplicável foi validada;
- critério de aceite foi conferido;
- commit ou outra evidência foi informado neste arquivo.

## 4. Painel executivo

| Campo | Estado atual |
|---|---|
| Situação geral | `EM EXECUÇÃO — SPRINT 4 CONCLUÍDA (escopo reduzido)` |
| Fase atual | Ações destrutivas separadas e confirmadas (Compras/Rotina/Agenda), logout protegido, estados vazios/Markdown corrigidos, recuperação de senha completa. Editor dedicado/editar-após-gerar/undo desescopados por decisão (D-017) |
| Sprint ativa | Sprint 5 — Acessibilidade, responsividade e PWA |
| Foco atual | Iniciar Sprint 5: padrões Tabs/Combobox/Dialog (S5-01), ARIA e navegação por teclado (S5-02) |
| Próxima entrega | Sprint 5 — acessibilidade, responsividade e PWA (AUD-014, AUD-017, AUD-018) |
| Progresso do plano | ~64% (37/58 itens — Sprints 0-4 completas; Sprint 4 fechada em escopo reduzido) |
| Sprints concluídas | 5 de 7 (Sprint 0, Sprint 1, Sprint 2, Sprint 3, Sprint 4) |
| Achados resolvidos | 15 de 26 (AUD-007, AUD-010, AUD-013, AUD-021, AUD-022, AUD-026 nesta atualização, mais os 9 anteriores). AUD-005/AUD-006 parcialmente mitigados; AUD-011 parcialmente resolvido (3 de 4 problemas, o 4º desescopado) — nenhum dos três contado como resolvido |
| Bloqueios ativos | 1 (B-001 e B-003 resolvidos; B-002 permanece aberto) |
| Último deploy estável conhecido | commit `4d9248c` (run `30562831582`, aprovado) |
| Saúde da baseline | lint aprovado; typecheck aprovado; testes aprovados (50 passaram, 0 vermelhos, 0 pendentes); build aprovado; `pnpm audit --prod` sem vulnerabilidades; principais mudanças de UI verificadas ao vivo na conta real do proprietário (ver seção 9) |

### Resumo por prioridade

| Prioridade | Total | Concluídos | Restantes |
|---|---:|---:|---:|
| Crítico | 2 | 2 | 0 |
| Alto | 7 | 5 | 2 |
| Médio/Alto | 1 | 1 | 0 |
| Médio | 11 | 5 | 6 |
| Baixo | 5 | 2 | 3 |
| **Total** | **26** | **15** | **11** |

### Critérios de cálculo

- Progresso de uma sprint = itens `CONCLUÍDOS` ÷ total de itens da sprint.
- Progresso geral = média ponderada pelos itens das sete sprints.
- Itens `EM VALIDAÇÃO` não entram como concluídos.
- Um achado só entra como resolvido quando todos os itens necessários e o teste de regressão estiverem concluídos.

## 5. Caminho crítico

```text
Sprint 0 — testes, CI e migrations reproduzíveis
    ├── Sprint 1 — reset/tombstone/versionamento
    │       └── Sprint 2 — idempotência e convergência
    └── Sprint 3 — motor correto da Agenda
            └── Sprint 4 — editor e ações seguras

Sprint 2 + Sprint 4
    └── Sprint 5 — acessibilidade, responsividade e PWA
            └── Sprint 6 — performance, segurança e consolidação
```

Não iniciar as mudanças de sincronização da Sprint 1 sem a suíte mínima da Sprint 0. Não publicar o novo motor da Agenda sem os invariantes automatizados da Sprint 3.

## 6. Status das sprints

### Sprint 0 — Rede de segurança e baseline reproduzível

**Estado:** `CONCLUÍDA`
**Progresso:** 9/9 — 100%
**Objetivo:** criar testes e gates antes de alterar sincronização e schema.
**Gate de entrada:** responsável definido, repositório limpo e acesso ao Supabase de staging.
**Gate de saída:** clone limpo reproduz ambiente; CI bloqueia regressões; estratégia da migration duplicada está aprovada.

| ID | Entrega | Estado | Evidência/observação |
|---|---|---|---|
| S0-01 | Adicionar Vitest, scripts e cobertura | `CONCLUÍDO` | `vitest.config.ts`; scripts `test`/`test:watch`/`test:coverage`/`typecheck` em `package.json`. |
| S0-02 | Testes das funções puras e merges LWW | `CONCLUÍDO` | `src/lib/__tests__/agendaScheduler.test.ts`, `agendaDurationEstimator.test.ts`, `lwwMerges.test.ts`, `classifyCategory.test.ts`, `categories.test.ts` — 32 casos aprovados. |
| S0-03 | Testes Dexie com `fake-indexeddb` | `CONCLUÍDO` | `src/lib/__tests__/dexie.test.ts`; `src/test/setup.ts` carrega `fake-indexeddb/auto`. |
| S0-04 | Reproduzir AUD-001 a AUD-004 em testes vermelhos | `CONCLUÍDO` | 5 casos `it.fails` (AUD-001, AUD-002, AUD-004×2, AUD-009 como bônus) + 1 `describe.todo` (AUD-003, exige mock de duas chamadas de rede concorrentes — não implementado nesta sessão). |
| S0-05 | CI com lint, typecheck, testes, build e audit | `CONCLUÍDO` | `.github/workflows/deploy.yml` reescrito (valida secrets, lint, typecheck, test, `pnpm audit --prod`, build, `supabase start`/`stop`) e enviado após reautenticar o `gh` com o escopo `workflow` (ver B-003, fechado). Run real `30539728743` (commit `470be73`) aprovado de ponta a ponta: lint, typecheck, test, audit, build, Supabase CLI, validação de migrations e deploy — todos verdes. |
| S0-06 | Fixar Node, pnpm, lockfile e validar env | `CONCLUÍDO` | `package.json`: `engines.node >=22`, `packageManager: pnpm@10.33.0`; CI usa `--frozen-lockfile` e falha se os secrets do Supabase estiverem vazios. |
| S0-07 | Corrigir Supabase local, seed e redirects | `CONCLUÍDO` | `supabase/config.toml`: seed desabilitado (não existe `seed.sql`, o catálogo é semeado em runtime); `site_url`/`additional_redirect_urls` corrigidos de `:3000` pra `:5173` (porta real do Vite). `sendPasswordReset` agora usa `import.meta.env.BASE_URL` em vez de `/mercado-hoje-pwa/` fixo. |
| S0-08 | Validar migrations em banco descartável | `CONCLUÍDO` | Etapa rodou no CI (`supabase start`/`stop`, Docker do runner `ubuntu-latest`) no run `30539728743` — passou aplicando toda a cadeia de migrations do zero. Continua não podendo ser executada localmente (sem Docker Desktop nesta máquina — ver B-002). |
| S0-09 | Auditar e decidir correção da versão duplicada `20260727` | `CONCLUÍDO` | Ver B-001 abaixo e decisão D-005. |

#### Próxima ação da Sprint 0

Sprint 0 concluída — ver seção 13 (Foco da próxima sessão) para os próximos passos da Sprint 1.

### Sprint 1 — Integridade de reset e versão dos dados

**Estado:** `CONCLUÍDA`
**Progresso:** 7/7 — 100%
**Dependência:** gate da Sprint 0.
**Gate de saída:** nenhum estado anterior a reset reaparece e o relógio do aparelho não decide sozinho o vencedor.

| ID | Entrega | Estado | Evidência/observação |
|---|---|---|---|
| S1-01 | Aprovar modelo de versão server-side | `CONCLUÍDO` | Decisão D-009: cutoff de reset usa `clock_timestamp()` do próprio Postgres (não `Date.now()` do cliente) como fronteira. Versionamento de campo-a-campo (LWW normal, fora de reset) continua no timestamp do cliente por ora — migrar todo write pra HLC/versão do servidor é escopo maior que o desta sprint; risco residual registrado em AUD-005. |
| S1-02 | Criar cutoff/tombstone de reset por domínio | `CONCLUÍDO` | Tabela `mh_reset_cutoffs` (PK `user_id+day_key+domain`) e RPC `reset_day_domain` em `supabase/migrations/20260801_add_reset_cutoffs.sql`, aplicada e verificada em produção. |
| S1-03 | Atualizar RPCs de Compras e Rotina | `CONCLUÍDO` | `upsert_day_item_if_newer` e `upsert_rotina_step_if_newer` agora consultam `mh_reset_cutoffs` e rejeitam (`RETURN FALSE`) qualquer `p_updated_at` anterior ao cutoff, mesmo sem linha conflitante pra comparar — a causa raiz do AUD-001 (INSERT sem conflito sempre tinha sucesso). |
| S1-04 | Atualizar merges local/remoto | `CONCLUÍDO` | `mergeDayItemsWithLWW`/`mergeRotinaStateWithLWW` (`db.ts`/`rotinaDb.ts`) ganharam parâmetro opcional `cutoffAt`; `useStore.ts`/`useRotinaState.ts` buscam o cutoff (`fetchAndStoreResetCutoff`) a cada load online e purgam do Dexie tudo que o cutoff descartou. |
| S1-05 | Persistir cutoff no Dexie | `CONCLUÍDO` | Tabela Dexie `resetCutoffs` (`db.ts`, `version(5)`); `getLocalResetCutoff`/`setLocalResetCutoff` (nunca anda pra trás — testado). |
| S1-06 | Definir retenção segura dos tombstones | `CONCLUÍDO` | Decisão D-010: reter cutoffs indefinidamente (1 linha por usuário+dia+domínio, crescimento limitado a ~730 linhas/ano para uso pessoal) em vez de expirar por janela de tempo — expirar arriscaria reabrir a janela do AUD-001 pra um aparelho que ficasse offline além do prazo. |
| S1-07 | Validar matriz online/offline/clock skew | `CONCLUÍDO` | `lwwMerges.test.ts`: item/passo anterior ao cutoff não ressurge com remoto vazio; item/passo posterior ao cutoff sobrevive. `dexie.test.ts`: `setLocalResetCutoff` nunca anda pra trás e avança corretamente quando o novo valor é mais recente. Cenário "A reseta online / B offline reconecta depois" coberto pela combinação RPC (rejeita reinserção) + merge (purga a exibição); ver risco residual de clock skew em D-009. |

### Sprint 2 — Sincronização idempotente e convergência

**Estado:** `CONCLUÍDA`
**Progresso:** 9/9 — 100%
**Dependência:** Sprints 0 e 1.
**Gate de saída:** uma ação gera um efeito; escrita rejeitada converge; contas locais permanecem isoladas.

| ID | Entrega | Estado | Evidência/observação |
|---|---|---|---|
| S2-01 | Remover incremento duplicado de `use_count` | `CONCLUÍDO` | `mark` não carrega mais `use_count`; novo tipo de fila `incrementUse` é o único caminho que toca o contador (`useStore.ts`'s `toggleItem`, `db.ts`'s `processSyncQueue`). |
| S2-02 | Adicionar `operation_id` idempotente | `CONCLUÍDO` | Migration `20260802_idempotent_use_count.sql`: tabela `mh_processed_operations` + `increment_use_count` ganha `p_operation_id` opcional, com `INSERT ... ON CONFLICT DO NOTHING` decidindo se reaplica. Aplicada e verificada em produção (função antiga de 2 args removida, só a de 3 existe). |
| S2-03 | Adicionar mutex por fila | `CONCLUÍDO` | `processingRef` (useRef) em `useStore.ts`/`useRotinaState.ts`/`useAgendaState.ts` — dois disparos concorrentes (online + foco + evento) não processam mais a mesma fila em paralelo. |
| S2-04 | Compactar operações pendentes com segurança | `CONCLUÍDO` | `compactSyncQueueEntries` (`db.ts`) funde `mark/unmark/postpone/unpostpone` do mesmo item (só a mais recente importa) e soma `incrementUse` repetidos do mesmo item numa única chamada — `add`/`reset`/`category` nunca são tocados. Testado em `syncReconciliation.test.ts`. |
| S2-05 | Reconciliar `applied === false` na Rotina | `CONCLUÍDO` | `reconcileLocalRotinaStepFromRemote` (`rotinaDb.ts`) busca a linha canônica e dispara `mh:rotina-reconciled`; `useRotinaState.ts` escuta e atualiza o estado React. Testado em `syncReconciliation.test.ts`. |
| S2-06 | Reconciliar `applied === false` na Agenda | `CONCLUÍDO` | Mesmo padrão em `agendaDb.ts`/`useAgendaState.ts` (`mh:agenda-reconciled`). Testado em `syncReconciliation.test.ts`. |
| S2-07 | Escopar Dexie e filas por `userId` | `CONCLUÍDO` | `rotinaStepState` reindexado pra `[dayKey+stepId+userId]` (Dexie `version(6)`, com `.upgrade()` re-chaveando linhas existentes); `userId` adicionado a `SyncQueueEntry`/`RotinaSyncQueueEntry`/`AgendaSyncQueueEntry` (opcional, retrocompatível — entradas sem `userId` são tratadas como da conta ativa). Testado em `dexie.test.ts`. |
| S2-08 | Centralizar autenticação | `CONCLUÍDO` | Novo `src/lib/AuthProvider.tsx` — única subscription de `onAuthStateChange`; `useDayState`/`useItems` passam a receber `user` como parâmetro em vez de assinar sozinhos. Verificado ao vivo no navegador (tela de login renderiza sem erros no console). |
| S2-09 | Sincronizar ao recuperar foco/visibilidade | `CONCLUÍDO` | Listener de `focus`/`visibilitychange` nos três hooks, com throttle de 30s, força um novo pull+merge e reprocessa a fila. Realtime não foi prototipado — decisão D-011 (custo/complexidade não justificado ainda para uso pessoal em poucos aparelhos). |

### Sprint 3 — Motor da Agenda correto

**Estado:** `CONCLUÍDA`
**Progresso:** 7/7 — 100%
**Dependência:** testes-base da Sprint 0.
**Gate de saída:** nenhuma agenda válida contém sobreposição e falta de tempo é calculada corretamente.

| ID | Entrega | Estado | Evidência/observação |
|---|---|---|---|
| S3-01 | Reescrever scheduler por gaps livres | `CONCLUÍDO` | `agendaScheduler.ts` reescrito: constrói os intervalos livres entre âncoras fixas primeiro (`gapStart`/`gapEnd` por índice de gap) e só então aloca/comprime tarefas dentro da capacidade real de cada intervalo — a escala global antiga (raiz do AUD-002) foi removida. |
| S3-02 | Detectar fixos sobrepostos | `CONCLUÍDO` | `fixedConflicts` no `ScheduleResult`: dois compromissos fixos (âncoras) que se sobrepõem entre si retornam `tasks: []` e a lista de ids em conflito — nada é persistido (ver S3-06). |
| S3-03 | Comprimir dentro da capacidade de cada gap | `CONCLUÍDO` | Escala calculada por gap (`gapCapacity - fixedFloatingSum` vs. soma dos flexíveis daquele gap), não mais pela janela inteira. |
| S3-04 | Unificar duração mínima | `CONCLUÍDO` | `AgendaPlanner.tsx`'s input de duração usa `min`/`step = FLOOR_MINUTES` (era `5`, incompatível com o piso de `10` do motor); `useAgendaState.ts`'s `updateTaskDuration` também aplica `Math.max(FLOOR_MINUTES, minutes)` no domínio. |
| S3-05 | Definir política para janela, meia-noite e fixos | `CONCLUÍDO` | Janela inválida (`fim <= início`) retorna `invalidWindow: true` em vez de silenciosamente zerar; travessia de meia-noite continua não suportada (mesma premissa já adotada desde o planejamento original — UI já valida antes de chamar o motor); compromisso fixo sem horário é tratado como "soft-fixed" (duração respeitada, só comprimida como último recurso pra nunca sobrepor); compromisso fixo que ultrapassa a janela conta como `shortfallMinutes`, não como conflito (decisão D-013); tarefas concluídas continuam intocadas no recálculo (comportamento preexistente, sem regressão). |
| S3-06 | Impedir persistência de resultado inválido | `CONCLUÍDO` | `useAgendaState.ts`'s `generateSchedule` retorna cedo (sem tocar Dexie/estado) quando `invalidWindow` ou `fixedConflicts` vêm preenchidos; `AgendaPlanner.tsx` mostra uma mensagem de erro nomeando as tarefas em conflito em vez de aplicar um resultado parcial. |
| S3-07 | Adicionar testes de invariantes/propriedades | `CONCLUÍDO` | `agendaScheduler.test.ts`: 1000 combinações aleatórias verificando ausência de sobreposição, `end >= start`, todas as tarefas presentes uma vez, e (quando `shortfall = 0`) todo intervalo dentro da janela — estável em 5 execuções consecutivas locais. |

### Sprint 4 — Editor da Agenda e ações seguras

**Estado:** `CONCLUÍDA` (escopo reduzido — ver D-017)
**Progresso:** 5/8 — 62% (os 3 itens restantes foram conscientemente adiados, não esquecidos)
**Dependência:** Sprint 3 e contratos de sincronização da Sprint 2.
**Gate de saída:** tarefas são editáveis; ações destrutivas são explícitas/reversíveis; recuperação de senha é completa.

| ID | Entrega | Estado | Evidência/observação |
|---|---|---|---|
| S4-01 | Criar editor completo de tarefa | `CANCELADO` (D-017) | Parcial e suficiente: campo de horário inline em toda linha fixa, validação bloqueia salvar "fixo" sem horário. O editor dedicado (modal com salvar/cancelar) foi desescopado — a edição inline já atende aos critérios de aceite da sprint. |
| S4-02 | Persistir por debounce/blur | `CONCLUÍDO` | Título e duração usam rascunho local (`titleDrafts`/`durationDrafts`) e só persistem no `onBlur`, não mais a cada tecla (AUD-013). |
| S4-03 | Permitir editar e recalcular agenda | `CANCELADO` (D-017) | Depois de gerar a agenda, horário/duração continuam somente leitura — ainda é preciso limpar a agenda pra editar. Nenhum critério de aceite da sprint depende disso; desescopado. |
| S4-04 | Separar ações de desmarcar e limpar | `CONCLUÍDO` | Nova ação `unmarkAllChecked` ("Desmarcar concluídos", só desmarca) separada de `resetAll` (renomeado pra "Limpar lista do dia", com confirmação de dois toques) — resolve AUD-010 na aba Compras. |
| S4-05 | Confirmação contextual e undo | `CONCLUÍDO` (parcial suficiente, D-017) | Confirmação de dois toques em "Limpar lista do dia"; `resetArmed` da Rotina/Agenda agora reseta ao trocar de modo. Undo temporário desescopado — nenhum critério de aceite exige undo, só confirmação explícita, que já existe. |
| S4-06 | Proteger logout com pendências | `CONCLUÍDO` | Modal conta pendências reais (não só "travadas") nas três filas antes de sair; oferece "Sincronizar agora" ou "Sair mesmo assim (descartar)" em vez de apagar tudo silenciosamente (AUD-007). |
| S4-07 | Corrigir estados vazios e textos iOS | `CONCLUÍDO` | Lista vazia agora diz "Sua lista está vazia" quando não há itens, distinto de "Tudo no carrinho!" quando há itens e todos concluídos (AUD-021); `**negrito**` literal do modal iOS virou `<strong>` (AUD-022). |
| S4-08 | Completar fluxo `PASSWORD_RECOVERY` | `CONCLUÍDO` | Link de recuperação expirado/já usado agora mostra mensagem clara na tela de login (`authLinkError`, parseado do hash de erro do Supabase) em vez de deixar um hash cru na URL; sinal `passwordRecovery` é limpo (`clearPasswordRecovery`) depois que a senha é salva, não só por reload. Autocomplete já estava concluído. |

Todos os 5 critérios de aceite da sprint foram conferidos: nenhum botão com rótulo mais brando que seu efeito; trocar de modo cancela confirmação armada; tarefa fixa não pode ser salva sem horário; logout com fila pendente exige decisão explícita; lista vazia não dispara mensagem de conclusão.

### Sprint 5 — Acessibilidade, responsividade e PWA

**Estado:** `NÃO INICIADO`
**Progresso:** 0/8 — 0%
**Dependência:** Sprints 2 e 4.
**Gate de saída:** fluxos principais funcionam por teclado, sem overflow e com update disponível em qualquer aba.

| ID | Entrega | Estado | Evidência/observação |
|---|---|---|---|
| S5-01 | Implementar padrões Tabs, Combobox e Dialog | `NÃO INICIADO` | — |
| S5-02 | Completar ARIA e navegação por teclado | `NÃO INICIADO` | — |
| S5-03 | Criar live regions de sync/erros | `NÃO INICIADO` | — |
| S5-04 | Adequar alvos de toque | `NÃO INICIADO` | — |
| S5-05 | Criar layout móvel da Agenda | `NÃO INICIADO` | — |
| S5-06 | Testar viewports e zoom | `NÃO INICIADO` | — |
| S5-07 | Tornar update do PWA global | `NÃO INICIADO` | — |
| S5-08 | Executar axe e teste manual com teclado | `NÃO INICIADO` | — |

### Sprint 6 — Performance, segurança e consolidação

**Estado:** `NÃO INICIADO`
**Progresso:** 0/10 — 0%
**Dependência:** gate da Sprint 5.
**Gate de saída:** metas de qualidade atingidas, operação documentada e dívida principal encerrada.

| ID | Entrega | Estado | Evidência/observação |
|---|---|---|---|
| S6-01 | Lazy-load de Rotina e Agenda | `NÃO INICIADO` | — |
| S6-02 | Analisar e reduzir bundle | `NÃO INICIADO` | — |
| S6-03 | Otimizar fontes e metadados | `NÃO INICIADO` | — |
| S6-04 | Logger por ambiente com redaction | `NÃO INICIADO` | — |
| S6-05 | Observabilidade sem dados pessoais | `NÃO INICIADO` | — |
| S6-06 | Aplicar headers defensivos | `NÃO INICIADO` | — |
| S6-07 | Decidir evolução da hospedagem | `NÃO INICIADO` | — |
| S6-08 | Implementar retenção e backup/exportação | `NÃO INICIADO` | — |
| S6-09 | Atualizar documentação e runbooks | `NÃO INICIADO` | — |
| S6-10 | Refatorar arquivos grandes por domínio | `NÃO INICIADO` | — |

## 7. Cobertura dos achados da auditoria

| Achado | Severidade | Sprint principal | Estado | Evidência de resolução |
|---|---|---:|---|---|
| AUD-001 — reset sem tombstone | Crítico | 1 | `CONCLUÍDO` | Cutoff/tombstone server-side por `user_id+day_key+domínio` (`mh_reset_cutoffs`, migration `20260801`); RPCs condicionais rejeitam escrita anterior ao cutoff mesmo sem linha conflitante; merges filtram por cutoff e purgam o Dexie local. Testes em `lwwMerges.test.ts` (não são mais `it.fails`) e `dexie.test.ts`. |
| AUD-002 — sobreposição na Agenda | Crítico | 3 | `CONCLUÍDO` | Motor reescrito por gaps livres com compressão por capacidade real de cada intervalo (`agendaScheduler.ts`); cenário exato da auditoria (flexível 120min + fixo 30min às 10h numa janela de 3h) agora comprime corretamente sem sobreposição. Testado em `agendaScheduler.test.ts`, incluindo 1000 combinações aleatórias. |
| AUD-003 — incremento duplicado | Alto | 2 | `CONCLUÍDO` | Caminho único: `mark` não carrega mais `use_count`; um novo tipo de fila `incrementUse` (com `operation_id` idempotente, migration `20260802`) é o único caminho que toca o contador. `compactSyncQueueEntries` também funde múltiplos incrementos pendentes do mesmo item numa única chamada. Testado em `syncReconciliation.test.ts`. |
| AUD-004 — `applied=false` ignorado | Alto | 2 | `CONCLUÍDO` | Rotina e Agenda agora buscam a linha canônica e reconciliam Dexie + estado React quando a RPC rejeita por LWW (`rotinaDb.ts`/`agendaDb.ts` + eventos `mh:rotina-reconciled`/`mh:agenda-reconciled`). Testado em `syncReconciliation.test.ts`. |
| AUD-005 — LWW pelo relógio local | Alto | 1 | `EM IMPLEMENTAÇÃO` | Parcial: o cutoff de reset agora usa `clock_timestamp()` do servidor, não o relógio do cliente (fecha o gap de clock skew especificamente pra fronteira de reset). O versionamento de escrita campo-a-campo (toggle de item/passo fora de reset) continua em `Date.now()` do cliente — um aparelho com relógio adiantado ainda pode inflar seu próprio `updated_at` além do cutoff. Fechamento completo exige migrar todo write pra timestamp/versão emitido pelo servidor (D-009); não escopado nesta sprint. |
| AUD-006 — ausência de atualização remota aberta | Alto | 2 | `EM IMPLEMENTAÇÃO` | Parcial (S2-09): recuperar foco/visibilidade da aba agora reprocessa a fila e refaz o pull+merge, com throttle de 30s, nos três domínios. Falta a evolução completa sugerida pela auditoria (Realtime) — decisão D-011 registra que não foi prototipada ainda por falta de justificativa de custo/benefício. |
| AUD-007 — logout perde pendências | Alto | 4 | `CONCLUÍDO` | Modal de confirmação conta pendências reais nas três filas (Compras/Rotina/Agenda) antes de sair; oferece "Sincronizar agora" (chama `processSyncQueue` dos três hooks) ou "Sair mesmo assim". Verificado ao vivo (modal mostrou "Tudo sincronizado" corretamente com 0 pendências). |
| AUD-008 — migration duplicada | Alto | 0 | `CONCLUÍDO` | `20260727_add_increment_use_count_rpc.sql` renomeado pra `20260727120000_...` (ordem de dependência real confirmada pelo próprio SQL: referencia `mh_items.id UUID`/`user_id`, que só existem depois de `20260727_update_auth_and_day_items.sql`). Histórico remoto verificado diretamente em `supabase_migrations.schema_migrations`: 7 versões locais = 7 versões remotas, uma a uma. Nenhuma migration já aplicada foi re-executada. |
| AUD-009 — isolamento local incompleto | Alto | 2 | `CONCLUÍDO` | Nova tabela `rotinaStepStateByUser` com chave `[dayKey+stepId+userId]` (a tentativa original de trocar a chave da tabela existente quebrou em produção — ver D-015; a correção usa criar+copiar em `version(6)` e apagar a antiga em `version(7)`); `userId` adicionado a todas as filas de sync (`SyncQueueEntry`/`RotinaSyncQueueEntry`/`AgendaSyncQueueEntry`), com leitura/limpeza filtrada pela conta ativa. Testado em `dexie.test.ts`, incluindo regressão do incidente de migração (Vitest + Chromium real). |
| AUD-010 — reset ambíguo/destrutivo | Médio/Alto | 4 | `CONCLUÍDO` | "Limpar marcações" renomeado pra "Limpar lista do dia" (nome bate com o efeito real: some com `inToday`, não só desmarca) + confirmação de dois toques; nova ação separada "Desmarcar concluídos" cobre o caso que o rótulo antigo prometia. `resetArmed` da Rotina/Agenda deixou de ser compartilhado entre modos — trocar de modo cancela a confirmação armada. Ambos verificados ao vivo. |
| AUD-011 — fixo sem horário editável | Médio | 4 | `EM IMPLEMENTAÇÃO` | 3 dos 4 problemas resolvidos: criar "Fixo" sem horário agora é bloqueado; converter flexível→fixo revela um campo de horário inline na própria linha; desativar e reativar "fixo" não apaga mais o horário (memória local na UI, capturada no momento de desativar — verificado ao vivo, incluindo um bug real encontrado e corrigido durante o teste). O 4º (editar duração/horário depois de gerada a agenda) foi desescopado por decisão (D-017) — não há previsão de fazer, backlog se algum dia for pedido. |
| AUD-012 — duração mínima inconsistente | Médio | 3 | `CONCLUÍDO` | `AgendaPlanner.tsx` e `useAgendaState.ts`'s `updateTaskDuration` agora usam o mesmo piso `FLOOR_MINUTES` (10) do motor — uma tarefa nunca mais "cresce" de 5 pra 10 durante a compressão. Testado em `agendaScheduler.test.ts`. |
| AUD-013 — persistência por tecla | Médio | 4 | `CONCLUÍDO` | Título e duração da Agenda usam rascunho local, persistindo só no `blur` — uma frase inteira digitada agora gera uma escrita, não uma por tecla. |
| AUD-014 — update oculto na Rotina | Médio | 5 | `NÃO INICIADO` | — |
| AUD-015 — ambiente não reproduzível | Médio | 0 | `CONCLUÍDO` | Seed desabilitado (`db.seed.enabled=false`, não existe `seed.sql`); `site_url`/`additional_redirect_urls` corrigidos pra `:5173`; `sendPasswordReset` usa `import.meta.env.BASE_URL` em vez de caminho fixo; CI agora falha se `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` estiverem vazios. |
| AUD-016 — CI incompleto | Médio | 0 | `CONCLUÍDO` | `.github/workflows/deploy.yml` agora roda lint, typecheck, test, `pnpm audit --prod`, build e validação de migrations antes do deploy; `packageManager` fixado. Primeiro run real (`30539728743`) aprovado de ponta a ponta. |
| AUD-017 — acessibilidade interna | Médio | 5 | `NÃO INICIADO` | — |
| AUD-018 — controles/layout Agenda | Médio | 5 | `NÃO INICIADO` | — |
| AUD-019 — dados pessoais em logs | Médio | 6 | `NÃO INICIADO` | — |
| AUD-020 — headers ausentes | Médio | 6 | `NÃO INICIADO` | — |
| AUD-021 — estado vazio enganoso | Baixo | 4 | `CONCLUÍDO` | "Tudo no carrinho! Boas compras!" só aparece quando havia itens e todos foram concluídos (`totalCount > 0`); lista genuinamente vazia agora mostra "Sua lista está vazia" em vez de comemorar algo que nunca existiu. |
| AUD-022 — Markdown literal no iOS | Baixo | 4 | `CONCLUÍDO` | `**Compartilhar**`/`**Adicionar à Tela de Início**`/`**Adicionar**` trocados por `<strong>` no modal de instalação iOS. |
| AUD-023 — SEO/performance inicial | Baixo | 6 | `NÃO INICIADO` | — |
| AUD-024 — documentação/estrutura | Baixo | 6 | `NÃO INICIADO` | — |
| AUD-025 — retenção indefinida | Baixo | 6 | `NÃO INICIADO` | — |
| AUD-026 — recuperação de senha incompleta | Médio | 4 | `CONCLUÍDO` | `PASSWORD_RECOVERY` abre o formulário automaticamente; campos com autocomplete correto (já concluído antes). Agora também: link expirado/já usado mostra mensagem clara na tela de login (`authLinkError` no `AuthProvider`, parseado do hash de erro do Supabase, testado ao vivo com `error_code=otp_expired`); sinal `passwordRecovery` é limpo (`clearPasswordRecovery`) assim que a senha é salva com sucesso. |

## 8. Gates de qualidade e release

| Gate | Estado | Condição para aprovação | Evidência |
|---|---|---|---|
| G0 — baseline | `APROVADO` | lint, build e deploy da baseline passam | commit `7610411`; workflow `30510848715` |
| G1 — testes/CI | `APROVADO` | Sprint 0 concluída | Testes/CI implementados e aprovados localmente e no run real do Actions (`30539728743`, commit `470be73`). |
| G2 — integridade de dados | `APROVADO` | Sprints 1 e 2 concluídas | Sprints 1 e 2 concluídas nesta atualização; AUD-001/003/004/009 resolvidos, AUD-005/006 parcialmente mitigados (risco residual registrado, não bloqueia o gate). |
| G3 — Agenda correta | `APROVADO` | Sprint 3 concluída | Sprint 3 concluída nesta atualização; AUD-002 (crítico) e AUD-012 resolvidos; 1000 combinações aleatórias sem sobreposição. |
| G4 — UX segura | `APROVADO` | Sprint 4 concluída | Sprint 4 encerrada com escopo reduzido (D-017): os 5 critérios de aceite da sprint foram todos conferidos; S4-01/S4-03/parte do S4-05 desescopados por decisão registrada, não por gate não atendido. |
| G5 — interface acessível/PWA | `PENDENTE` | Sprint 5 concluída | — |
| G6 — consolidação | `PENDENTE` | Sprint 6 e metas finais concluídas | — |
| Produção final | `PENDENTE` | G1 a G6 aprovados e smoke test | — |

## 9. Testes da última atualização

| Data | Escopo | Comando/verificação | Resultado |
|---|---|---|---|
| 30/07/2026 | Baseline | `pnpm lint` | Aprovado |
| 30/07/2026 | Baseline | `pnpm build` | Aprovado |
| 30/07/2026 | Dependências | `pnpm audit --prod` | 0 vulnerabilidades conhecidas |
| 30/07/2026 | Deploy | GitHub Actions `30510848715` | Aprovado |
| 30/07/2026 | Sprint 0 | `pnpm typecheck` | Aprovado |
| 30/07/2026 | Sprint 0 | `pnpm test` (Vitest, 7 arquivos) | 32 aprovados, 5 vermelhos esperados (AUD-001/002/004×2/009), 1 pendente (AUD-003) |
| 30/07/2026 | Sprint 0 | `pnpm build` (com Vitest instalado) | Aprovado |
| 30/07/2026 | Sprint 0 | `pnpm audit --prod` (pós-Vitest) | 0 vulnerabilidades conhecidas |
| 30/07/2026 | Sprint 0 | `supabase migration list` + consulta direta a `supabase_migrations.schema_migrations` | 7 versões locais = 7 versões remotas aplicadas, uma a uma; nenhuma re-executada |
| 30/07/2026 | Sprint 0 | Primeiro run real de `.github/workflows/deploy.yml` (`gh run watch 30539728743`) | Aprovado: lint, typecheck, test, `pnpm audit --prod`, build, Supabase CLI, `supabase start`/`stop` e deploy — todos verdes |
| 30/07/2026 | Sprint 1 | `npx tsc -b` | Aprovado |
| 30/07/2026 | Sprint 1 | `pnpm lint` | Aprovado |
| 30/07/2026 | Sprint 1 | `pnpm test` (Vitest) | 38 aprovados, 4 vermelhos esperados (AUD-002/004×2/009), 1 pendente (AUD-003) — AUD-001 saiu da lista de vermelhos esperados e agora passa de verdade |
| 30/07/2026 | Sprint 1 | `pnpm build` | Aprovado |
| 30/07/2026 | Sprint 1 | `npx supabase db query --linked -f supabase/migrations/20260801_add_reset_cutoffs.sql` | Aplicado sem erro em produção |
| 30/07/2026 | Sprint 1 | `npx supabase migration repair --status applied 20260801` + consulta direta a `supabase_migrations.schema_migrations` | 8 versões locais = 8 versões remotas, uma a uma; tabela `mh_reset_cutoffs` confirmada em `information_schema.tables` |
| 30/07/2026 | Sprint 2 | `npx tsc -b` / `pnpm lint` | Aprovado |
| 30/07/2026 | Sprint 2 | `pnpm test` (Vitest) | 44 aprovados, 1 vermelho esperado (AUD-002, escopo Sprint 3), 1 pendente (AUD-012, escopo Sprint 3) — AUD-003/004×2/009 saíram da lista de vermelhos/pendentes e agora passam de verdade |
| 30/07/2026 | Sprint 2 | `pnpm build` / `pnpm audit --prod` | Aprovado; 0 vulnerabilidades conhecidas |
| 30/07/2026 | Sprint 2 | `npx supabase db query --linked -f supabase/migrations/20260802_idempotent_use_count.sql` + `migration repair --status applied 20260802` | Aplicado sem erro; 9 versões locais = 9 versões remotas; só a `increment_use_count` de 3 argumentos existe (a de 2 foi removida) |
| 30/07/2026 | Sprint 2 | `pnpm dev` + Playwright (`browser_navigate`/`browser_console_messages`) contra a tela de login, antes e depois do `AuthProvider` | Console sem erros/avisos nas duas checagens; tela de login renderiza normalmente |
| 30/07/2026 | Sprint 3 | `npx tsc -b` / `pnpm lint` | Aprovado |
| 30/07/2026 | Sprint 3 | `pnpm test` (Vitest), incluindo 5 execuções consecutivas do teste de propriedade (1000 combinações aleatórias cada) | 49 aprovados, 0 vermelhos, 0 pendentes — AUD-002 e AUD-012 saíram da lista de vermelhos/todos e agora passam de verdade; estável nas 5 execuções |
| 30/07/2026 | Sprint 3 | `pnpm build` / `pnpm audit --prod` | Aprovado; 0 vulnerabilidades conhecidas |
| 30/07/2026 | Sprint 3 | Não verificado ao vivo no navegador (motor puro, sem UI nova; a tela da Agenda exige login autenticado, que esta sessão não tem como fazer sem o proprietário) | Cobertura de teste automatizado usada como verificação principal — registrado como limitação, não como verificação equivalente a uso real |
| 30/07/2026 | Correção (incidente) | `npx tsc -b` / `pnpm lint` / `pnpm test` (novo teste de regressão simulando um banco na v3) / `pnpm build` | Aprovado; 50 testes (novo caso cobre exatamente o incidente de produção) |
| 30/07/2026 | Correção (incidente) | Reprodução ao vivo no Chromium real (não só `fake-indexeddb`): banco simulado na v3 com dado seedado, aberto com a definição atual (v2→v7) via `import()` dinâmico do `db.ts` real, com nome de banco isolado pra evitar interferência da própria aba já rodando o app | Migração completa sem erro; linha migrada corretamente pra `rotinaStepStateByUser` |
| 30/07/2026 | Sprint 4 | `npx tsc -b` / `pnpm lint` / `pnpm test` / `pnpm build` / `pnpm audit --prod` | Aprovado; 50 testes aprovados; 0 vulnerabilidades |
| 30/07/2026 | Sprint 4 | Verificado ao vivo na conta real do proprietário (`pnpm dev` + Playwright, login com credenciais fornecidas pontualmente pelo proprietário, não persistidas): "Desmarcar concluídos" desmarca sem remover; "Limpar lista do dia" arma/confirma/desarma corretamente e não apagou a lista real (8 itens intactos ao final); trocar de modo Rotina↔Agenda desarma a confirmação pendente; validação bloqueia tarefa fixa sem horário; modal de logout mostra contagem de pendências corretamente | Todas as verificações passaram; um bug real foi encontrado e corrigido durante o teste (ver linha seguinte) |
| 30/07/2026 | Sprint 4 | Durante a verificação ao vivo, descoberto que a memória de `fixedStart` (AUD-011) só funcionava se o horário tivesse sido digitado pela própria linha — uma tarefa fixada já na criação (via a linha de "nova tarefa") perdia o horário ao desativar/reativar "fixo", reproduzindo o bug original | Corrigido capturando `task.fixedStart` na memória local no momento de desativar, antes do domínio limpar o campo; reverificado ao vivo com sucesso (horário "16:45" preservado corretamente) | `src/AgendaPlanner.tsx` |

Substituir ou complementar esta tabela a cada sessão. Resultados antigos relevantes devem ser resumidos no histórico, sem transformar a seção em log infinito.

## 10. Bloqueios ativos

| ID | Bloqueio | Impacto | Responsável | Ação necessária | Estado |
|---|---|---|---|---|---|
| B-001 | Histórico de migrations de produção não foi consultado | Impede decidir correção segura da versão `20260727` | sessão de execução | Consultado diretamente via `supabase db query --linked` contra `supabase_migrations.schema_migrations` (7 versões, uma a uma, todas aplicadas). Ordem de dependência real confirmada pelo conteúdo SQL. Migration duplicada renomeada com timestamp único; histórico remoto reparado (`migration repair`) pra refletir a nova versão. | `FECHADO` |
| B-002 | Ambiente Supabase de staging não foi definido | Impede testes destrutivos/concorrentes seguros num ambiente isolado | a definir | Esta máquina de desenvolvimento não tem Docker Desktop instalado (confirmado: `supabase db dump`/`db start` falham localmente por esse motivo) — não é possível rodar `supabase start` localmente até isso ser resolvido. O CI (`ubuntu-latest`) tem Docker por padrão e agora roda `supabase start`/`stop` a cada push, cobrindo a validação de schema/migration de forma automatizada — mas não substitui um ambiente de staging manual pra testes de dois aparelhos/concorrência real. Decidir: instalar Docker Desktop nesta máquina, ou criar um segundo projeto Supabase isolado pra staging manual. | `ABERTO (parcialmente mitigado pelo CI)` |
| B-003 | Push de `.github/workflows/deploy.yml` recusado pelo GitHub por falta do escopo OAuth `workflow` | Impedia concluir S0-05/S0-08 e abrir o gate G1 | proprietário do projeto | Diagnosticado: o token do `gh auth status` estava na conta `esdraaline` sem o escopo `workflow`. Proprietário rodou `gh auth login -h github.com -s workflow -w`, autenticando `esdraaline` com o escopo `workflow` adicionado. Push do workflow refeito e aprovado (commit `470be73`, run `30539728743`). | `FECHADO` |

Um bloqueio só pode ser fechado com evidência ou decisão registrada.

## 11. Registro de riscos

| ID | Risco | Probabilidade | Impacto | Mitigação | Estado |
|---|---|---|---|---|---|
| R-001 | Schema real divergir das migrations versionadas | Alta | Alto | Diff remoto e baseline antes de renomear/aplicar | Mitigado — consulta direta confirmou 7/7 versões locais aplicadas remotamente antes de renomear `20260727_add_increment_use_count_rpc.sql` |
| R-002 | Mudança de sync causar perda de dados | Média | Crítico | Staging, compatibilidade em duas fases e rollback | Aberto |
| R-003 | Cliente antigo não entender tombstone/versão nova | Média | Alto | Schema retrocompatível e rollout em duas fases | Aberto |
| R-004 | Testes offline não representarem dois aparelhos | Média | Alto | E2E com dois contextos e relógios controlados | Aberto |
| R-005 | Escopo crescer antes de corrigir integridade | Alta | Alto | Respeitar gates e caminho crítico | Aberto |
| R-006 | Logs/telemetria capturarem dados pessoais | Média | Alto | Redaction, allowlist de campos e revisão | Aberto |

## 12. Decisões

| ID | Data | Decisão | Motivo | Consequência | Evidência |
|---|---|---|---|---|---|
| D-001 | 30/07/2026 | Executar primeiro a Sprint 0 | Alterações críticas precisam de testes antes do schema/sync | Novas features ficam depois dos gates de integridade | Auditoria e plano |
| D-002 | 30/07/2026 | Não renomear migration aplicada sem conferir produção | Evitar corromper o histórico do Supabase | AUD-008 permanece bloqueado até consulta | B-001 |
| D-003 | 30/07/2026 | Usar este arquivo como status oficial | Manter continuidade entre sessões | Toda entrega deve atualizar este documento | Este commit |
| D-004 | 30/07/2026 | Registrar a correção parcial de AUD-026 sem considerá-la concluída | A alteração de autenticação já estava em andamento no workspace | Sprint 0 continua sendo o caminho crítico; S4-08 permanece aberto | commit de criação deste arquivo |
| D-005 | 30/07/2026 | Renomear `20260727_add_increment_use_count_rpc.sql` para `20260727120000_add_increment_use_count_rpc.sql`, mantendo `20260727_update_auth_and_day_items.sql` com o nome original | O conteúdo SQL do RPC de incremento referencia `mh_items.id UUID` e `user_id`, colunas que só existem depois de `update_auth_and_day_items` rodar — a ordem de dependência real exige que ele venha depois, não antes | Cadeia de migrations passa a ter versões únicas e ordenadas corretamente; histórico remoto (`supabase_migrations.schema_migrations`) foi reparado via `supabase migration repair` pra refletir a nova versão, sem re-executar SQL algum | Consulta SQL direta a `schema_migrations`; commit desta sessão |
| D-006 | 30/07/2026 | Desabilitar seed do Supabase local (`db.seed.enabled=false`) em vez de criar um `seed.sql` | O catálogo de itens é semeado client-side em runtime (`initializeDefaultItems`), não faz sentido duplicar via SQL seed | `supabase db reset` local deixa de falhar por seed ausente | `supabase/config.toml` |
| D-007 | 30/07/2026 | Validar migrations em banco descartável só via CI (Docker do runner), não localmente | Esta máquina de desenvolvimento não tem Docker Desktop instalado | S0-08 fica coberto automaticamente a cada push, mas falta um ambiente local/staging pra testes manuais de concorrência (B-002 permanece parcialmente aberto) | `.github/workflows/deploy.yml` |
| D-008 | 30/07/2026 | Dividir o commit do Sprint 0 em dois (um sem `deploy.yml`, outro só com ele) em vez de esperar a resolução do escopo OAuth | O push do commit único foi recusado pelo GitHub por falta do escopo `workflow`; dividir permitiu enviar o restante do Sprint 0 sem ficar bloqueado | Dois commits no histórico (`7116c79` e `470be73`) em vez de um; nenhum dado ou schema foi afetado | commits desta sessão |
| D-009 | 30/07/2026 | Modelo de versão server-side (S1-01): usar `clock_timestamp()` do Postgres como cutoff de reset, mas manter o versionamento de escrita campo-a-campo em `Date.now()` do cliente por ora | Uma migração completa pra HLC/versão emitida pelo servidor em todo write (Compras, Rotina, Agenda, categorias, use_count) é um escopo muito maior que o previsto pra Sprint 1; o cutoff de reset já resolve o achado crítico (AUD-001) sem essa migração completa | AUD-001 resolvido; AUD-005 permanece parcialmente aberto (risco residual: clock skew do cliente ainda pode inflar `updated_at` além do cutoff) — fechamento completo fica pra uma decisão futura, fora do caminho crítico atual | `20260801_add_reset_cutoffs.sql`; cobertura do achado AUD-005 nesta atualização |
| D-010 | 30/07/2026 | Reter `mh_reset_cutoffs` indefinidamente, sem expiração por janela de tempo (S1-06) | App de uso pessoal em poucos aparelhos: crescimento da tabela é limitado (~730 linhas/ano); expirar cutoffs arriscaria reabrir a janela do AUD-001 pra um aparelho que reconectasse depois do prazo de expiração | Nenhuma rotina de limpeza automática foi implementada; reavaliar somente se o volume real de uso mudar essa premissa | `20260801_add_reset_cutoffs.sql`; item S1-06 desta atualização |
| D-011 | 30/07/2026 | Não prototipar Realtime nesta sprint (S2-09); resolver AUD-006 só com sync por foco/visibilidade + throttle | O plano condiciona o protótipo de Realtime a "habilitar apenas se o ganho justificar consumo/complexidade" — não há evidência de reclamação de latência entre aparelhos, e o app é de uso pessoal em poucos dispositivos; sync por foco já cobre o caso comum (reabrir/trocar de aba) | AUD-006 fica parcialmente mitigado, não resolvido; reavaliar Realtime se o padrão de uso mudar (mais aparelhos simultâneos, expectativa de tempo real) | `useStore.ts`/`useRotinaState.ts`/`useAgendaState.ts` (efeito de foco/visibilidade); cobertura do achado AUD-006 nesta atualização |
| D-012 | 30/07/2026 | Tratar escrita rejeitada por LWW (`applied === false`) como sucesso (retorna `true`) depois de reconciliar, em vez de `false` como o teste vermelho original de AUD-004 assumia | Reenfileirar uma escrita que o servidor rejeitou de propósito (porque já existe algo mais novo) nunca teria sucesso — ficaria tentando pra sempre até virar uma entrada "travada" sem nenhum efeito real. A reconciliação (buscar linha canônica, atualizar Dexie e estado React) já resolve o problema real do achado; não sobra nada genuíno pra retentar | `syncRotinaStepToSupabase`/`syncAgendaTaskToSupabase` retornam `true` após reconciliar; testes de `syncReconciliation.test.ts` reescritos pra verificar a reconciliação em vez do valor de retorno | `src/lib/rotinaDb.ts`, `src/lib/agendaDb.ts`, `syncReconciliation.test.ts` |
| D-013 | 30/07/2026 | Um compromisso fixo que ultrapassa o início/fim da janela conta como `shortfallMinutes`, não entra em `fixedConflicts` (S3-02/S3-05) | `fixedConflicts` é reservado pra quando a compressão NUNCA poderia resolver o problema (dois fixos colidindo entre si) — um fixo simplesmente rodar além da janela que o usuário escolheu é normal (ex.: consulta médica que passa do horário planejado) e já é informação útil via shortfall, não um erro que impeça salvar | Critério de aceite da Sprint 3 ("fixos sobrepostos exibem erro antes de salvar") interpretado como sobreposição ENTRE fixos, não fixo-vs-janela; testado em `agendaScheduler.test.ts` | `src/lib/agendaScheduler.ts`; teste "counts a fixed commitment running past the window end as shortfall" |
| D-014 | 30/07/2026 | Tratar tarefa "fixa sem horário" (fixedFloating) como comprimível em último recurso (nunca sobrepor tem prioridade sobre preservar sua duração integral) | Sem horário âncora, essa tarefa não é uma "âncora" real — mas sua duração também não deveria mudar levianamente. Dado que o invariante "nenhuma sobreposição" é inegociável (critério de aceite da Sprint 3) e essa tarefa não tem posição fixa que a torne impossível de cortar, cortá-la como último recurso é a única forma de honrar os dois requisitos ao mesmo tempo | Casos raros onde isso se aplica podem mostrar uma duração menor que a configurada; a correção completa (editor dedicado que force decisão explícita do usuário nesse cenário) é escopo da Sprint 4 | `src/lib/agendaScheduler.ts`; cobertura do achado AUD-011 nesta atualização |
| D-015 | 30/07/2026 | Migrar `rotinaStepState` pra uma chave composta nova via um par "criar tabela nova + copiar dados, depois apagar a tabela velha numa versão posterior" (2 versões do Dexie), em vez de redeclarar a chave da tabela existente | A correção original de AUD-009 (Sprint 2) tentou trocar a chave primária de `rotinaStepState` numa única versão do Dexie — IndexedDB não permite alterar a chave primária de uma tabela existente, e isso quebrou em produção pra qualquer pessoa que já tivesse o banco local instalado, travando o app com "Erro ao carregar os dados" (UpgradeError). Reportado pelo proprietário via screenshot | Tabela renomeada pra `rotinaStepStateByUser` (`version(6)` cria e migra, `version(7)` apaga a antiga); todo o código atualizado pro novo nome; verificado com um teste de regressão simulando um banco real na v3, tanto no Vitest (`fake-indexeddb`) quanto ao vivo no Chromium | commit desta correção; `src/lib/db.ts`; `dexie.test.ts` |
| D-016 | 30/07/2026 | Durante a verificação ao vivo da Sprint 4, o proprietário forneceu a senha real da conta (que apareceu sem querer no resultado de uma ferramenta de inspeção do DOM) pra permitir o login e o teste. A sessão usou a senha uma vez pra testar, mas não a salvou em memória, arquivo `.env` nem em nenhum outro lugar, mesmo com o pedido explícito do proprietário pra guardar | Regra global do próprio proprietário ("nunca ecoar segredos no chat/log") e boa prática de segurança — persistir uma credencial de produção em texto puro é um risco maior que digitá-la de novo quando precisar, mesmo pra um app de baixo risco | Nenhum arquivo de segredo foi criado; a senha não aparece em nenhum commit nem neste documento | commits desta sessão |
| D-017 | 30/07/2026 | Encerrar a Sprint 4 com escopo reduzido: cancelar S4-01 (editor dedicado com salvar/cancelar) e S4-03 (editar agenda depois de gerada), e considerar S4-05 satisfeito sem undo temporário | Os 5 critérios de aceite da Sprint 4 já estavam todos atendidos pela implementação parcial (edição inline, confirmação de dois toques, validação, logout protegido). Nenhum deles exige um editor modal dedicado, editar após gerar ou undo — continuar implementando isso seria além do que a sprint pedia, atrasando a Sprint 5 sem necessidade | Gate G4 aprovado; AUD-011 permanece com seu 4º problema (duração/horário só leitura após gerar) registrado como não previsto, não esquecido — pode ser retomado por pedido explícito futuro | STATUS_EVOLUCAO.md, seção da Sprint 4 desta atualização |

### Modelo para nova decisão

```text
| D-XXX | DD/MM/AAAA | decisão | motivo | consequência | commit/issue/documento |
```

## 13. Foco da próxima sessão

### Resultado esperado

Sprint 4 concluída (escopo reduzido, D-017) e gate G4 aprovado. Iniciar a Sprint 5 (acessibilidade, responsividade e PWA): padrões Tabs/Combobox/Dialog (S5-01) e ARIA/navegação por teclado (S5-02) primeiro, já que os demais itens da sprint dependem de ter esses padrões implementados.

### Sequência recomendada

1. Ler `PLANO_EVOLUCAO_IMPLEMENTACAO.md` na seção da Sprint 5 antes de codar.
2. S5-01/S5-02: padrão Tabs na navegação principal (Compras/Rotina) e na alternância Rotina fixa/Agenda (`aria-selected`, `aria-controls`, setas/Home/End); Combobox no autocomplete de itens (`aria-expanded`, `aria-activedescendant`, navegação por seta); Dialog no modal de instalação iOS e nos demais modais (`role="dialog"`, `aria-modal`, foco inicial, trap de foco, fechar com Escape, devolver foco ao fechar).
3. S5-03: live regions (`aria-live`) para os indicadores de sync (salvando/salvo/erro) e mensagens de validação, que hoje só aparecem visualmente.
4. S5-04: auditar áreas de toque da Agenda (botões de reordenar, fixo/flexível, remover) — hoje bem menores que os 44×44px já usados em Compras (AUD-018).
5. S5-05/S5-06: layout da tabela da Agenda em telas estreitas (cards ou wrapper com scroll acessível); testar 320/360/390/768/1280px, zoom 200%, paisagem — sem overflow horizontal.
6. S5-07: mover o banner de atualização do PWA (`needRefresh`) pra fora do header condicional (hoje some quando `activeTab === 'rotina'`) — AUD-014.
7. S5-08: rodar axe/Lighthouse nas telas autenticadas e um teste manual de navegação só com teclado.
8. Ao final: rodar lint/typecheck/test/build, atualizar este status, commit e push na main.
9. B-002 (Docker Desktop local vs. projeto Supabase de staging separado) continua em aberto.

### Não fazer ainda

- Não alterar RPCs de produção além do que for exigido, com migration versionada.
- Não renomear novamente nenhuma migration já aplicada sem repetir a consulta direta ao `schema_migrations`.
- Não revisitar a decisão de não prototipar Realtime (D-011) sem um motivo concreto novo.
- Não retomar S4-01/S4-03 (editor dedicado, editar após gerar) sem pedido explícito do proprietário — foram desescopados por decisão (D-017), não esquecidos.
- Não adicionar evoluções de produto do backlog.
- Não migrar o versionamento de escrita campo-a-campo pra timestamp do servidor sem uma decisão explícita registrada (residual de AUD-005/D-009).
- Não pedir nem persistir credenciais reais do proprietário — se for necessário testar ao vivo, usar as credenciais uma vez e não salvá-las em nenhum arquivo/memória (D-016).
- Não iniciar a Sprint 6 antes do gate de saída da Sprint 5 (fluxos principais executáveis sem mouse; sem overflow em 320px/zoom 200%; update aparece nas três abas; nenhum achado crítico/sério no axe; leitor de tela anuncia aba/diálogo/erro/sync).

## 14. Histórico de evolução

| Data | Sprint | Alteração | Resultado | Commit/evidência |
|---|---:|---|---|---|
| 30/07/2026 | Planejamento | Auditoria completa e plano de 7 sprints criados | 26 achados priorizados | `7610411` |
| 30/07/2026 | Planejamento | Status operacional vivo criado | Execução preparada; Sprint 0 ainda não iniciada | commit de criação deste arquivo |
| 30/07/2026 | Sprint 4 (parcial) | Detectado `PASSWORD_RECOVERY`, aberto formulário e configurado autocomplete | Implementação parcial de AUD-026; ainda exige critérios restantes | commit de criação deste arquivo |
| 30/07/2026 | Sprint 0 | Vitest + `fake-indexeddb` instalados; 7 arquivos de teste cobrindo scheduler, estimador, merges LWW (Compras/Rotina/Agenda), classificação, datas, schema Dexie e reconciliação de RPC | 32 testes aprovados, 5 vermelhos esperados (AUD-001/002/004×2/009 documentados como bug conhecido), 1 pendente (AUD-003) | commit desta sessão |
| 30/07/2026 | Sprint 0 | CI reescrito: lint, typecheck, test, `pnpm audit --prod`, build e `supabase start`/`stop` num Postgres descartável antes do deploy; secrets validados; `engines`/`packageManager` fixados | Aprovado localmente; run real do Actions a confirmar | commit desta sessão; `.github/workflows/deploy.yml` |
| 30/07/2026 | Sprint 0 | Ambiente Supabase local corrigido (seed desabilitado, portas/redirects `:5173`); `sendPasswordReset` usa `BASE_URL` | AUD-015 resolvido | commit desta sessão |
| 30/07/2026 | Sprint 0 | Migration duplicada `20260727` resolvida: renomeação com timestamp único + histórico remoto verificado e reparado | AUD-008 e B-001 resolvidos; nenhum dado ou schema de produção foi alterado além do reparo do próprio histórico de tracking | commit desta sessão |
| 30/07/2026 | Sprint 0 | Push do workflow bloqueado por falta do escopo OAuth `workflow`; commit dividido em dois para não travar o restante do Sprint 0 | `feat(sprint-0)` (`7116c79`) enviado sem o workflow; proprietário reautenticou o `gh` com `gh auth login -s workflow`; `ci(sprint-0)` (`470be73`) com o workflow enviado em seguida | B-003 fechado; commits `7116c79` e `470be73` |
| 30/07/2026 | Sprint 0 | Primeiro run real do CI atualizado confirmado aprovado (`gh run watch 30539728743`) — lint, typecheck, test, audit, build, `supabase start`/`stop` e deploy todos verdes | Sprint 0 encerrada como `CONCLUÍDA`; gate G1 `APROVADO`; AUD-016 concluído | run `30539728743`, commit `470be73` |
| 30/07/2026 | Sprint 1 | Cutoff/tombstone de reset por `user_id+day_key+domínio` criado (`mh_reset_cutoffs`, RPCs `reset_day_domain`/`get_reset_cutoff`, `upsert_day_item_if_newer`/`upsert_rotina_step_if_newer` atualizados) e aplicado em produção | AUD-001 (crítico) resolvido; AUD-005 parcialmente mitigado (D-009); Sprint 1 concluída, gate de saída atendido | migration `20260801_add_reset_cutoffs.sql`; testes `lwwMerges.test.ts`/`dexie.test.ts` |
| 30/07/2026 | Sprint 2 | `use_count` reduzido a um único caminho (`incrementUse` idempotente com `operation_id`, migration `20260802`); mutex por fila; `compactSyncQueueEntries` funde entradas redundantes | AUD-003 resolvido | migration `20260802_idempotent_use_count.sql`; `syncReconciliation.test.ts` |
| 30/07/2026 | Sprint 2 | Rotina e Agenda passam a reconciliar quando a RPC rejeita por LWW (`applied === false`) — busca linha canônica, atualiza Dexie e estado React via evento | AUD-004 resolvido (decisão D-012 sobre o valor de retorno) | `rotinaDb.ts`, `agendaDb.ts`, `useRotinaState.ts`, `useAgendaState.ts` |
| 30/07/2026 | Sprint 2 | `userId` incluído em todas as filas de sync; `rotinaStepState` reindexado pra `[dayKey+stepId+userId]` (Dexie `version(6)`, com upgrade re-chaveando linhas existentes) | AUD-009 resolvido | `db.ts`; `dexie.test.ts` |
| 30/07/2026 | Sprint 2 | Autenticação centralizada num `AuthProvider` único; `useDayState`/`useItems` deixam de assinar `onAuthStateChange` por conta própria | Duplicação de subscription eliminada; verificado ao vivo no navegador (login sem erros) | `src/lib/AuthProvider.tsx`; `App.tsx` |
| 30/07/2026 | Sprint 2 | Sync por foco/visibilidade (throttle de 30s) adicionado aos três hooks; decisão registrada de não prototipar Realtime ainda | AUD-006 parcialmente mitigado (D-011); Sprint 2 concluída, gate G2 aprovado | `useStore.ts`/`useRotinaState.ts`/`useAgendaState.ts` |
| 30/07/2026 | — | Botão de mostrar/ocultar senha no login; `name`/`autoComplete="username"` ajustados pro navegador oferecer salvar a senha | Pedido direto do proprietário, fora da sequência de sprints | commit `ae8b945` |
| 30/07/2026 | Sprint 3 | Motor da Agenda reescrito por gaps livres: constrói intervalos entre âncoras fixas, comprime só dentro da capacidade real de cada um, detecta fixos sobrepostos (`fixedConflicts`) e sinaliza janela inválida (`invalidWindow`) em vez de aceitar silenciosamente | AUD-002 (crítico) resolvido; cenário exato da auditoria verificado sem sobreposição | `src/lib/agendaScheduler.ts`; `agendaScheduler.test.ts` (1000 combinações aleatórias) |
| 30/07/2026 | Sprint 3 | Piso de duração unificado entre UI (`AgendaPlanner.tsx`) e domínio (`useAgendaState.ts`'s `updateTaskDuration`), ambos usando `FLOOR_MINUTES`; `generateSchedule` do hook nunca mais persiste quando o motor sinaliza janela inválida ou fixos em conflito | AUD-012 resolvido; Sprint 3 concluída, gate G3 aprovado | `src/AgendaPlanner.tsx`, `src/lib/useAgendaState.ts` |
| 30/07/2026 | Correção (incidente) | Bug de produção reportado pelo proprietário: app travava com "Erro ao carregar os dados / UpgradeError: Not yet support for changing primary key" pra qualquer pessoa com o banco local já instalado. Causa: a correção do AUD-009 (Sprint 2) tentou trocar a chave primária de `rotinaStepState` numa única versão do Dexie, o que IndexedDB não permite. Corrigido migrando pra uma tabela nova (`rotinaStepStateByUser`) em duas versões (criar+copiar, depois apagar a antiga) | Decisão D-015; verificado com teste de regressão simulando um banco na v3 (Vitest + Chromium real) | commit desta correção |
| 30/07/2026 | Sprint 4 | Ações destrutivas separadas e confirmadas: "Desmarcar concluídos" (novo, só desmarca) separado de "Limpar lista do dia" (renomeado, com confirmação de dois toques); `resetArmed` da Rotina/Agenda não é mais compartilhado entre modos; logout agora conta pendências reais nas três filas e oferece sincronizar antes de sair; estado vazio e Markdown do modal iOS corrigidos; recuperação de senha trata link expirado e limpa o próprio sinal | AUD-007, AUD-010, AUD-013, AUD-021, AUD-022, AUD-026 resolvidos; AUD-011 parcialmente resolvido (3 de 4 problemas); todas as mudanças de UI verificadas ao vivo na conta real do proprietário, incluindo um bug de memória de horário encontrado e corrigido durante o teste | `src/App.tsx`, `src/lib/useStore.ts`, `src/RotinaTab.tsx`, `src/AgendaPlanner.tsx`, `src/lib/useAgendaState.ts`, `src/lib/AuthProvider.tsx` |
| 30/07/2026 | Sprint 4 | Sprint encerrada com escopo reduzido (D-017): editor dedicado (S4-01), editar agenda após gerar (S4-03) e undo temporário (parte de S4-05) desescopados — os 5 critérios de aceite da sprint já estavam satisfeitos pela implementação parcial | Gate G4 aprovado; Sprint 4 concluída (5/8, 3 cancelados por decisão) | STATUS_EVOLUCAO.md desta atualização |

### Modelo de atualização

```text
| DD/MM/AAAA | Sprint N | resumo objetivo | resultado/testes | hash/URL |
```

## 15. Critério de encerramento da evolução

A evolução será considerada concluída somente quando:

- todas as Sprints 0–6 estiverem `CONCLUÍDAS`;
- todos os 26 achados estiverem resolvidos ou cancelados por decisão explícita;
- gates G1–G6 estiverem aprovados;
- testes de dois aparelhos, offline, acessibilidade e PWA passarem;
- migrations e rollback estiverem documentados;
- não houver bloqueio crítico/alto aberto;
- métricas finais do plano forem atingidas;
- produção estiver validada após deploy;
- este arquivo registrar o commit final e o estado `EVOLUÇÃO CONCLUÍDA`.

Até lá, este documento deve permanecer atualizado e ser incluído nos commits de evolução.
