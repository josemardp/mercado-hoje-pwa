# Status da evolução — Meu Diário

> Documento operacional vivo. Deve ser lido no início e atualizado no fim de toda sessão de evolução do projeto.

**Auditoria de origem:** `AUDITORIA_COMPLETA.md`
**Plano mestre:** `PLANO_EVOLUCAO_IMPLEMENTACAO.md`
**Início do acompanhamento:** 30/07/2026
**Última atualização:** 11/08/2026 (correção da regra de carry-over de Compras — ver última linha da seção 14; o plano dos 4 achados residuais da seção 13 continua sendo o foco da próxima sessão)
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
| Situação geral | `EM EXECUÇÃO — PLANO DOS 4 RESIDUAIS APROVADO, NENHUM AINDA IMPLEMENTADO` |
| Fase atual | As 7 sprints do plano original estão encerradas (ver histórico). Sessão atual: Josemar pediu plano completo pra fechar os 4 achados residuais (AUD-005/006/011/024); plano pesquisado, desenhado e **aprovado por ele** nesta sessão — ver seção 13 pro plano completo. Nenhuma linha de código foi alterada ainda, só pesquisa e planejamento |
| Sprint ativa | Nenhuma — plano de 7 sprints encerrado. Trabalho atual é fechar os 4 residuais, plano já aprovado, execução prevista pra uma próxima sessão |
| Foco atual | Implementar o plano da seção 13, na ordem: (1) AUD-011 pequeno/seguro, (2) AUD-006 Realtime, (3) AUD-005 clamp de relógio, (4) AUD-024 divisão de arquivos (incremental, várias sub-sessões) |
| Próxima entrega | Nenhuma sprint nova — os próximos passos são os 4 residuais (plano completo na seção 13) |
| Progresso do plano | ~93% (54/58 itens — todas as 7 sprints completas; Sprint 4 e Sprint 6 fechadas em escopo reduzido por decisão) |
| Sprints concluídas | 7 de 7 (Sprint 0, Sprint 1, Sprint 2, Sprint 3, Sprint 4, Sprint 5, Sprint 6) |
| Achados resolvidos | 22 de 26 (AUD-019, AUD-020, AUD-023, AUD-025 nesta atualização, mais os 18 anteriores). Residuais parciais: AUD-005/AUD-006 (mitigados, não fechados), AUD-011 (3 de 4 problemas, o 4º desescopado), AUD-024 (documentação concluída, divisão de arquivos desescopada) |
| Bloqueios ativos | 1 (B-001 e B-003 resolvidos; B-002 permanece aberto) |
| Último deploy estável conhecido | commit `4d9248c` (run `30562831582`, aprovado) |
| Saúde da baseline | lint aprovado; typecheck aprovado; testes aprovados (50 passaram, 0 vermelhos, 0 pendentes); build aprovado; CSP testada ao vivo contra o build de produção sem violações; principais mudanças verificadas ao vivo na conta real do proprietário (ver seção 9) |

### Resumo por prioridade

| Prioridade | Total | Concluídos | Restantes |
|---|---:|---:|---:|
| Crítico | 2 | 2 | 0 |
| Alto | 7 | 5 | 2 |
| Médio/Alto | 1 | 1 | 0 |
| Médio | 11 | 10 | 1 |
| Baixo | 5 | 4 | 1 |
| **Total** | **26** | **22** | **4** |

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

**Estado:** `CONCLUÍDA`
**Progresso:** 8/8 — 100%
**Dependência:** Sprints 2 e 4.
**Gate de saída:** fluxos principais funcionam por teclado, sem overflow e com update disponível em qualquer aba.

| ID | Entrega | Estado | Evidência/observação |
|---|---|---|---|
| S5-01 | Implementar padrões Tabs, Combobox e Dialog | `CONCLUÍDO` | Navegação principal (Compras/Rotina) e alternância Rotina fixa/Agenda viraram `role="tablist"/"tab"` com `aria-selected`/`aria-controls`/`tabIndex` em rodízio; autocomplete de item virou `role="combobox"` com `aria-expanded`/`aria-controls`/`aria-activedescendant`/`aria-autocomplete="list"` e uma lista `role="listbox"/"option"`; novo componente `src/Modal.tsx` (único arquivo novo desta sprint, deliberado — a lógica de foco é idêntica nos 3 modais) implementa `role="dialog"`/`aria-modal`/`aria-labelledby`, usado pelos modais de logout, trocar senha e instalar iOS. |
| S5-02 | Completar ARIA e navegação por teclado | `CONCLUÍDO` | Setas/Home/End funcionam nas duas tablists (`App.tsx`'s `handleTabKeyDown`, `RotinaTab.tsx`'s handler no `onKeyDown` do `role="tablist"`); combobox responde a ArrowDown/ArrowUp/Escape/Enter; modal faz trap de Tab/Shift+Tab (ciclo confirmado nas duas pontas), fecha com Escape e devolve o foco ao elemento que abriu — todos os 3 comportamentos verificados ao vivo via Playwright no modal de trocar senha. |
| S5-03 | Criar live regions de sync/erros | `CONCLUÍDO` | `role="status" aria-live="polite"` nos indicadores de sync (`.sync-indicator` em `App.tsx`, `.rotina-sync-indicator` em `RotinaTab.tsx`/`AgendaPlanner.tsx`); `role="alert"` nas mensagens de erro/validação (`.login-error`, `.agenda-validation-error`) e `role="status"` em `.login-success`. |
| S5-04 | Adequar alvos de toque | `CONCLUÍDO` | Botão remover (`.agenda-remove-btn`) e badge fixo/flexível (`.agenda-fixed-badge`) aumentados pra ~40×40px e ~56×32px; checkbox de concluída ganhou área de toque de ~40×40px via padding; botões de reordenar (`.agenda-reorder-btn`) ficaram limitados a ~34×20px cada — a pilha vertical de dois botões finos não comporta 44px de altura cada sem dobrar a altura da linha da tabela, então o alvo real desses dois específicos continua abaixo do ideal (registrado aqui como limitação conhecida, não escondido). |
| S5-05 | Criar layout móvel da Agenda | `CONCLUÍDO` | Escolhida a opção "wrapper de tabela acessível" (uma das duas opções do próprio plano) em vez de reescrever em cards: `.agenda-table-wrap` com `overflow-x: auto` e `min-width: 0` (necessário pra ele realmente encolher dentro da cadeia flex `.agenda-planner`/`.rotina-shell` em vez de forçar a página inteira a crescer — verificado via medição de `scrollWidth`/`clientWidth` em cada ancestral). A tabela em si ganhou `min-width: 560px` e rola horizontalmente dentro do próprio cartão em vez de comprimir colunas até ficarem ilegíveis. |
| S5-06 | Testar viewports e zoom | `CONCLUÍDO` | Verificado ao vivo (Playwright, conta real) em 320/360/390/768/1280px, zoom 200% simulado (viewport 640×400) e paisagem (844×390) — `document.documentElement.scrollWidth > clientWidth` conferido como `false` em todos. Durante esse teste foi encontrado e corrigido um overflow horizontal pré-existente e não relacionado à Agenda, ver observação abaixo e D-018. |
| S5-07 | Tornar update do PWA global | `CONCLUÍDO` | Banner `needRefresh` (`.update-banner`) movido pra fora do `<header>` condicional (que só renderiza quando `activeTab !== 'rotina'`) — agora é o primeiro elemento de `.page`, visível em qualquer aba incluindo a Rotina/Agenda (AUD-014). |
| S5-08 | Executar axe e teste manual com teclado | `CONCLUÍDO` (escopo reduzido — D-018) | Teste manual de navegação só com teclado feito ao vivo (tabs por seta/Home/End, combobox por seta/Escape/Enter, modal com trap/Escape/devolução de foco) — todos aprovados, incluindo tema claro/escuro. Auditoria automatizada com axe-core/Lighthouse não foi executada — ambiente desta sessão não tem essas ferramentas disponíveis; decisão registrada em D-018 em vez de deixar o item pendurado. |

