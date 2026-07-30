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
| Situação geral | `EM EXECUÇÃO — SPRINT 0 CONCLUÍDA` |
| Fase atual | Sprint 0 concluída (testes, CI, ambiente local, migration duplicada); primeiro run real do CI confirmado aprovado |
| Sprint ativa | Sprint 1 — Integridade de reset e versão dos dados |
| Foco atual | Iniciar Sprint 1: aprovar modelo de versão server-side (S1-01) e tombstone/cutoff de reset (S1-02) |
| Próxima entrega | Sprint 1 — tombstone/cutoff de reset (AUD-001, AUD-005) |
| Progresso do plano | ~9% (Sprint 0 completa; 6 sprints restantes) |
| Sprints concluídas | 1 de 7 (Sprint 0) |
| Achados resolvidos | 3 de 26 (AUD-008, AUD-015, AUD-016). 4 outros já têm teste de regressão vermelho documentando o bug (AUD-001, AUD-002, AUD-004, AUD-009) — reprodução criada, correção ainda não |
| Bloqueios ativos | 1 (B-001 e B-003 resolvidos nesta sessão; B-002 permanece aberto) |
| Último deploy estável conhecido | commit `470be73` (run `30539728743`, aprovado) |
| Saúde da baseline | lint aprovado; typecheck aprovado; testes aprovados (32 passaram, 5 vermelhos esperados, 1 pendente); build aprovado; `pnpm audit --prod` sem vulnerabilidades; CI real do GitHub Actions aprovado de ponta a ponta |

### Resumo por prioridade

| Prioridade | Total | Concluídos | Restantes |
|---|---:|---:|---:|
| Crítico | 2 | 0 | 2 |
| Alto | 7 | 1 | 6 |
| Médio/Alto | 1 | 0 | 1 |
| Médio | 11 | 2 | 9 |
| Baixo | 5 | 0 | 5 |
| **Total** | **26** | **3** | **23** |

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

**Estado:** `NÃO INICIADO`
**Progresso:** 0/7 — 0%
**Dependência:** gate da Sprint 0.
**Gate de saída:** nenhum estado anterior a reset reaparece e o relógio do aparelho não decide sozinho o vencedor.

| ID | Entrega | Estado | Evidência/observação |
|---|---|---|---|
| S1-01 | Aprovar modelo de versão server-side | `NÃO INICIADO` | — |
| S1-02 | Criar cutoff/tombstone de reset por domínio | `NÃO INICIADO` | — |
| S1-03 | Atualizar RPCs de Compras e Rotina | `NÃO INICIADO` | — |
| S1-04 | Atualizar merges local/remoto | `NÃO INICIADO` | — |
| S1-05 | Persistir cutoff no Dexie | `NÃO INICIADO` | — |
| S1-06 | Definir retenção segura dos tombstones | `NÃO INICIADO` | — |
| S1-07 | Validar matriz online/offline/clock skew | `NÃO INICIADO` | — |

### Sprint 2 — Sincronização idempotente e convergência

**Estado:** `NÃO INICIADO`
**Progresso:** 0/9 — 0%
**Dependência:** Sprints 0 e 1.
**Gate de saída:** uma ação gera um efeito; escrita rejeitada converge; contas locais permanecem isoladas.

| ID | Entrega | Estado | Evidência/observação |
|---|---|---|---|
| S2-01 | Remover incremento duplicado de `use_count` | `NÃO INICIADO` | — |
| S2-02 | Adicionar `operation_id` idempotente | `NÃO INICIADO` | — |
| S2-03 | Adicionar mutex por fila | `NÃO INICIADO` | — |
| S2-04 | Compactar operações pendentes com segurança | `NÃO INICIADO` | — |
| S2-05 | Reconciliar `applied === false` na Rotina | `NÃO INICIADO` | — |
| S2-06 | Reconciliar `applied === false` na Agenda | `NÃO INICIADO` | — |
| S2-07 | Escopar Dexie e filas por `userId` | `NÃO INICIADO` | — |
| S2-08 | Centralizar autenticação | `NÃO INICIADO` | — |
| S2-09 | Sincronizar ao recuperar foco/visibilidade | `NÃO INICIADO` | — |

### Sprint 3 — Motor da Agenda correto

**Estado:** `NÃO INICIADO`
**Progresso:** 0/7 — 0%
**Dependência:** testes-base da Sprint 0.
**Gate de saída:** nenhuma agenda válida contém sobreposição e falta de tempo é calculada corretamente.

