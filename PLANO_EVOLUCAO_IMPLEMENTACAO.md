# Plano de evolução e implementação — Meu Diário

**Origem:** `AUDITORIA_COMPLETA.md`
**Acompanhamento vivo:** `STATUS_EVOLUCAO.md`
**Horizonte sugerido:** 7 sprints de 1 semana
**Premissa:** uma pessoa desenvolvedora com apoio de revisão/testes. Se a disponibilidade for parcial, manter a ordem e ampliar a duração, sem misturar os objetivos.

> Antes de iniciar ou encerrar qualquer sessão de implementação, ler e atualizar `STATUS_EVOLUCAO.md`.

## 1. Objetivos do plano

1. eliminar risco de perda, ressurreição e divergência silenciosa de dados;
2. tornar o motor da Agenda determinístico e incapaz de gerar sobreposição;
3. criar uma rede de segurança automatizada antes de novas funcionalidades;
4. melhorar ações destrutivas, acessibilidade e uso móvel;
5. tornar banco, CI/CD, documentação e ambiente reproduzíveis;
6. preparar evoluções de produto sem aumentar dívida técnica.

## 2. Regras de execução

- Nenhuma correção de sincronização entra em produção sem teste de dois aparelhos simulados.
- Alterações de schema devem ser retrocompatíveis por pelo menos uma versão do front-end.
- Migração aplicada em produção nunca deve ser renomeada sem conferir `supabase_migrations.schema_migrations`.
- Toda ação offline deve ter teste: executar offline, fechar/reabrir, reconectar e conferir remoto.
- Toda ação destrutiva deve possuir confirmação contextual ou undo.
- O pipeline deve bloquear merge/deploy se lint, testes, build ou smoke test de migração falhar.
- Dados reais do usuário não devem ser usados como massa de teste.

## 3. Definição de pronto global

Uma história só está pronta quando:

- código e migração foram revisados;
- testes automatizados cobrem caminho feliz, erro, offline e concorrência relevante;
- lint, typecheck, testes e build passam;
- acessibilidade por teclado foi conferida quando houver UI;
- mensagens de erro não expõem nome de item/tarefa;
- documentação afetada foi atualizada;
- há plano de rollback ou compatibilidade com a versão anterior;
- produção foi validada por smoke test não destrutivo.

## 4. Roadmap por sprint

### Sprint 0 — Rede de segurança e baseline reproduzível

**Objetivo:** criar testes e gates antes de mexer na sincronização.
**Duração:** 1 semana
**Achados:** AUD-008, AUD-015, AUD-016, AUD-024.

#### Entregas

1. Adicionar Vitest e scripts:
   - `test`;
   - `test:watch`;
   - `test:coverage`;
   - `typecheck`.
2. Adicionar testes unitários para:
   - `agendaScheduler`;
   - `agendaDurationEstimator`;
   - merges LWW de Compras, Rotina e Agenda;
   - classificação de categorias;
   - formatação de data.
3. Usar `fake-indexeddb` para testes de Dexie e upgrades de schema.
4. Criar casos que reproduzam, antes da correção:
   - sobreposição `09:00–11:00` x fixo `10:00–10:30`;
   - tarefa de 5 minutos crescendo para 10;
   - reset remoto com cópia local antiga;
   - RPC condicional retornando `false`;
   - incremento duplicado.
5. Evoluir GitHub Actions para executar:
   - instalação com lockfile congelado;
   - lint;
   - typecheck;
   - testes;
   - build;
   - `pnpm audit --prod`;
   - validação de migrations em banco descartável.
6. Fixar `packageManager` e `engines` no `package.json`.
7. Validar variáveis Supabase no CI antes do build.
8. Corrigir ambiente local:
   - seed existente ou seed desabilitado;
   - Auth e Vite na mesma porta;
   - redirects locais corretos;
   - instruções de `supabase start` e `db reset`.
9. Auditar o histórico real de migrations em produção e definir a estratégia para a versão duplicada `20260727`.

#### Critérios de aceite

- pipeline falha ao introduzir o cenário de sobreposição;
- pipeline falha se uma variável obrigatória estiver vazia;
- um clone limpo consegue instalar, iniciar Supabase local, aplicar migrations e executar testes seguindo o README;
- nenhuma migração já aplicada é renomeada sem registro da decisão.

#### Riscos e mitigação

- **Risco:** produção possui histórico manual diferente dos arquivos.
  **Mitigação:** gerar diff remoto antes de criar baseline/reparo.