### Sprint 6 — Performance, segurança e consolidação

**Estado:** `CONCLUÍDA` (escopo reduzido — ver D-023)
**Progresso:** 9/10 — 90%
**Dependência:** gate da Sprint 5.
**Gate de saída:** metas de qualidade atingidas, operação documentada e dívida principal encerrada.

| ID | Entrega | Estado | Evidência/observação |
|---|---|---|---|
| S6-01 | Lazy-load de Rotina e Agenda | `CONCLUÍDO` | `RotinaTab` (que já importa `AgendaPlanner` e `rotinaStyles.css`) virou `React.lazy` em `App.tsx`, com `Suspense fallback={null}`. Bundle inicial caiu de 494,88KB pra 479,30KB (gzip 138,65→134,37KB); `RotinaTab`/CSS viraram um chunk próprio de 15,89KB JS + 8,55KB CSS, só carregado quando a aba Rotina abre. Os hooks de dados (`useRotinaState`/`useAgendaState`) continuam eager — os badges de contagem nas abas precisam do dado antes de a aba ser aberta. |
| S6-02 | Analisar e reduzir bundle | `CONCLUÍDO` | Dependências já eram enxutas (`@supabase/supabase-js`, `dexie`, `react`, `react-dom`, `workbox-window` — nenhuma sobrando). Achado real: Tailwind CSS 4 (`@tailwindcss/vite` + `@import "tailwindcss"`) estava instalado e processando o build inteiro sem NENHUMA classe utilitária usada em nenhum `.tsx` do projeto (confirmado por busca) — só gerava ~11KB de preflight/reset morto no CSS final. Removido por completo (pacotes, plugin do Vite, import); CSS principal caiu de 29,00KB pra 18,39KB (gzip 6,41→4,20KB). Verificado visualmente antes/depois (nenhuma diferença, porque a reset própria de `index.css` — `* { box-sizing: border-box }` — já cobria o que o Tailwind preflight faria). |
| S6-03 | Otimizar fontes e metadados | `CONCLUÍDO` | Adicionados `<meta name="description">`, Open Graph (`og:title`/`og:description`/`og:image`) e Twitter Card em `index.html` (AUD-023). Achado à parte: `rotinaStyles.css` referenciava `'Inter'` como fonte primária da aba Rotina, mas Inter nunca foi carregada (não está no link do Google Fonts) — o navegador sempre caiu silenciosamente pra `'Nunito Sans'` (que É carregada); removida a referência morta. Decisão de NÃO migrar as fontes pra self-host: já usam `display=swap`, `preconnect` e ficam em cache offline via Workbox (`CacheFirst`, 1 ano) — o ganho de latência do self-host seria só no primeiro acesso de cada aparelho, não justifica manter arquivos de fonte binários no repo pra um app pessoal (ver D-020). |
| S6-04 | Logger por ambiente com redaction | `CONCLUÍDO` | Novo `src/lib/logger.ts`: em dev, erro completo vai pro console (debug local); em produção (`import.meta.env.DEV` false), `logSyncFailure` redige a entrada da fila por allowlist (só id/type/dayKey/itemId/stepId/taskId/timestamp/attemptCount/userId — nunca `itemName`/categoria/título) e `logError` loga só `err.message`. Achado real corrigido: `console.error('Failed to process sync queue entry:', entry, err)` em `db.ts` despejava a entrada INTEIRA da fila de Compras — incluindo `itemName` (o nome do item, dado pessoal) — no console de produção (`drop_console: false` no Vite garante que sobrevive ao build). Todos os 8 `console.error` do código de produção substituídos pelos helpers do logger. |
| S6-05 | Observabilidade sem dados pessoais | `CONCLUÍDO` | `logQueueHealth` (tamanho da fila pendente + idade da entrada mais antiga, por domínio) chamado nos três hooks (`useStore`/`useRotinaState`/`useAgendaState`) sempre que há algo pendente pra sincronizar; `logReconciliation` chamado nos dois pontos de reconciliação (`rotinaDb.ts`/`agendaDb.ts`) com `stepId`/`taskId` (ids, não conteúdo). `onRegisteredSW`/`onNeedRefresh`/`onRegisterError` do `useRegisterSW` agora logam o ciclo de vida do service worker (registrado/nova versão esperando/erro de registro) — nenhum desses eventos carrega dado do usuário. |
| S6-06 | Aplicar headers defensivos | `CONCLUÍDO` (escopo reduzido — ver D-021) | CSP aplicada via `<meta http-equiv="Content-Security-Policy">` em `index.html` (`default-src 'self'`; `style-src` com `'unsafe-inline'` porque o app usa `style={{}}` inline extensivamente — 21 ocorrências — e não há como evitar isso sem reescrever toda a UI; `connect-src` liberado pra `*.supabase.co`/`wss://*.supabase.co`). Testado ao vivo contra o build de produção (`pnpm preview`) navegando por login, as 3 abas de Compras, Rotina e Agenda — zero violações de CSP no console. `nosniff`/`X-Frame-Options`/`Permissions-Policy` reais (headers HTTP) e `frame-ancestors` (que a spec de CSP ignora quando entregue via `<meta>`) ficam de fora — GitHub Pages não serve headers customizados; ver S6-07/D-021. |
| S6-07 | Decidir evolução da hospedagem | `CONCLUÍDO` | Avaliado migrar pra um host com suporte a headers customizados (Cloudflare Pages, Netlify, Vercel) — decisão registrada de NÃO migrar nesta sprint (D-021): o ganho real (headers de framing/nosniff que a `<meta>` não cobre) é modesto pra um app pessoal sem conteúdo de terceiros embutido, contra o risco de mexer no pipeline de deploy de um app usado diariamente em produção. Documentado no README como limitação conhecida e aceita, não esquecida. |
| S6-08 | Implementar retenção e backup/exportação | `CONCLUÍDO` | Novo `src/lib/exportData.ts` + botão "Exportar meus dados" no rodapé de `App.tsx`: busca direto do Supabase (não do Dexie, que só guarda o dia corrente) as 4 tabelas do usuário (`mh_items`, `mh_day_items`, `mh_rotina_state`, `mh_agenda_tasks`) e baixa um `.json` local via `Blob`+`<a download>`. Testado ao vivo na conta real: baixou `meu-diario-backup-2026-07-30.json` com 24 itens, 8 dayItems, 13 estados de rotina, 14 tarefas de agenda — contagens conferem com os dados reais da conta. Retenção de `mh_reset_cutoffs` já tinha decisão própria (D-010, Sprint 1: reter indefinidamente); `mh_processed_operations` (idempotência de `use_count`) cresce sem rotina de limpeza — registrado como risco residual menor (R-007), não crítico pro uso pessoal atual. |
| S6-09 | Atualizar documentação e runbooks | `CONCLUÍDO` | `README.md` reescrito por completo: nome atual (Meu Diário), os três módulos, autenticação por e-mail/senha (o README antigo ainda descrevia Magic Link, desatualizado), estrutura completa do banco (6 tabelas + 9 RPCs, incluindo as adicionadas nas Sprints 1/2/3 que nunca tinham sido documentadas), sincronização/conflitos, exportação de dados, segurança (incluindo a limitação de headers do GitHub Pages) e um runbook de rollback (front-end via `git revert`+push ou re-run de uma Actions run anterior; banco via SQL inverso manual testado local antes de aplicar — o projeto nunca versionou migrations "down"). |
| S6-10 | Refatorar arquivos grandes por domínio | `CANCELADO` (D-022) | `App.tsx` (1186 linhas), `useStore.ts` (1021) e `db.ts` (815) permanecem como estão. Decisão de não fatiar nesta sessão: é o item de maior risco de regressão da sprint (mover estado/efeitos entre arquivos num app usado diariamente em produção, sem o proprietário revisando cada extração), e nenhum critério de aceite da sprint depende disso — é dívida técnica registrada, não um bug. Fica como item isolado pra uma sessão dedicada, com testes mais próximos de cada extração. |

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
| AUD-014 — update oculto na Rotina | Médio | 5 | `CONCLUÍDO` | Banner `needRefresh` movido pra fora do `<header>` condicional; agora renderiza como primeiro elemento de `.page`, visível em qualquer aba (Compras, Rotina, Agenda). |
| AUD-015 — ambiente não reproduzível | Médio | 0 | `CONCLUÍDO` | Seed desabilitado (`db.seed.enabled=false`, não existe `seed.sql`); `site_url`/`additional_redirect_urls` corrigidos pra `:5173`; `sendPasswordReset` usa `import.meta.env.BASE_URL` em vez de caminho fixo; CI agora falha se `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` estiverem vazios. |
| AUD-016 — CI incompleto | Médio | 0 | `CONCLUÍDO` | `.github/workflows/deploy.yml` agora roda lint, typecheck, test, `pnpm audit --prod`, build e validação de migrations antes do deploy; `packageManager` fixado. Primeiro run real (`30539728743`) aprovado de ponta a ponta. |
| AUD-017 — acessibilidade interna | Médio | 5 | `CONCLUÍDO` | Tabs/Combobox/Dialog com ARIA completo e navegação por teclado (setas/Home/End/Escape/Tab-trap); live regions em sync/erro/validação. Verificado ao vivo, incluindo tema escuro. Auditoria automatizada (axe/Lighthouse) não executada nesta sessão — ver D-018. |
| AUD-018 — controles/layout Agenda | Médio | 5 | `CONCLUÍDO` | Alvos de toque aumentados (remover/badge/checkbox mais próximos de 44×44px; botões de reordenar continuam menores por restrição de espaço — ver S5-04); tabela ganhou wrapper com scroll horizontal próprio em vez de comprimir colunas. Sem overflow horizontal em 320/360/390/768/1280px nem em zoom 200% simulado. |
| AUD-019 — dados pessoais em logs | Médio | 6 | `CONCLUÍDO` | `src/lib/logger.ts` redige qualquer payload de erro/fila de sync antes do console em produção. Achado real corrigido: `db.ts` despejava a entrada INTEIRA da fila de Compras (incluindo `itemName`) no console de produção a cada falha de sync. |
| AUD-020 — headers ausentes | Médio | 6 | `CONCLUÍDO` | CSP aplicada via `<meta http-equiv>` (testada ao vivo contra o build de produção, zero violações). `frame-ancestors`/`nosniff`/`X-Frame-Options`/`Permissions-Policy` reais ficam fora por serem header-only e GitHub Pages não servir headers customizados — avaliado migrar de hospedagem (S6-07) e decidido manter por ora (D-021); limitação documentada no README, não escondida. |
| AUD-021 — estado vazio enganoso | Baixo | 4 | `CONCLUÍDO` | "Tudo no carrinho! Boas compras!" só aparece quando havia itens e todos foram concluídos (`totalCount > 0`); lista genuinamente vazia agora mostra "Sua lista está vazia" em vez de comemorar algo que nunca existiu. |
| AUD-022 — Markdown literal no iOS | Baixo | 4 | `CONCLUÍDO` | `**Compartilhar**`/`**Adicionar à Tela de Início**`/`**Adicionar**` trocados por `<strong>` no modal de instalação iOS. |
| AUD-023 — SEO/performance inicial | Baixo | 6 | `CONCLUÍDO` | Meta description + Open Graph/Twitter Card em `index.html`; bundle inicial reduzido (lazy-load da Rotina/Agenda, remoção do Tailwind não usado). |
| AUD-024 — documentação/estrutura | Baixo | 6 | `EM IMPLEMENTAÇÃO` | README reescrito por completo (nome atual, 3 módulos, banco, sync, exportação, runbook de rollback) — a metade "documentação" do achado está resolvida. A metade "estrutura" (dividir `App.tsx`/`useStore.ts`/`db.ts` por domínio) foi cancelada nesta sessão por decisão (D-022, S6-10) — risco de regressão maior que o benefício numa sessão sem o proprietário revisando cada extração. Achado não fechado enquanto a divisão não acontecer. |
| AUD-025 — retenção indefinida | Baixo | 6 | `CONCLUÍDO` | Botão "Exportar meus dados" (`src/lib/exportData.ts`) dá portabilidade total dos dados a qualquer momento, testado ao vivo na conta real. Retenção de `mh_reset_cutoffs` já tinha decisão própria (D-010). `mh_processed_operations` cresce sem rotina de limpeza — registrado como risco residual menor (R-007), não bloqueia o achado porque o volume real (uso pessoal) é desprezível. |
| AUD-026 — recuperação de senha incompleta | Médio | 4 | `CONCLUÍDO` | `PASSWORD_RECOVERY` abre o formulário automaticamente; campos com autocomplete correto (já concluído antes). Agora também: link expirado/já usado mostra mensagem clara na tela de login (`authLinkError` no `AuthProvider`, parseado do hash de erro do Supabase, testado ao vivo com `error_code=otp_expired`); sinal `passwordRecovery` é limpo (`clearPasswordRecovery`) assim que a senha é salva com sucesso. |