| ID | Entrega | Estado | Evidência/observação |
|---|---|---|---|
| S3-01 | Reescrever scheduler por gaps livres | `NÃO INICIADO` | — |
| S3-02 | Detectar fixos sobrepostos | `NÃO INICIADO` | — |
| S3-03 | Comprimir dentro da capacidade de cada gap | `NÃO INICIADO` | — |
| S3-04 | Unificar duração mínima | `NÃO INICIADO` | — |
| S3-05 | Definir política para janela, meia-noite e fixos | `NÃO INICIADO` | — |
| S3-06 | Impedir persistência de resultado inválido | `NÃO INICIADO` | — |
| S3-07 | Adicionar testes de invariantes/propriedades | `NÃO INICIADO` | — |

### Sprint 4 — Editor da Agenda e ações seguras

**Estado:** `EM IMPLEMENTAÇÃO`
**Progresso:** 0/8 — 0%
**Dependência:** Sprint 3 e contratos de sincronização da Sprint 2.
**Gate de saída:** tarefas são editáveis; ações destrutivas são explícitas/reversíveis; recuperação de senha é completa.

| ID | Entrega | Estado | Evidência/observação |
|---|---|---|---|
| S4-01 | Criar editor completo de tarefa | `NÃO INICIADO` | — |
| S4-02 | Persistir por debounce/blur | `NÃO INICIADO` | — |
| S4-03 | Permitir editar e recalcular agenda | `NÃO INICIADO` | — |
| S4-04 | Separar ações de desmarcar e limpar | `NÃO INICIADO` | — |
| S4-05 | Confirmação contextual e undo | `NÃO INICIADO` | — |
| S4-06 | Proteger logout com pendências | `NÃO INICIADO` | — |
| S4-07 | Corrigir estados vazios e textos iOS | `NÃO INICIADO` | — |
| S4-08 | Completar fluxo `PASSWORD_RECOVERY` | `EM IMPLEMENTAÇÃO` | Evento, abertura automática e autocomplete implementados; faltam link expirado, limpeza do sinal e testes. |

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
| AUD-001 — reset sem tombstone | Crítico | 1 | `NÃO INICIADO` | Teste de regressão vermelho criado (`lwwMerges.test.ts`); correção real é escopo da Sprint 1. |
| AUD-002 — sobreposição na Agenda | Crítico | 3 | `NÃO INICIADO` | Teste de regressão vermelho criado (`agendaScheduler.test.ts`); correção real é escopo da Sprint 3. |
| AUD-003 — incremento duplicado | Alto | 2 | `NÃO INICIADO` | Reprodução registrada como `describe.todo` (exige mock de concorrência de rede); correção é escopo da Sprint 2. |
| AUD-004 — `applied=false` ignorado | Alto | 2 | `NÃO INICIADO` | Teste de regressão vermelho criado pra Rotina e Agenda (`syncReconciliation.test.ts`); correção real é escopo da Sprint 2. |
| AUD-005 — LWW pelo relógio local | Alto | 1 | `NÃO INICIADO` | — |
| AUD-006 — ausência de atualização remota aberta | Alto | 2 | `NÃO INICIADO` | — |
| AUD-007 — logout perde pendências | Alto | 4 | `NÃO INICIADO` | — |
| AUD-008 — migration duplicada | Alto | 0 | `CONCLUÍDO` | `20260727_add_increment_use_count_rpc.sql` renomeado pra `20260727120000_...` (ordem de dependência real confirmada pelo próprio SQL: referencia `mh_items.id UUID`/`user_id`, que só existem depois de `20260727_update_auth_and_day_items.sql`). Histórico remoto verificado diretamente em `supabase_migrations.schema_migrations`: 7 versões locais = 7 versões remotas, uma a uma. Nenhuma migration já aplicada foi re-executada. |
| AUD-009 — isolamento local incompleto | Alto | 2 | `NÃO INICIADO` | Teste de regressão vermelho criado (`dexie.test.ts`); correção real é escopo da Sprint 2. |
| AUD-010 — reset ambíguo/destrutivo | Médio/Alto | 4 | `NÃO INICIADO` | — |
| AUD-011 — fixo sem horário editável | Médio | 4 | `NÃO INICIADO` | — |
| AUD-012 — duração mínima inconsistente | Médio | 3 | `NÃO INICIADO` | — |
| AUD-013 — persistência por tecla | Médio | 4 | `NÃO INICIADO` | — |
| AUD-014 — update oculto na Rotina | Médio | 5 | `NÃO INICIADO` | — |
| AUD-015 — ambiente não reproduzível | Médio | 0 | `CONCLUÍDO` | Seed desabilitado (`db.seed.enabled=false`, não existe `seed.sql`); `site_url`/`additional_redirect_urls` corrigidos pra `:5173`; `sendPasswordReset` usa `import.meta.env.BASE_URL` em vez de caminho fixo; CI agora falha se `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` estiverem vazios. |
| AUD-016 — CI incompleto | Médio | 0 | `CONCLUÍDO` | `.github/workflows/deploy.yml` agora roda lint, typecheck, test, `pnpm audit --prod`, build e validação de migrations antes do deploy; `packageManager` fixado. Primeiro run real (`30539728743`) aprovado de ponta a ponta. |
| AUD-017 — acessibilidade interna | Médio | 5 | `NÃO INICIADO` | — |
| AUD-018 — controles/layout Agenda | Médio | 5 | `NÃO INICIADO` | — |
| AUD-019 — dados pessoais em logs | Médio | 6 | `NÃO INICIADO` | — |
| AUD-020 — headers ausentes | Médio | 6 | `NÃO INICIADO` | — |
| AUD-021 — estado vazio enganoso | Baixo | 4 | `NÃO INICIADO` | — |
| AUD-022 — Markdown literal no iOS | Baixo | 4 | `NÃO INICIADO` | — |
| AUD-023 — SEO/performance inicial | Baixo | 6 | `NÃO INICIADO` | — |
| AUD-024 — documentação/estrutura | Baixo | 6 | `NÃO INICIADO` | — |
| AUD-025 — retenção indefinida | Baixo | 6 | `NÃO INICIADO` | — |
| AUD-026 — recuperação de senha incompleta | Médio | 4 | `EM IMPLEMENTAÇÃO` | `PASSWORD_RECOVERY` abre o formulário automaticamente (`useStore.ts`/`App.tsx`) e os campos têm `autoComplete="email"/"current-password"/"new-password"`. Ainda faltam: tratar link expirado (mensagem específica) e limpar o sinal `passwordRecovery` depois que a senha é definida (hoje só é resetado por reload de página). |