### Sprint 1 — Integridade de reset e versão dos dados

**Objetivo:** impedir ressurreição e neutralizar relógio incorreto do cliente.
**Duração:** 1 semana
**Achados:** AUD-001, AUD-005.

#### Entregas

1. Definir modelo de versão server-side:
   - opção preferencial: versão monotônica/registro de operação emitido pelo servidor;
   - alternativa transitória: timestamp do servidor retornado por RPC.
2. Criar cutoff/tombstone de reset por `user_id + day_key + domínio`.
3. Alterar RPCs de Compras e Rotina para rejeitar qualquer upsert anterior ao reset.
4. Alterar merge local/remoto para aplicar tombstones e remover cópias locais antigas.
5. Persistir o cutoff no Dexie para funcionar offline.
6. Criar limpeza segura de tombstones somente após janela definida de sincronização.
7. Criar testes de matriz:
   - A online / B offline;
   - reset em A / ação antiga em B;
   - B reconecta depois de horas/dias;
   - relógio de B adiantado e atrasado;
   - reset repetido/idempotente.

#### Critérios de aceite

- nenhum dado anterior ao reset reaparece;
- relógio do dispositivo não define sozinho o vencedor;
- repetir a mesma operação não altera o resultado;
- front-end anterior não quebra durante a migração.

#### Observação de rollout

Fazer em duas fases:

1. publicar schema/RPC compatível com cliente atual;
2. publicar cliente novo;
3. após adoção, remover caminho legado.

### Sprint 2 — Sincronização idempotente e convergência

**Objetivo:** garantir uma mutação por ação e convergência visível.
**Duração:** 1 semana
**Achados:** AUD-003, AUD-004, AUD-006, AUD-009.

#### Entregas

1. Remover o caminho duplicado de `use_count`.
2. Introduzir `operation_id` idempotente nas mutações que incrementam contadores.
3. Adicionar mutex por fila para impedir processamentos concorrentes.
4. Compactar operações pendentes compatíveis por entidade, preservando reset/tombstone.
5. Tratar `applied === false` em Rotina e Agenda:
   - buscar registro canônico;
   - atualizar Dexie;
   - atualizar estado React;
   - informar conflito apenas se houver impacto visível.
6. Incluir `userId`:
   - em filas;
   - em chaves da Rotina;
   - em índices e filtros;
   - em migrations Dexie.
7. Centralizar sessão em `AuthProvider`; remover subscriptions duplicadas.
8. Sincronizar ao recuperar foco/visibilidade, com throttling.
9. Prototipar Realtime; habilitar apenas se o ganho justificar consumo/complexidade.

#### Critérios de aceite

- uma marcação aumenta frequência exatamente em 1;
- duas chamadas simultâneas do processador não duplicam efeito;
- escrita antiga rejeitada converge sem reload;
- conta B nunca processa dados/fila da conta A;
- aparelho aberto recebe alteração do outro ao recuperar foco em até 2 segundos.

### Sprint 3 — Motor da Agenda correto

**Objetivo:** garantir uma agenda sem sobreposição e com mensagens verdadeiras.
**Duração:** 1 semana
**Achados:** AUD-002, AUD-011, AUD-012.

#### Entregas

1. Reescrever o scheduler por intervalos:
   - validar janela;
   - ordenar e validar âncoras;
   - detectar compromissos fixos sobrepostos;
   - construir gaps livres;
   - alocar tarefas no gap correspondente;
   - comprimir apenas dentro da capacidade real;
   - calcular falta sem sobreposição.
2. Unificar duração mínima entre domínio e UI.
3. Definir política explícita para:
   - compromisso fora da janela;
   - janela atravessando meia-noite;
   - duração zero/inválida;
   - compromisso fixo sem horário;
   - tarefas concluídas durante recálculo.
4. Não persistir resultado inválido/parcial.
5. Adicionar testes baseados em propriedades:
   - `end >= start`;
   - duração nunca negativa;
   - nenhuma sobreposição;
   - fixos mantêm hora/duração;
   - todas as tarefas aparecem uma vez;
   - `shortfall = 0` implica agenda válida dentro da janela.

#### Critérios de aceite

- cenário reproduzido da auditoria é rejeitado ou corretamente comprimido;
- fixos sobrepostos exibem erro antes de salvar;
- 1.000 combinações geradas em teste não produzem sobreposição;
- duração exibida coincide com duração alocada.

### Sprint 4 — Editor da Agenda e ações seguras