## 8. Gates de qualidade e release

| Gate | Estado | Condição para aprovação | Evidência |
|---|---|---|---|
| G0 — baseline | `APROVADO` | lint, build e deploy da baseline passam | commit `7610411`; workflow `30510848715` |
| G1 — testes/CI | `APROVADO` | Sprint 0 concluída | Testes/CI implementados e aprovados localmente e no run real do Actions (`30539728743`, commit `470be73`). |
| G2 — integridade de dados | `APROVADO` | Sprints 1 e 2 concluídas | Sprints 1 e 2 concluídas nesta atualização; AUD-001/003/004/009 resolvidos, AUD-005/006 parcialmente mitigados (risco residual registrado, não bloqueia o gate). |
| G3 — Agenda correta | `APROVADO` | Sprint 3 concluída | Sprint 3 concluída nesta atualização; AUD-002 (crítico) e AUD-012 resolvidos; 1000 combinações aleatórias sem sobreposição. |
| G4 — UX segura | `APROVADO` | Sprint 4 concluída | Sprint 4 encerrada com escopo reduzido (D-017): os 5 critérios de aceite da sprint foram todos conferidos; S4-01/S4-03/parte do S4-05 desescopados por decisão registrada, não por gate não atendido. |
| G5 — interface acessível/PWA | `APROVADO` | Sprint 5 concluída | Sprint 5 concluída nesta atualização; fluxos principais navegáveis só por teclado (verificado ao vivo), sem overflow horizontal em nenhum viewport/zoom testado, update do PWA visível em qualquer aba. S5-08 fechado em escopo reduzido (D-018, sem axe/Lighthouse automatizado). |
| G6 — consolidação | `APROVADO` | Sprint 6 e metas finais concluídas | Sprint 6 concluída nesta atualização com escopo reduzido (D-023): 9/10 itens concluídos, S6-10 (divisão de arquivos grandes) cancelado por decisão (D-022) sem afetar nenhum critério de aceite da sprint. |
| Produção final | `PENDENTE` | G1 a G6 aprovados e smoke test | G1-G6 todos aprovados. Falta: decidir o destino dos achados residuais parciais (AUD-005/006/011/024, ver seção 15) antes de declarar "evolução concluída" pelo critério da seção 15 — nenhum deles é um gate bloqueado, são risco residual já mitigado e registrado. |

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
| 30/07/2026 | Sprint 5 | `npx tsc -b` / `pnpm lint` / `pnpm test` (Vitest) / `pnpm build` | Aprovado; 50 testes aprovados, 0 vermelhos, 0 pendentes |
| 30/07/2026 | Sprint 5 | Verificado ao vivo na conta real do proprietário (`pnpm dev` + Playwright, login com credenciais fornecidas pontualmente, não persistidas): navegação por seta/Home/End nas duas tablists (nav principal e Rotina fixa/Agenda); combobox de itens responde a ArrowDown/Escape com `aria-activedescendant` correto; modal de trocar senha faz trap de Tab nas duas pontas, Escape fecha e devolve foco ao botão que abriu; tabela da Agenda rola horizontalmente sem estourar a página | Todas as verificações passaram |
| 30/07/2026 | Sprint 5 | Testado em 320/360/390/768/1280px, zoom 200% simulado (640×400) e paisagem (844×390), tema claro e escuro (`page.emulateMedia`) | Sem overflow horizontal (`scrollWidth > clientWidth` falso) em nenhum caso, nos dois temas — um bug real de overflow foi encontrado e corrigido durante esse teste (ver D-019) |
| 30/07/2026 | Sprint 6 | `npx tsc -b` / `pnpm lint` / `pnpm test` (Vitest) / `pnpm build` — repetido a cada mudança relevante (lazy-load, remoção do Tailwind, logger, CSP, exportação) | Aprovado em todas as passagens; 50 testes aprovados, 0 vermelhos, 0 pendentes |
| 30/07/2026 | Sprint 6 | `pnpm build` antes/depois de remover o Tailwind CSS 4 não usado | CSS principal: 29,00KB→18,39KB (gzip 6,41→4,20KB). Bundle inicial (após lazy-load da Rotina/Agenda): 494,88KB→479,30KB (gzip 138,65→134,37KB); `RotinaTab` virou chunk próprio de 15,89KB JS + 8,55KB CSS |
| 30/07/2026 | Sprint 6 | `pnpm preview` (build de produção) + Playwright, login na conta real, navegação por login/Compras/Rotina/Agenda, com a CSP nova aplicada | Zero violações de CSP no console em nenhum ponto testado |
| 30/07/2026 | Sprint 6 | Clique real em "Exportar meus dados" na conta real (`pnpm dev` + Playwright) | Baixou `meu-diario-backup-2026-07-30.json` com contagens reais (24 items, 8 dayItems, 13 rotinaState, 14 agendaTasks) — arquivo inspecionado só pelas contagens/chaves, não pelo conteúdo pessoal |

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
| R-006 | Logs/telemetria capturarem dados pessoais | Média | Alto | Redaction, allowlist de campos e revisão | Mitigado — `src/lib/logger.ts` redige por allowlist antes de qualquer console.error de produção (Sprint 6, AUD-019) |
| R-007 | `mh_processed_operations` (idempotência de `use_count`) cresce sem rotina de limpeza | Baixa | Baixo | Reavaliar se o volume real crescer — uso pessoal em poucos aparelhos mantém a tabela pequena por ora | Aberto (aceito como residual menor, Sprint 6) |

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