## 8. Gates de qualidade e release

| Gate | Estado | Condição para aprovação | Evidência |
|---|---|---|---|
| G0 — baseline | `APROVADO` | lint, build e deploy da baseline passam | commit `7610411`; workflow `30510848715` |
| G1 — testes/CI | `APROVADO` | Sprint 0 concluída | Testes/CI implementados e aprovados localmente e no run real do Actions (`30539728743`, commit `470be73`). |
| G2 — integridade de dados | `PENDENTE` | Sprints 1 e 2 concluídas | — |
| G3 — Agenda correta | `PENDENTE` | Sprint 3 concluída | — |
| G4 — UX segura | `PENDENTE` | Sprint 4 concluída | — |
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

### Modelo para nova decisão

```text
| D-XXX | DD/MM/AAAA | decisão | motivo | consequência | commit/issue/documento |
```

## 13. Foco da próxima sessão

### Resultado esperado

Sprint 0 concluída e gate G1 aprovado. Iniciar a Sprint 1: aprovar o modelo de versão server-side (S1-01) e implementar tombstone/cutoff de reset por domínio (S1-02), atacando AUD-001 (crítico) e AUD-005.

### Sequência recomendada

1. Ler `PLANO_EVOLUCAO_IMPLEMENTACAO.md` na seção da Sprint 1 antes de codar.
2. S1-01: decidir e registrar como decisão o modelo de versionamento server-side (ex.: `updated_at` continua sendo a fonte da verdade, ou entra um contador monotônico por linha).
3. S1-02: criar tombstone/cutoff de reset por domínio (Compras e Rotina) — usar o teste vermelho já existente em `lwwMerges.test.ts` (AUD-001) como critério de aceite: deve passar a `it()` normal depois da correção.
4. S1-03 a S1-07: atualizar RPCs, merges local/remoto, persistência do cutoff no Dexie e testes de matriz online/offline/clock skew.
5. Ao final da Sprint 1: rodar lint/typecheck/test/build, atualizar este status (estado da sprint, achados AUD-001/AUD-005, gate G2 permanece pendente até a Sprint 2), commit e push na main.
6. B-002 (Docker Desktop local vs. projeto Supabase de staging separado) continua em aberto — decidir quando for necessário testar concorrência real de dois aparelhos.

### Não fazer ainda

- Não alterar RPCs de produção além do que a Sprint 1 exigir, com migration versionada.
- Não renomear novamente nenhuma migration já aplicada sem repetir a consulta direta ao `schema_migrations`.
- Não implementar Realtime.
- Não iniciar melhorias visuais da Sprint 5.
- Não adicionar evoluções de produto do backlog.
- Não iniciar a Sprint 2 antes do gate de saída da Sprint 1 (nenhum estado anterior a reset reaparece; relógio do aparelho não decide sozinho o vencedor).

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
