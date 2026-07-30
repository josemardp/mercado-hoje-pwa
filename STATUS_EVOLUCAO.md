# Status da evolução — Meu Diário

> Documento operacional vivo. Deve ser lido no início e atualizado no fim de toda sessão de evolução do projeto.

**Auditoria de origem:** `AUDITORIA_COMPLETA.md`
**Plano mestre:** `PLANO_EVOLUCAO_IMPLEMENTACAO.md`
**Início do acompanhamento:** 30/07/2026
**Última atualização:** 30/07/2026
**Branch de entrega:** `main`
**Baseline do acompanhamento:** `7610411`
**Responsável:** a definir

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
| Situação geral | `EM EXECUÇÃO — PREPARAÇÃO DA SPRINT 0 + AUD-026 PARCIAL` |
| Fase atual | Preparação da Sprint 0; correção parcial de recuperação de senha em validação |
| Sprint ativa | Sprint 0 — Rede de segurança e baseline reproduzível |
| Foco atual | Definir responsável, staging e estratégia de migrations |
| Próxima entrega | Testes/CI capazes de reproduzir AUD-001 a AUD-004 |
| Progresso do plano | 0% |
| Sprints concluídas | 0 de 7 |
| Achados resolvidos | 0 de 26 |
| Bloqueios ativos | 2 |
| Último deploy estável conhecido | commit `7610411` |
| Saúde da baseline | lint aprovado; build aprovado; deploy aprovado |

### Resumo por prioridade

| Prioridade | Total | Concluídos | Restantes |
|---|---:|---:|---:|
| Crítico | 2 | 0 | 2 |
| Alto | 7 | 0 | 7 |
| Médio/Alto | 1 | 0 | 1 |
| Médio | 11 | 0 | 11 |
| Baixo | 5 | 0 | 5 |
| **Total** | **26** | **0** | **26** |

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

**Estado:** `EM ANÁLISE`
**Progresso:** 0/9 — 0%
**Objetivo:** criar testes e gates antes de alterar sincronização e schema.
**Gate de entrada:** responsável definido, repositório limpo e acesso ao Supabase de staging.
**Gate de saída:** clone limpo reproduz ambiente; CI bloqueia regressões; estratégia da migration duplicada está aprovada.

| ID | Entrega | Estado | Evidência/observação |
|---|---|---|---|
| S0-01 | Adicionar Vitest, scripts e cobertura | `NÃO INICIADO` | — |
| S0-02 | Testes das funções puras e merges LWW | `NÃO INICIADO` | — |
| S0-03 | Testes Dexie com `fake-indexeddb` | `NÃO INICIADO` | — |
| S0-04 | Reproduzir AUD-001 a AUD-004 em testes vermelhos | `NÃO INICIADO` | — |
| S0-05 | CI com lint, typecheck, testes, build e audit | `NÃO INICIADO` | — |
| S0-06 | Fixar Node, pnpm, lockfile e validar env | `NÃO INICIADO` | — |
| S0-07 | Corrigir Supabase local, seed e redirects | `NÃO INICIADO` | — |
| S0-08 | Validar migrations em banco descartável | `NÃO INICIADO` | — |
| S0-09 | Auditar e decidir correção da versão duplicada `20260727` | `BLOQUEADO` | Requer leitura do histórico de migrations de produção. |

#### Próxima ação da Sprint 0