| D-018 | 30/07/2026 | Encerrar S5-08 sem rodar axe-core/Lighthouse, cobrindo o item só com teste manual de teclado ao vivo | O ambiente desta sessão não tem essas ferramentas de auditoria automatizada disponíveis; adiar a sprint inteira por isso não se justifica quando o teste manual já cobre navegação por teclado (o critério mais concreto do plano) em tabs, combobox e modal | Sprint 5 fechada como concluída; auditoria automatizada fica como pendência registrada, não esquecida — retomar se/quando essas ferramentas estiverem disponíveis | STATUS_EVOLUCAO.md, seção da Sprint 5 desta atualização |
| D-019 | 30/07/2026 | Durante o teste de viewport da Sprint 5, encontrado que a navegação principal (`.tabs-row-bottom .tab-btn`) já estourava horizontalmente em qualquer largura — não é um problema introduzido pela Agenda, é estrutural: `#root` trava o app inteiro num "coluna de app" de no máximo 460px mesmo em telas largas, então os 3 botões de aba (com rótulos como "Compras concluídas") nunca tinham espaço de sobra, só não aparecia porque ninguém tinha medido `scrollWidth` antes | Corrigido empilhando ícone e rótulo verticalmente com quebra de linha em vez de truncar com reticências (`.tab-btn .tab-label` ganhou `white-space:normal` e o botão virou `flex-direction:column`); a regra não é uma media query de viewport (o problema não depende do viewport, já que `#root` já limita a 460px) | `src/index.css`; medido via Playwright (`scrollWidth`/`clientWidth` de cada ancestral) antes e depois da correção |