**Objetivo:** tornar Agenda e resets compreensíveis e reversíveis.
**Duração:** 1 semana
**Achados:** AUD-007, AUD-010, AUD-011, AUD-013, AUD-021, AUD-022, AUD-026.

#### Entregas

1. Criar editor de tarefa com:
   - título;
   - flexível/fixo;
   - horário obrigatório para fixo;
   - duração;
   - salvar/cancelar;
   - validação inline.
2. Persistir edição por debounce/blur, não por tecla.
3. Adicionar “Editar agenda”/“Recalcular” depois da geração.
4. Separar ações:
   - “Desmarcar concluídos”;
   - “Limpar lista do dia”;
   - “Reiniciar rotina”;
   - “Limpar agenda”.
5. Criar confirmação contextual por ação e modo.
6. Implementar undo temporário para remoção/limpeza quando tecnicamente seguro.
7. Proteger logout:
   - contar pendências de todos os domínios;
   - oferecer sincronizar agora;
   - explicar logout local offline;
   - nunca descartar fila silenciosamente.
8. Corrigir estado `0 de 0` e marcação Markdown do modal iOS.
9. Completar recuperação de senha:
   - detectar `PASSWORD_RECOVERY`;
   - abrir imediatamente o diálogo de nova senha;
   - tratar link expirado;
   - adicionar autocomplete de e-mail/senhas;
   - atualizar README e mensagens de autenticação.

#### Critérios de aceite

- nenhum botão tem rótulo mais brando que seu efeito;
- trocar de modo cancela confirmação armada;
- tarefa fixa não pode ser salva sem horário;
- logout com fila pendente exige decisão explícita;
- lista vazia não dispara mensagem de conclusão.

### Sprint 5 — Acessibilidade, responsividade e PWA

**Objetivo:** completar a qualidade da interface autenticada.
**Duração:** 1 semana
**Achados:** AUD-014, AUD-017, AUD-018.

#### Entregas

1. Implementar padrões:
   - Tabs para navegação principal e modos;
   - Combobox para autocomplete;
   - Dialog para instalação iOS.
2. Adicionar:
   - `aria-selected`/`aria-controls`;
   - `aria-expanded`/`aria-activedescendant`;
   - setas, Home/End, Escape;
   - foco inicial, trap e devolução de foco no modal;
   - live regions para sync e validações.
3. Levar todos os controles a pelo menos 44 × 44 px quando possível.
4. Criar layout móvel da Agenda em cards ou wrapper de tabela acessível.
5. Testar 320, 360, 390, 768 e 1280 px, zoom de 200% e orientação paisagem.
6. Mover banner de atualização do PWA para shell global.
7. Testar:
   - primeira instalação;
   - update disponível em cada aba;
   - primeira abertura offline após instalação;
   - atualização com dados pendentes;
   - atalhos do manifest.
8. Executar axe/Lighthouse nas telas autenticadas e teste manual com teclado.

#### Critérios de aceite

- fluxos principais são executáveis sem mouse;
- não há overflow horizontal em 320 px ou zoom de 200%;
- update aparece em Compras, Rotina e Agenda;
- nenhum achado crítico/sério no axe;
- leitor de tela anuncia aba ativa, diálogo, erro e estado de sincronização.

### Sprint 6 — Performance, segurança, operação e documentação

**Objetivo:** consolidar produção e reduzir custo de evolução.
**Duração:** 1 semana
**Achados:** AUD-019, AUD-020, AUD-023, AUD-024, AUD-025.

#### Entregas

1. Lazy-load de Rotina e Agenda.
2. Analisar bundle e remover código/dependências não utilizados.
3. Avaliar self-host/subset das fontes.
4. Adicionar meta description e metadados de compartilhamento.
5. Criar logger por ambiente com redaction.
6. Adicionar observabilidade sanitizada:
   - falha de sync por código/domínio;
   - tamanho e idade da fila;
   - versão do app/service worker;
   - conflito/reconciliação;
   - nunca registrar títulos, itens, e-mail ou tokens.
7. Definir e aplicar headers de segurança:
   - CSP;
   - `nosniff`;
   - referrer policy;
   - permissions policy;
   - proteção contra framing.
8. Avaliar migração de GitHub Pages para hospedagem com headers configuráveis.
9. Implementar retenção de histórico/tombstones com backup/exportação.
10. Atualizar README:
    - nome Meu Diário;
    - três módulos;
    - tabelas/RPCs;
    - sync e conflitos;
    - ambiente local;
    - deploy do front e do banco;
    - runbook de rollback.