1. Definir acesso a um projeto Supabase de staging.
2. Consultar `supabase_migrations.schema_migrations` em produção.
3. Instalar e configurar a suíte de testes.
4. Criar primeiro os testes de reprodução dos quatro riscos principais.

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
| AUD-001 — reset sem tombstone | Crítico | 1 | `NÃO INICIADO` | — |
| AUD-002 — sobreposição na Agenda | Crítico | 3 | `NÃO INICIADO` | — |
| AUD-003 — incremento duplicado | Alto | 2 | `NÃO INICIADO` | — |
| AUD-004 — `applied=false` ignorado | Alto | 2 | `NÃO INICIADO` | — |
| AUD-005 — LWW pelo relógio local | Alto | 1 | `NÃO INICIADO` | — |
| AUD-006 — ausência de atualização remota aberta | Alto | 2 | `NÃO INICIADO` | — |
| AUD-007 — logout perde pendências | Alto | 4 | `NÃO INICIADO` | — |
| AUD-008 — migration duplicada | Alto | 0 | `BLOQUEADO` | Requer histórico de produção. |
| AUD-009 — isolamento local incompleto | Alto | 2 | `NÃO INICIADO` | — |
| AUD-010 — reset ambíguo/destrutivo | Médio/Alto | 4 | `NÃO INICIADO` | — |
| AUD-011 — fixo sem horário editável | Médio | 4 | `NÃO INICIADO` | — |
| AUD-012 — duração mínima inconsistente | Médio | 3 | `NÃO INICIADO` | — |
| AUD-013 — persistência por tecla | Médio | 4 | `NÃO INICIADO` | — |
| AUD-014 — update oculto na Rotina | Médio | 5 | `NÃO INICIADO` | — |
| AUD-015 — ambiente não reproduzível | Médio | 0 | `NÃO INICIADO` | — |
| AUD-016 — CI incompleto | Médio | 0 | `NÃO INICIADO` | — |
| AUD-017 — acessibilidade interna | Médio | 5 | `NÃO INICIADO` | — |
| AUD-018 — controles/layout Agenda | Médio | 5 | `NÃO INICIADO` | — |
| AUD-019 — dados pessoais em logs | Médio | 6 | `NÃO INICIADO` | — |
| AUD-020 — headers ausentes | Médio | 6 | `NÃO INICIADO` | — |
| AUD-021 — estado vazio enganoso | Baixo | 4 | `NÃO INICIADO` | — |
| AUD-022 — Markdown literal no iOS | Baixo | 4 | `NÃO INICIADO` | — |
| AUD-023 — SEO/performance inicial | Baixo | 6 | `NÃO INICIADO` | — |
| AUD-024 — documentação/estrutura | Baixo | 6 | `NÃO INICIADO` | — |
| AUD-025 — retenção indefinida | Baixo | 6 | `NÃO INICIADO` | — |
| AUD-026 — recuperação de senha incompleta | Médio | 4 | `EM IMPLEMENTAÇÃO` | `PASSWORD_RECOVERY` abre o formulário e campos têm autocomplete; aceite ainda incompleto. |

## 8. Gates de qualidade e release

| Gate | Estado | Condição para aprovação | Evidência |
|---|---|---|---|
| G0 — baseline | `APROVADO` | lint, build e deploy da baseline passam | commit `7610411`; workflow `30510848715` |
| G1 — testes/CI | `PENDENTE` | Sprint 0 concluída | — |
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

Substituir ou complementar esta tabela a cada sessão. Resultados antigos relevantes devem ser resumidos no histórico, sem transformar a seção em log infinito.

## 10. Bloqueios ativos

| ID | Bloqueio | Impacto | Responsável | Ação necessária | Estado |
|---|---|---|---|---|---|
| B-001 | Histórico de migrations de produção não foi consultado | Impede decidir correção segura da versão `20260727` | a definir | Consultar `supabase_migrations.schema_migrations` e gerar diff | `ABERTO` |
| B-002 | Ambiente Supabase de staging não foi definido | Impede testes destrutivos/concorrentes seguros | a definir | Criar ou indicar projeto isolado de staging | `ABERTO` |

Um bloqueio só pode ser fechado com evidência ou decisão registrada.

## 11. Registro de riscos

| ID | Risco | Probabilidade | Impacto | Mitigação | Estado |
|---|---|---|---|---|---|
| R-001 | Schema real divergir das migrations versionadas | Alta | Alto | Diff remoto e baseline antes de renomear/aplicar | Aberto |
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

### Modelo para nova decisão

```text
| D-XXX | DD/MM/AAAA | decisão | motivo | consequência | commit/issue/documento |
```

## 13. Foco da próxima sessão

### Resultado esperado

Sprint 0 iniciada com ambiente e estratégia de migrations definidos, suíte de testes instalada e pelo menos um teste vermelho reproduzindo um bug crítico.

### Sequência recomendada

1. Definir responsável e staging.
2. Resolver ou encaminhar B-001 e B-002.
3. Criar branch de trabalho a partir da `main`.
4. Adicionar Vitest e `fake-indexeddb`.
5. Criar testes de reprodução para AUD-001 e AUD-002.
6. Atualizar este documento para `EM IMPLEMENTAÇÃO`.

### Não fazer ainda

- Não alterar RPCs de produção.
- Não renomear migrations.
- Não implementar Realtime.
- Não iniciar melhorias visuais da Sprint 5.
- Não adicionar evoluções de produto do backlog.

## 14. Histórico de evolução

| Data | Sprint | Alteração | Resultado | Commit/evidência |
|---|---:|---|---|---|
| 30/07/2026 | Planejamento | Auditoria completa e plano de 7 sprints criados | 26 achados priorizados | `7610411` |
| 30/07/2026 | Planejamento | Status operacional vivo criado | Execução preparada; Sprint 0 ainda não iniciada | commit de criação deste arquivo |
| 30/07/2026 | Sprint 4 (parcial) | Detectado `PASSWORD_RECOVERY`, aberto formulário e configurado autocomplete | Implementação parcial de AUD-026; ainda exige critérios restantes | commit de criação deste arquivo |

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