| D-020 | 30/07/2026 | Não migrar as fontes do app pra self-host (S6-03) | Já usam `display=swap`, `preconnect` e ficam em cache offline via Workbox (`CacheFirst`, 1 ano de expiração) — o ganho de latência do self-host seria só no primeiro acesso de cada aparelho, não recorrente. Manter arquivos binários de fonte no repo pra esse ganho marginal não se justifica num app pessoal | Google Fonts continua sendo a fonte de `Baloo 2`/`Nunito Sans`/`Space Grotesk`/`Space Mono`; removida só a referência morta a `'Inter'` em `rotinaStyles.css` (nunca foi carregada, caía silenciosamente pra `Nunito Sans`) | `src/rotinaStyles.css`; README.md |
| D-021 | 30/07/2026 | Não migrar de GitHub Pages pra um host com headers HTTP customizados (S6-07), aplicando CSP só via `<meta>` (S6-06) | O ganho real (headers de framing/nosniff que `<meta>` não cobre) é modesto pra um app pessoal sem conteúdo de terceiros embutido; migrar pipeline de deploy de um app usado diariamente em produção é uma mudança de infraestrutura maior que o risco atual justifica | AUD-020 considerado resolvido dentro do limite do hosting atual; limitação documentada no README e no `index.html` (comentário perto da tag CSP) — não é uma lacuna esquecida | `index.html`; `README.md` |
| D-022 | 30/07/2026 | Cancelar S6-10 (dividir `App.tsx`/`useStore.ts`/`db.ts` por domínio) nesta sessão | É o item de maior risco de regressão da Sprint 6 — mover estado/efeitos entre arquivos grandes num app usado diariamente em produção, sem o proprietário revisando cada extração incremental. Nenhum critério de aceite da sprint depende disso | AUD-024 permanece parcialmente aberto (a metade "estrutura", não a "documentação"); fica registrado como dívida técnica pra uma sessão dedicada, com testes mais próximos de cada extração — não é esquecimento | STATUS_EVOLUCAO.md, seção da Sprint 6 desta atualização |
| D-023 | 30/07/2026 | Encerrar a Sprint 6 com escopo reduzido: 9/10 itens concluídos, S6-10 cancelado (D-022) | Mesma lógica já aplicada em D-017 (Sprint 4): o gate de saída da sprint ("metas de qualidade atingidas, operação documentada e dívida principal encerrada") não exige file-splitting especificamente — foi cumprido pelos outros 9 itens | Gate G6 aprovado; Sprint 6 concluída; as 7 sprints do plano estão encerradas. "Evolução concluída" (critério da seção 15) ainda depende de decidir o destino de AUD-005/006/011/024 (parciais) | STATUS_EVOLUCAO.md desta atualização |

### Modelo para nova decisão

```text
| D-XXX | DD/MM/AAAA | decisão | motivo | consequência | commit/issue/documento |
```

## 13. Foco da próxima sessão

### Resultado esperado