11. Dividir arquivos grandes por domínio.

#### Metas

- Lighthouse móvel: Performance ≥ 97, Acessibilidade ≥ 95, Boas práticas = 100, SEO ≥ 95;
- reduzir JS inicial gzip em pelo menos 20%;
- nenhuma informação pessoal em console de produção;
- runbook permite rollback de front e schema sem improviso.

## 5. Backlog de evolução após estabilização

Priorizar somente depois das Sprints 0–6.

### Evolução A — Histórico e revisão diária

- navegar por dias anteriores;
- consultar compras, rotina e agenda concluídas;
- copiar lista/agenda de um dia;
- resumo semanal local.

### Evolução B — Rotinas personalizáveis

- criar, ordenar e arquivar passos;
- recorrência por dia da semana;
- horários e grupos manhã/tarde/noite;
- modelos reutilizáveis;
- migração dos 14 passos atuais para um template padrão.

### Evolução C — Lembretes

- notificações locais opcionais;
- lembrete de compromisso fixo;
- lembrete de medicamento com confirmação;
- quiet hours e consentimento explícito;
- funcionamento degradado quando notificações não forem permitidas.

### Evolução D — Backup e portabilidade

- exportar JSON/CSV;
- importar com preview e validação;
- backup criptografado;
- restauração por data;
- política clara de retenção.

### Evolução E — Planejado x realizado

- registrar início/fim real opcional;
- comparar estimativa com duração real;
- ajustar estimador local com histórico do próprio usuário;
- manter processamento local por privacidade.

## 6. Dependências entre sprints

```text
Sprint 0 — testes e CI
    ├── Sprint 1 — reset/versionamento
    │       └── Sprint 2 — idempotência/convergência
    └── Sprint 3 — motor da Agenda
            └── Sprint 4 — editor e ações seguras

Sprint 2 + Sprint 4
    └── Sprint 5 — acessibilidade/PWA
            └── Sprint 6 — performance/operação/documentação
```

## 7. Plano de testes obrigatório

### Unitários

- estimativa de duração e classificação;
- scheduler com âncoras, gaps, compressão e conflitos;
- merges e tombstones;
- compactação/ordenação de filas;
- cálculo de versão/cutoff;
- formatação de data e virada do dia.

### Integração

- Dexie upgrade por versão;
- conta A/conta B no mesmo navegador;
- fila offline processada uma única vez;
- RPC `applied=false` e reconciliação;
- reset com dispositivo atrasado;
- logout com pendência;
- service worker update com fila existente.

### E2E

- login por ambiente de teste;
- Compras: adicionar, marcar, desmarcar, adiar, virar o dia;
- Rotina: concluir, revisar, resetar;
- Agenda: criar, editar, ordenar, fixar, gerar, concluir, recalcular;
- offline: executar ações, reload offline, reconectar;
- dois contextos de navegador simulando aparelhos;
- teclado, leitor de tela e viewport estreito.

## 8. Estratégia de release

1. Criar ambiente Supabase de staging sem dados pessoais.
2. Aplicar migração retrocompatível.
3. Rodar smoke e testes de dois aparelhos.
4. Publicar front-end para staging.
5. Validar offline, update e rollback.
6. Aplicar schema em produção.
7. Publicar front-end imediatamente após confirmação de compatibilidade.
8. Monitorar fila, erros e reconciliações por 24 horas.
9. Manter rollback do front, sem reverter migration destrutivamente.

## 9. Indicadores de sucesso

| Indicador | Meta |
|---|---:|
| Ressurreições após reset | 0 |
| Sobreposições geradas pela Agenda | 0 |
| Incrementos duplicados de frequência | 0 |
| Escritas rejeitadas sem reconciliação | 0 |
| Falhas de CI na `main` | 0 |
| Cobertura das funções de domínio críticas | ≥ 90% |
| Tempo para convergir ao recuperar foco | ≤ 2 s |
| Controles internos acessíveis por teclado | 100% |
| Dados pessoais em logs | 0 |
| Build reproduzível a partir de clone limpo | 100% |

## 10. Primeiro pacote recomendado

Se houver capacidade para apenas uma entrega imediata, executar:

1. testes que reproduzam `AUD-001` a `AUD-004`;
2. tombstone/cutoff de reset;
3. scheduler por gaps;
4. remoção do incremento duplicado;
5. reconciliação de `applied=false`;
6. lint + testes + build obrigatórios no CI.

Esse pacote reduz a maior parte do risco real sem depender de redesenho amplo do produto.