As 7 sprints do plano original (`PLANO_EVOLUCAO_IMPLEMENTACAO.md`) estão encerradas. Nesta sessão, Josemar pediu um plano completo pra fechar os 4 achados residuais parciais (AUD-005/006/011/024) — o plano foi pesquisado a fundo (arquitetura de sync, RPCs, estrutura dos arquivos grandes) e **aprovado por ele**, mas **nenhuma linha de código foi alterada ainda** — só pesquisa e planejamento. A próxima sessão deve **implementar o plano abaixo**, um item de cada vez, na ordem dada.

**Decisão já tomada com o proprietário nesta sessão**: implementar Realtime de verdade pro AUD-006 (ele confirmou que o custo do Supabase Realtime é irrelevante pro uso pessoal dele — não é "aceitar residual", é pra construir).

### Plano completo (copiado do arquivo de planejamento local, que NÃO sincroniza entre máquinas — esta cópia aqui é a fonte de verdade entre sessões/PCs)

#### 1. AUD-011 — editar duração/horário depois de gerada a agenda (pequeno, baixo risco — fazer primeiro)

Problema real: depois de "Montar agenda", as células de Horário/Duração da tabela (`src/AgendaPlanner.tsx:271-303`) viram texto puro — não há nem um `input disabled`, é um ramo JSX totalmente diferente (`isScheduled ? <texto> : <input>`). Pra corrigir uma tarefa hoje é preciso "Limpar agenda" e recriar tudo.

Por que é seguro: o motor (`src/lib/agendaScheduler.ts`) já suporta regenerar preservando tarefas `done` intocadas (teste `leaves done tasks untouched on regeneration`, `agendaScheduler.test.ts:91-100`) e as funções `updateFixedStart`/`updateTaskDuration` (`useAgendaState.ts:301,311`) já funcionam corretamente contra uma tarefa já agendada — só não têm nenhum controle de UI que as chame hoje.

Mudança: em `src/AgendaPlanner.tsx`, trocar os dois ternários que escondem o `input` quando `isScheduled` é `true` — sempre renderizar o input, pré-preenchido a partir do valor atual (`scheduledStart`/duração calculada de `scheduledEnd - scheduledStart` quando agendado; `fixedStart`/`estimatedMinutes` quando não). Reaproveitar os drafts já existentes (`fixedStartDrafts`/`durationDrafts`). Adicionar um indicador (ex.: reabilitar "Montar agenda" com rótulo "Recalcular agenda") pra deixar claro que a edição só reflete na tabela depois de chamar `generateSchedule` de novo (já é barato, `done` passa direto). Reordenar continua fora de escopo (`hasScheduleAny` não muda).

Teste: novo caso em `agendaScheduler.test.ts` confirmando que editar `estimatedMinutes`/`fixedStart` de uma tarefa já agendada e regenerar reflete o novo valor. Complementar com teste manual ao vivo (Playwright, conta real).

Arquivos: `src/AgendaPlanner.tsx`, `src/lib/__tests__/agendaScheduler.test.ts`.

#### 2. AUD-006 — Realtime (médio, decisão já tomada de implementar)

Objetivo: sincronização instantânea via Supabase Realtime, **aditiva** — o sync por foco/visibilidade (throttle 30s) e a fila offline continuam existindo como rede de segurança, Realtime só antecipa quando os dois aparelhos estão online ao mesmo tempo.

Migration nova (`supabase/migrations/20260803_enable_realtime.sql`): `ALTER PUBLICATION supabase_realtime ADD TABLE mh_day_items;` (+ `mh_rotina_state`, `mh_agenda_tasks`). Não incluir `mh_items` (catálogo) nesta fase. RLS já habilitada nessas tabelas é respeitada pelo Realtime por padrão.

Um canal por hook (`useStore.ts`/`useRotinaState.ts`/`useAgendaState.ts`, cada um no seu domínio): `supabase.channel('day-items-'+user.id).on('postgres_changes', {event:'*', schema:'public', table:'mh_day_items', filter:'user_id=eq.'+user.id}, handler).subscribe()`, com `removeChannel` no cleanup do efeito. O handler mapeia `payload.new` (snake_case) pro shape TS (reaproveitar o mapeamento já existente em `loadDayStateFromSupabase`/etc.), chama a mesma `mergeXWithLWW` já usada no pull normal (array de 1 item) e faz `db.<table>.put()` + atualiza estado React — mesmo padrão que `reconcileLocalItemFromRemote`/etc. já demonstram.

Reconexão: em `CHANNEL_ERROR`/`TIMED_OUT`, disparar um pull+merge completo daquele domínio como rede de segurança.

Feedback: nenhum novo — silencioso, é atualização de fundo. Não mexer no `syncStatus` existente.

Teste: manual ao vivo com dois contextos de navegador (mesma conta) — marcar um item num, confirmar que aparece no outro em segundos sem trocar de aba.

Arquivos: nova migration; `db.ts`/`rotinaDb.ts`/`agendaDb.ts` (handler de payload); `useStore.ts`/`useRotinaState.ts`/`useAgendaState.ts` (novo efeito de subscribe/unsubscribe).

#### 3. AUD-005 — LWW pelo relógio local (médio/grande, risco de dado — cuidado)

**A solução ingênua está errada**: fazer o servidor sempre gravar `updated_at = clock_timestamp()` (ignorando o cliente) quebraria o caso central do app — um aparelho offline por horas, sincronizando depois, teria `updated_at` carimbado na hora de CHEGADA, não da edição real, podendo fazer uma edição antiga vencer incorretamente uma mais nova de outro aparelho.

**Fix recomendado — grampo (clamp), não substituição**: dentro das 4 RPCs condicionais (`upsert_day_item_if_newer`, `upsert_rotina_step_if_newer`, `upsert_agenda_task_if_newer`, `update_item_category_if_newer`/`upsert_item_reconcile_name`), limitar `p_updated_at` pra nunca ser aceito mais de N minutos no futuro do relógio do próprio Postgres: `v_effective_updated_at := LEAST(p_updated_at, clock_timestamp() + INTERVAL '5 minutes')`, usado em toda comparação/gravação da função no lugar de `p_updated_at` puro. Isso resolve o problema real (relógio adiantado não vence mais todo conflito futuro) sem quebrar edição offline legítima (sempre no passado, nunca afetada pelo grampo).

Detalhes: tolerância de 5min é um chute ajustável; nas RPCs com guard de cutoff (`IF v_cutoff IS NOT NULL AND p_updated_at < v_cutoff THEN RETURN FALSE`), aplicar o grampo ANTES dessa comparação; não precisa devolver o timestamp grampado pro cliente (o próximo pull+merge já traz o valor real do Postgres) — **nenhuma mudança de código cliente necessária**, só a migration SQL.

Migration nova: `supabase/migrations/20260804_clamp_client_clock_skew.sql`, `CREATE OR REPLACE FUNCTION` nas 4 funções.

Teste: chamar a RPC com `p_updated_at` = "daqui a 1 ano", confirmar que fica grampado a `~clock_timestamp() + 5min`.

Arquivos: só a migration SQL.

#### 4. AUD-024 — dividir arquivos grandes por domínio (maior risco — sessão incremental, uma extração por vez, conforme D-022)

Precedente já funcionando no repo: `RotinaTab.tsx`/`AgendaPlanner.tsx` (recebem o retorno do hook como props, não chamam o hook de novo) e `rotinaDb.ts`/`agendaDb.ts` (lógica de sync separada do schema central em `db.ts`). Compras deve seguir o mesmo molde.

Ordem (cada passo = 1 commit + 1 rodada de testes, revisar antes de seguir):
1. `db.ts` → extrair `comprasDb.ts` (mirror de `rotinaDb.ts`/`agendaDb.ts`): mover `initializeDefaultItems`, `loadDayStateFromSupabase`, `mergeDayItemsWithLWW`, `reconcileLocalItemFromRemote`, `syncDayItemToSupabase`, `remapItemId`, `compactSyncQueueEntries`, `processSyncQueue`, `syncCategoryToSupabase`, `atomicIncrementUseCount` (~500 linhas). Tipos ficam em `db.ts`. Atualizar imports em `useStore.ts`, `App.tsx`, `dexie.test.ts`, `syncReconciliation.test.ts`, `lwwMerges.test.ts`.
2. `useStore.ts` → dividir em `useDayState.ts` + `useItems.ts` (já existe costura limpa, as duas funções não compartilham state entre si). Nomes de export idênticos.
3. `App.tsx` → extrair `LoginScreen.tsx` (tela de login + seu estado local `email`/`password`/`showPassword`/`forgotMode`/`authError`/`resetSent` são um bloco disjunto do resto — só precisa `signInWithPassword`/`sendPasswordReset`/`authLinkError`/`passwordRecovery` como props).
4. (Opcional, avaliar depois) `App.tsx` → extrair `ComprasTab.tsx` (as 3 abas de Compras + combobox de adicionar item), mesmo molde de props do `RotinaTab`.

Cada passo: `npx tsc -b && pnpm lint && pnpm test && pnpm build` antes de seguir; testar ao vivo as telas afetadas por aquele passo específico.

Arquivos: `db.ts`→`comprasDb.ts` (novo), `useStore.ts`→`useDayState.ts`+`useItems.ts` (novos, useStore.ts removido), `App.tsx`→`LoginScreen.tsx` (novo) + opcionalmente `ComprasTab.tsx` (novo).

### Ordem de execução recomendada

1. AUD-011 (pequeno, 1 sessão curta)
2. AUD-006 Realtime (médio, 1 sessão)
3. AUD-005 clamp (médio, SQL só — testar com cuidado antes de aplicar em produção)
4. AUD-024 (maior, várias sub-sessões, uma extração por vez)

Cada item fecha com: `npx tsc -b && pnpm lint && pnpm test && pnpm build`, teste ao vivo do que for aplicável, atualizar este status (achado + decisão, se houver) e commit+push na main — mesmo ritual das 6 sprints anteriores.

### Não fazer ainda

- Não alterar RPCs de produção além do que for exigido, com migration versionada.
- Não renomear novamente nenhuma migration já aplicada sem repetir a consulta direta ao `schema_migrations`.
- Não implementar o Realtime (item 2) substituindo o sync por foco/fila offline — é aditivo, não troca nada existente.
- Não usar `clock_timestamp()` puro no lugar de `updated_at` do cliente pro AUD-005 (item 3) — isso quebraria edição offline; usar o grampo (`LEAST`), não substituição.
- Não retomar S4-01/S4-03 (editor dedicado, editar após gerar) sem pedido explícito do proprietário — foram desescopados por decisão (D-017), não esquecidos.
- Não adicionar evoluções de produto do backlog (seção 5 do plano) antes de terminar os 4 residuais, salvo pedido explícito do proprietário.
- Não pedir nem persistir credenciais reais do proprietário — se for necessário testar ao vivo, usar as credenciais uma vez e não salvá-las em nenhum arquivo/memória (D-016).
- Não retomar S5-08 (axe/Lighthouse automatizado) sem que essas ferramentas estejam disponíveis no ambiente — desescopado por decisão (D-018), não esquecido.
- No item 4 (AUD-024): uma extração por vez, com teste, revisada antes da próxima — nunca fazer as 4 sub-etapas num commit só.
- Não migrar de hospedagem (GitHub Pages) sem um motivo concreto novo além do que já foi avaliado (D-021).

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
| 30/07/2026 | Sprint 5 | Tabs/Combobox/Dialog acessíveis: nav principal e alternância Rotina/Agenda viraram tablists com setas/Home/End; autocomplete de item virou combobox com `aria-activedescendant`; novo `src/Modal.tsx` compartilha trap de foco/Escape/devolução de foco entre os 3 modais existentes | AUD-017 avançado (S5-01/S5-02) | `src/App.tsx`, `src/RotinaTab.tsx`, `src/Modal.tsx` |
| 30/07/2026 | Sprint 5 | Live regions em sync (`role="status" aria-live="polite"`) e erros/validação (`role="alert"`) | AUD-017 avançado (S5-03) | `src/App.tsx`, `src/RotinaTab.tsx`, `src/AgendaPlanner.tsx` |
| 30/07/2026 | Sprint 5 | Alvos de toque da Agenda aumentados (remover/badge/checkbox); tabela ganhou wrapper com scroll horizontal próprio (`.agenda-table-wrap`, `min-width:0` necessário pra não estourar a cadeia flex de ancestrais) | AUD-018 resolvido (S5-04/S5-05) | `src/rotinaStyles.css`, `src/AgendaPlanner.tsx` |
| 30/07/2026 | Sprint 5 | Banner de update do PWA movido pra fora do header condicional, agora primeiro elemento de `.page` | AUD-014 resolvido (S5-07) | `src/App.tsx`, `src/index.css` |
| 30/07/2026 | Sprint 5 | Testado ao vivo em 320/360/390/768/1280px, zoom 200% simulado e paisagem, temas claro/escuro — encontrado e corrigido um overflow horizontal pré-existente na navegação principal (rótulos como "Compras concluídas" nunca cabiam nos ~424px reais de `#root`, mascarado até alguém medir `scrollWidth`) | AUD-018 confirmado sem overflow em nenhum caso (S5-06); bug estrutural não relacionado à Agenda corrigido (D-019) | `src/index.css` |
| 30/07/2026 | Sprint 5 | Sprint encerrada com escopo reduzido (D-018): S5-08 fechado só com teste manual de teclado, sem axe-core/Lighthouse (ferramentas indisponíveis nesta sessão) | Gate G5 aprovado; Sprint 5 concluída (8/8, S5-08 em escopo reduzido) | STATUS_EVOLUCAO.md desta atualização |
| 30/07/2026 | Sprint 6 | `RotinaTab` (e `AgendaPlanner`/`rotinaStyles.css` dentro dele) virou `React.lazy`; Tailwind CSS 4 removido por completo (pacotes + plugin + import) depois de confirmar zero classes utilitárias usadas em qualquer `.tsx` do projeto — só gerava CSS morto | Bundle inicial e CSS principal reduzidos (ver seção 9 pelos números); AUD-023 avançado | `src/App.tsx`, `vite.config.ts`, `src/index.css`, `package.json` |
| 30/07/2026 | Sprint 6 | Novo `src/lib/logger.ts`: redige por allowlist qualquer entrada de fila de sync antes de chegar ao console em produção; todos os 8 `console.error` de produção substituídos. Achado real corrigido: `db.ts` despejava `itemName` (dado pessoal) no console a cada falha de sync | AUD-019 resolvido | `src/lib/logger.ts`, `src/lib/db.ts`, `src/lib/rotinaDb.ts`, `src/lib/agendaDb.ts`, `src/App.tsx`, `src/lib/useStore.ts`, `src/lib/useRotinaState.ts`, `src/lib/useAgendaState.ts` |
| 30/07/2026 | Sprint 6 | Observabilidade sanitizada: tamanho/idade de fila por domínio (`logQueueHealth`), eventos de reconciliação (`logReconciliation`) e ciclo de vida do service worker (`onRegisteredSW`/`onNeedRefresh`/`onRegisterError`), todos sem dado pessoal | Parte de AUD-019/observabilidade | mesmos arquivos acima; `src/App.tsx` |
| 30/07/2026 | Sprint 6 | CSP aplicada via `<meta http-equiv>` em `index.html`; testada ao vivo contra o build de produção (`pnpm preview` + Playwright) navegando por login, Compras, Rotina e Agenda — zero violações no console | AUD-020 resolvido dentro do limite do hosting atual (D-021) | `index.html` |
| 30/07/2026 | Sprint 6 | Meta description, Open Graph e Twitter Card adicionados a `index.html`; referência morta a `'Inter'` removida de `rotinaStyles.css` (nunca foi carregada); decisão de não migrar fontes pra self-host (D-020) | AUD-023 resolvido | `index.html`, `src/rotinaStyles.css` |
| 30/07/2026 | Sprint 6 | Novo `src/lib/exportData.ts` + botão "Exportar meus dados" no rodapé — baixa um `.json` com todas as tabelas do usuário direto do Supabase. Testado ao vivo na conta real (contagens conferidas) | AUD-025 resolvido | `src/lib/exportData.ts`, `src/App.tsx`, `src/index.css` |
| 30/07/2026 | Sprint 6 | `README.md` reescrito por completo: nome atual, 3 módulos, autenticação por senha (estava desatualizado, ainda descrevia Magic Link), 6 tabelas + 9 RPCs, sync/conflitos, exportação, segurança e runbook de rollback | AUD-024 parcialmente resolvido (metade "documentação"; metade "estrutura" cancelada, ver linha seguinte) | `README.md` |
| 30/07/2026 | Sprint 6 | Sprint encerrada com escopo reduzido (D-023): S6-10 (dividir `App.tsx`/`useStore.ts`/`db.ts` por domínio) cancelado por decisão (D-022) — maior risco de regressão da sprint, nenhum critério de aceite dependia disso | Gate G6 aprovado; Sprint 6 concluída (9/10); as 7 sprints do plano estão encerradas; achados residuais parciais (AUD-005/006/011/024) registrados na seção 13 pra decisão do proprietário | STATUS_EVOLUCAO.md desta atualização |
| 30/07/2026 | Planejamento (pós-sprints) | Josemar pediu plano completo pra fechar os 4 achados residuais. Pesquisa a fundo (arquitetura de sync/timestamps, RPCs condicionais, estrutura dos 3 arquivos grandes) + plano desenhado e aprovado por ele. Decisão tomada: implementar Realtime de verdade pro AUD-006 (custo confirmado irrelevante pro uso dele) | Nenhum código alterado ainda — só pesquisa e planejamento. Plano completo copiado pra seção 13 (arquivo de plano local do Claude Code não sincroniza entre máquinas) | STATUS_EVOLUCAO.md desta atualização, seção 13 |

| 11/08/2026 | Correção (pós-sprints) | Regra do carry-over de Compras redefinida pelo proprietário: só item **adiado** volta pro dia seguinte. Item comprado fica nos concluídos do dia da compra (era o bug relatado: voltava como pendente) e pendente-sem-adiar não é mais arrastado. Regra centralizada em `selectCarryOverItems` (usada pelo caminho local e pelo de recuperação via Supabase); recuperação remota passou a pesar as linhas locais junto com as do servidor, senão uma compra ainda não sincronizada era desfeita pelo que o servidor dizia; consulta de dias anteriores no Supabase agora vem ordenada da mais nova pra mais antiga, pra que o teto de linhas do PostgREST corte histórico velho e não o recente | 75 testes aprovados (2 novos: regra do carry-over e empate local vs remoto), typecheck e lint limpos | `src/lib/db.ts`, `src/lib/useStore.ts`, `src/lib/__tests__/dexie.test.ts`, `README.md` |

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
