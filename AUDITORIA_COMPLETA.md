# Auditoria completa — Meu Diário

**Projeto:** `mercado-hoje-pwa`
**Aplicação:** https://josemardp.github.io/mercado-hoje-pwa/
**Referência funcional analisada:** https://claude.ai/code/artifact/30afeaa5-feb3-407d-b49d-22814b998dab
**Baseline inicial:** commit `cb42654` da branch `main`; o fechamento também considera a evolução local de autenticação por senha encontrada durante a auditoria.
**Data:** 30/07/2026 — America/Sao_Paulo
**Escopo:** código React/TypeScript, PWA, Supabase/PostgreSQL, sincronização offline, autenticação, UX, acessibilidade, responsividade, desempenho, segurança, CI/CD, documentação e manutenibilidade.

## 1. Resumo executivo

O Meu Diário tem uma base boa para um PWA pessoal: o build de produção e o lint passam, não foram encontradas vulnerabilidades conhecidas nas dependências de produção, os ativos do PWA estão publicados, o layout de Compras se adapta ao celular e há cuidados reais com RLS, modo escuro, redução de movimento, alvos de toque e fila offline.

O principal risco não está na aparência, mas na consistência dos dados. A estratégia Last-Write-Wins foi bem encaminhada, porém ainda tem quatro lacunas importantes:

1. o reset de Compras e Rotina apaga linhas, sem tombstone; por isso outro aparelho pode preservar ou ressuscitar dados antigos;
2. o motor da Agenda pode criar sobreposição com compromisso fixo e informar, incorretamente, que tudo coube;
3. uma compra marcada online pode incrementar `use_count` duas vezes, dependendo da ordem das requisições;
4. Rotina e Agenda tratam uma escrita rejeitada por ser antiga como sucesso e não reconciliam o estado local.

Recomendação de decisão: interromper novas funcionalidades por uma sprint curta e corrigir primeiro os itens `AUD-001` a `AUD-009`. Depois disso, evoluir Agenda, experiência, observabilidade e performance.

### Veredito

| Dimensão | Avaliação | Diagnóstico |
|---|---:|---|
| Correção funcional | 6/10 | Compras e Rotina funcionam no fluxo comum; resets e Agenda têm falhas de concorrência/encaixe. |
| Integridade e sincronização | 5/10 | Boa intenção arquitetural, mas deleção sem tombstone, relógio do cliente e reconciliação incompleta fragilizam o LWW. |
| Segurança e privacidade | 7/10 | RLS por proprietário e ausência de segredo versionado são pontos fortes; faltam headers, logs mínimos e logout seguro. |
| UX/UI | 8/10 | Identidade visual consistente e uso móvel agradável; há rótulos destrutivos ambíguos e estados vazios enganosos. |
| Acessibilidade | 7/10 | Compras tem boa base; Agenda, autocomplete e modal iOS precisam de semântica e alvos maiores. |
| PWA/offline | 8/10 | Manifest, ícones, service worker e cache estão presentes; atualização não aparece na Rotina e faltam testes E2E offline. |
| Desempenho | 8/10 | Lighthouse móvel de 96; há 115 KiB de JavaScript potencialmente não usado e fonte bloqueando renderização. |
| Testes e entrega | 4/10 | Não existe suíte automatizada e o CI só faz build. Migrações não são verificadas nem aplicadas pelo pipeline. |
| Manutenibilidade | 6/10 | TypeScript estrito e separação de domínio ajudam; arquivos grandes, hooks duplicados e documentação desatualizada aumentam risco. |

## 2. Método e evidências

Foram executadas as seguintes verificações:

- leitura integral do código de aplicação, configuração PWA, workflow e migrações;
- inspeção visual e de DOM da aplicação publicada, sem alterar os dados do usuário;
- validação de layout móvel na superfície de Compras;
- `pnpm lint`: aprovado;
- `pnpm build`: aprovado;
- `pnpm audit --prod`: nenhuma vulnerabilidade conhecida;
- verificação HTTP de documento, manifest, service worker e todos os ícones: todos responderam `200`;
- Lighthouse 12.8.2 em navegação móvel, na superfície pública de login;
- cenários determinísticos executados diretamente contra o motor puro da Agenda;
- inspeção de status Git, histórico, remotos, arquivos ignorados e branches remotas.

### Resultados objetivos

| Verificação | Resultado |
|---|---|
| ESLint | Aprovado, 0 erros |
| TypeScript + Vite build | Aprovado |
| Vulnerabilidades de produção | 0 conhecidas |
| Branch remota | somente `main` |
| Segredos rastreados | nenhum `.env` ou arquivo com nome de segredo rastreado |
| Manifest e ícones publicados | 10/10 URLs testadas com HTTP 200 |
| JS principal | 476,97 kB bruto / 133,84 kB gzip |
| CSS principal | 35,10 kB bruto / 7,59 kB gzip |
| Precache PWA | 23 entradas / aproximadamente 1,25 MiB |

### Lighthouse móvel

| Categoria/métrica | Resultado |
|---|---:|
| Performance | 96 |
| Acessibilidade | 100 |
| Boas práticas | 100 |
| SEO | 90 |
| FCP | 2,2 s |
| LCP | 2,3 s |
| TBT | 80 ms |
| CLS | 0,001 |
| JavaScript potencialmente não usado | 115 KiB |
| Economia estimada em recurso bloqueante | 510 ms |

> O Lighthouse avaliou a tela pública de login, não todos os controles autenticados de Compras, Rotina e Agenda. A nota 100 de acessibilidade não invalida os achados manuais das telas internas.

### Limites da auditoria

- Não houve acesso administrativo ao projeto Supabase de produção; políticas e funções foram avaliadas pelas migrações versionadas.
- Dados reais não foram criados, marcados ou apagados durante a inspeção publicada.
- Fluxos destrutivos e concorrência multiaparelho foram avaliados por código e testes determinísticos, não executados na conta de produção.
- Não foi possível confirmar proteção de branch e secrets do GitHub apenas pelo clone local.

## 3. Pontos fortes confirmados

- TypeScript está em modo `strict`, com verificação de variáveis e parâmetros não usados.
- A aplicação grava primeiro no Dexie e mantém uma fila local com limite de cinco tentativas.
- As tabelas atuais usam RLS e políticas por `auth.uid() = user_id`.
- O catálogo usa UUID por conta e reconciliação case-insensitive de nomes.
- `mh_agenda_tasks` usa soft delete, evitando ressurreição simples de tarefas apagadas.
- Compras reconcilia o registro remoto quando a RPC condicional rejeita uma escrita antiga.
- O app respeita `prefers-reduced-motion` e `prefers-color-scheme`.
- Os controles principais de Compras têm alvo de toque de 44 px e foco visível.
- Manifest, atalhos, ícones `maskable`, Apple Touch Icon e service worker estão corretos e publicados.
- O update do service worker é solicitado ao usuário, reduzindo troca silenciosa de versão em sessão aberta.
- O deploy do front-end é automático na `main` e usa permissões mínimas para GitHub Pages.
- `.env`, `dist` e `node_modules` estão corretamente ignorados.

## 4. Bugs e riscos priorizados

Escala usada:

- **Crítico:** pode produzir estado incorreto ou perda/ressurreição de dados em uso plausível.
- **Alto:** falha funcional relevante, risco operacional ou inconsistência persistente.
- **Médio:** degrada UX, acessibilidade, confiabilidade ou manutenção sem perda imediata.
- **Baixo:** polimento, documentação ou otimização incremental.

### AUD-001 — Reset pode não propagar e dados antigos podem ressurgir

**Severidade:** Crítico
**Áreas:** Compras, Rotina, sincronização offline

`resetAll` e `resetToday` removem as linhas locais e remotas. O merge, porém, é uma união LWW de linhas existentes; ele não possui representação para “esta linha foi apagada”. Um segundo aparelho com cópia local antiga:

- continua exibindo o estado depois do reset remoto, pois remoto vazio não remove o local;
- pode reenviar posteriormente uma linha antiga;
- consegue inserir novamente a linha porque a RPC não encontra mais um registro remoto com timestamp mais novo para rejeitá-la.

O mesmo problema não ocorre na Agenda porque ela usa `deleted = true` como tombstone.

**Evidências:** `src/lib/useStore.ts:525`, `src/lib/useRotinaState.ts:246`, `src/lib/db.ts:284`, `src/lib/rotinaDb.ts:35`.

**Correção recomendada:** criar tombstone/cutoff de reset por usuário e dia no servidor e no Dexie. Toda leitura, merge e upsert deve rejeitar estados com versão anterior ao cutoff. Alternativamente, gravar estados falsos por linha em vez de apagá-los.

**Critério de aceite:** aparelho A reseta; aparelho B, ainda offline e com estado antigo, reconecta; nenhum item/passo anterior ao reset reaparece.

### AUD-002 — Agenda cria sobreposição e informa falsamente que tudo coube

**Severidade:** Crítico
**Área:** motor de Agenda

O algoritmo calcula compressão pelo total da janela, mas não pela capacidade de cada intervalo antes/depois dos compromissos fixos. Uma tarefa flexível pode avançar sobre o horário de um compromisso; o compromisso é então inserido no passado e ambos ficam sobrepostos.

Cenário reproduzido:

- janela: `09:00–12:00`;
- tarefa flexível de 120 min;
- compromisso fixo às `10:00`, duração 30 min.

Resultado atual:

- tarefa: `09:00–11:00`;
- compromisso: `10:00–10:30`;
- `shortfallMinutes = 0`.

**Evidência:** `src/lib/agendaScheduler.ts:112-143`.

**Correção recomendada:** modelar intervalos livres entre âncoras, distribuir/comprimir as tarefas do respectivo intervalo e detectar conflito/âncora sobreposta antes de persistir qualquer agenda.

**Critério de aceite:** nenhum par de tarefas geradas pode se sobrepor; conflitos de compromissos fixos devem impedir a geração e apresentar orientação clara.

### AUD-003 — `use_count` pode ser incrementado duas vezes online

**Severidade:** Alto
**Áreas:** Compras, ranking/autocomplete

Ao marcar um item online, o app dispara `increment_use_count` e também cria uma entrada `mark` que atualiza `use_count` pela RPC condicional. Se a fila for processada antes do incremento atômico, a RPC atômica soma novamente e o contador fica um ponto acima.

**Evidências:** `src/lib/useStore.ts:464-476`, `src/lib/db.ts:496-518`, `src/lib/db.ts:588`.

**Correção recomendada:** usar uma única estratégia. Preferência: evento idempotente com `operation_id` no servidor, ou apenas incremento atômico enfileirável. Não combinar incremento e atribuição absoluta para a mesma ação.

### AUD-004 — Rotina e Agenda ignoram escrita rejeitada por LWW

**Severidade:** Alto
**Áreas:** Rotina, Agenda, multiaparelho

As RPCs `upsert_rotina_step_if_newer` e `upsert_agenda_task_if_newer` retornam booleano. O cliente verifica apenas `error`; `false` é tratado como sucesso. Assim, quando outro aparelho já tem versão mais nova, o estado local antigo permanece visível e nenhuma reconciliação é feita.

Compras já implementa o comportamento correto ao buscar a linha canônica quando `applied === false`.

**Evidências:** `src/lib/rotinaDb.ts:61-74`, `src/lib/agendaDb.ts:71-92`, migrações `20260730...:32-46` e `20260731...:50-75`.

**Correção recomendada:** ler o booleano, buscar a linha canônica em caso de rejeição e atualizar Dexie + estado React.

### AUD-005 — LWW depende do relógio de cada aparelho

**Severidade:** Alto
**Áreas:** toda sincronização

As versões são `Date.now()` do cliente. Um aparelho com relógio adiantado pode produzir timestamps “do futuro” e fazer suas versões prevalecerem por muito tempo, mesmo quando outro aparelho realizou a ação mais recentemente no mundo real.

**Evidências:** `updatedAt: Date.now()` nos três hooks e comparações `updated_at < EXCLUDED.updated_at` nas RPCs.

**Correção recomendada:** migrar para versão monotônica definida pelo servidor, Hybrid Logical Clock, ou ao menos carimbo do servidor devolvido na escrita. Manter um `operation_id` para idempotência.

### AUD-006 — Alterações de outro aparelho não chegam enquanto a tela permanece aberta

**Severidade:** Alto
**Áreas:** Compras, Rotina, Agenda

Os pulls remotos acontecem no login, mudança de dia e transição online/offline. Não há Supabase Realtime, polling, sincronização ao recuperar foco/visibilidade nem botão global de atualizar. Dois aparelhos abertos podem divergir visualmente até reload.

**Correção recomendada:** primeira entrega simples: refazer pull em `visibilitychange`/`focus` com throttling. Evolução: assinatura Realtime por usuário e tabela, seguida do mesmo merge canônico.

### AUD-007 — Logout pode descartar alterações ainda não sincronizadas

**Severidade:** Alto
**Áreas:** autenticação, offline

Após `signOut`, todas as filas e tabelas locais são apagadas sem verificar pendências. Uma alteração que falhou temporariamente ou chegou ao limite de tentativas é perdida de forma definitiva ao sair.

Além disso, se `signOut` falhar offline, o botão não oferece uma saída local segura nem explica o que aconteceu.

**Evidência:** `src/lib/useStore.ts:78-89`.

**Correção recomendada:** bloquear/confirmar logout quando houver pendências, oferecer “sincronizar agora”, e implementar logout local explícito com aviso quando offline.

### AUD-008 — Migrações têm versão duplicada

**Severidade:** Alto
**Área:** banco/entrega

Existem dois arquivos com a versão `20260727`:

- `20260727_add_increment_use_count_rpc.sql`;
- `20260727_update_auth_and_day_items.sql`.

Ferramentas de migração do Supabase usam o prefixo numérico como versão; duplicidade torna a cadeia não determinística ou impossível de aplicar do zero.

**Correção recomendada:** antes de renomear, comparar `supabase_migrations.schema_migrations` em produção. Criar uma baseline limpa ou uma migração de reparo com timestamp único, preservando o histórico já aplicado.

### AUD-009 — Isolamento local por usuário é incompleto

**Severidade:** Alto
**Áreas:** Dexie, troca de conta

As filas não armazenam `userId`. A chave local da Rotina é `[dayKey+stepId]`, embora os passos sejam iguais para todas as contas. Uma troca de sessão sem passar pelo logout completo pode processar fila da conta anterior ou sobrescrever estado local de outra conta.

**Evidência:** `src/lib/db.ts:103-131`.

**Correção recomendada:** incluir `userId` em todas as filas e chaves compostas; filtrar toda consulta/limpeza pela conta ativa; migrar o schema Dexie com testes de upgrade.

### AUD-010 — “Limpar marcações” apaga a lista inteira e não pede confirmação

**Severidade:** Médio/Alto
**Área:** UX e segurança contra erro humano

O botão sugere que apenas os checks serão removidos. A implementação zera também `inToday`, apagando a lista do dia. A ação é imediata e não possui confirmação ou desfazer.

Na Rotina/Agenda há confirmação em dois toques, mas o estado `resetArmed` é compartilhado entre os modos: armar em Agenda, trocar para Rotina e tocar novamente confirma outra ação.

**Evidências:** `src/App.tsx:783-792`, `src/lib/useStore.ts:548-580`, `src/RotinaTab.tsx:174-187`.

**Correção recomendada:** separar “desmarcar concluídos” de “limpar lista”, usar confirmação contextual e oferecer undo por alguns segundos.

### AUD-011 — Compromisso fixo perde ou não recebe horário editável

**Severidade:** Médio
**Área:** Agenda

- É possível criar item “Fixo” sem informar hora.
- Ao transformar tarefa flexível em fixa depois da criação, não há campo para definir a hora.
- Desativar e reativar “fixo” apaga `fixedStart`.
- Depois de gerar a Agenda, a duração vira texto e não pode mais ser ajustada sem recriar/limpar a agenda.

**Evidências:** `src/AgendaPlanner.tsx:177-187`, `src/AgendaPlanner.tsx:219-248`, `src/lib/useAgendaState.ts:237-241`.

**Correção recomendada:** editor de tarefa explícito com tipo, hora, duração e validação; permitir “desmontar/recalcular agenda” sem perder tarefas.

### AUD-012 — Limite mínimo da Agenda é inconsistente

**Severidade:** Médio
**Área:** Agenda

O input aceita duração mínima de 5 minutos, mas o compressor usa piso de 10. Em compressão, uma tarefa originalmente de 5 minutos pode crescer para 10 e gerar falta de tempo artificial.

Cenário reproduzido: tarefas de 5 e 100 minutos em janela de 60 minutos viram 10 e 57 minutos, com falta de 7 minutos.

**Evidências:** `src/AgendaPlanner.tsx:224-232`, `src/lib/agendaDurationEstimator.ts:7`, `src/lib/agendaScheduler.ts:79-83`.

### AUD-013 — Edição da Agenda grava a cada tecla

**Severidade:** Médio
**Área:** performance/concorrência

O `onChange` do título e da duração chama persistência local e remota imediatamente. Digitar uma frase produz várias requisições, vários timestamps e potencial corrida de respostas.

**Evidências:** `src/AgendaPlanner.tsx:224-241`, `src/lib/useAgendaState.ts:227-233`.

**Correção recomendada:** estado de edição local e persistência por debounce de 400–700 ms ou no `blur`, com flush no fechamento.

### AUD-014 — Atualização do PWA fica invisível na Rotina/Agenda

**Severidade:** Médio
**Área:** PWA

O banner `needRefresh` está dentro do header que não é renderizado quando `activeTab === 'rotina'`. Quem usa apenas Rotina/Agenda pode permanecer numa versão antiga sem aviso.

**Evidência:** `src/App.tsx:425-505`.

**Correção recomendada:** mover atualização e status global para fora dos conteúdos de aba.

### AUD-015 — Ambiente local e configuração não são reproduzíveis

**Severidade:** Médio
**Áreas:** desenvolvimento, Supabase

- `supabase/config.toml` habilita seed em `./seed.sql`, mas o arquivo não existe.
- A URL local do Auth usa porta `3000`; o README/Vite usa `5173`.
- `additional_redirect_urls` não contém a URL real de desenvolvimento.
- O Magic Link usa caminho `/mercado-hoje-pwa/` fixo, inadequado para outras bases/domínios.
- Variáveis Supabase ausentes não fazem o build falhar; causam exceção apenas ao abrir a aplicação.

**Correção recomendada:** alinhar URLs, adicionar seed válido ou desabilitá-lo, derivar redirect de `import.meta.env.BASE_URL` e validar env no início do CI.

### AUD-016 — CI não executa lint, testes, auditoria ou validação de migrações

**Severidade:** Médio
**Área:** entrega

O workflow executa somente instalação e build. Não há testes no projeto. Também não há aplicação ou verificação das migrações Supabase, permitindo publicar front-end incompatível com o banco.

O `pnpm/action-setup` usa `latest`, e `package.json` não fixa `packageManager` nem `engines`, reduzindo reprodutibilidade.

**Evidências:** `.github/workflows/deploy.yml`, `package.json`.

### AUD-017 — Lacunas de acessibilidade nas telas internas

**Severidade:** Médio
**Área:** acessibilidade

- abas não usam `tablist`/`tab`/`aria-selected`;
- autocomplete tem opções sem `listbox`, `aria-expanded`, setas ou `aria-activedescendant`;
- modal iOS não tem `role="dialog"`, `aria-modal`, foco inicial, trap de foco ou fechamento por Escape;
- toggles de modo/fixo não informam `aria-pressed`;
- tabela da Agenda possui cabeçalhos vazios e sem caption;
- mensagens “salvando/salvo/erro” nem sempre estão em live region.

**Correção recomendada:** seguir padrões WAI-ARIA de Tabs, Combobox e Dialog e validar com teclado + leitor de tela.

### AUD-018 — Controles da Agenda são pequenos e a tabela não tem estratégia móvel

**Severidade:** Médio
**Área:** responsividade

Botões “fixo/flexível”, reordenação e remoção têm área visual muito inferior aos 44 px usados corretamente em Compras. A tabela não possui wrapper com overflow, layout alternativo em cards ou media query específica, aumentando risco em telas estreitas e zoom.

**Evidências:** `src/rotinaStyles.css:351-433`.

### AUD-019 — Logs de produção podem expor dados pessoais

**Severidade:** Médio
**Áreas:** privacidade, observabilidade

`drop_console` está desativado e falhas de fila registram a entrada completa. Em Compras, a entrada pode conter nome, categoria, quantidade e frequência do item. Ao mesmo tempo, não existe monitoramento estruturado e sanitizado.

**Evidências:** `vite.config.ts:119`, `src/lib/db.ts:550-553`.

**Correção recomendada:** logger por ambiente, redaction de payloads e captura apenas de códigos/contexto técnico.

### AUD-020 — Headers defensivos estão ausentes

**Severidade:** Médio
**Área:** segurança web

A publicação possui HSTS, mas não apresentou CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` ou proteção de framing. GitHub Pages limita headers customizados.

**Correção recomendada:** no curto prazo, CSP e referrer policy via HTML onde suportado; no médio prazo, hospedar atrás de plataforma/CDN que permita headers completos.

### AUD-021 — Estado vazio diz “Tudo no carrinho” quando a lista está vazia

**Severidade:** Baixo
**Área:** UX

Na inspeção publicada, `0 de 0 no carrinho` foi acompanhado de “Tudo no carrinho! Boas compras!”. Isso confunde “sem lista” com “lista concluída”.

**Evidência:** `src/App.tsx:668-674`.

**Correção recomendada:** estado vazio “Sua lista está vazia”; usar comemoração apenas quando `totalCount > 0` e todos estiverem concluídos.

### AUD-022 — Modal iOS exibe marcação Markdown literalmente

**Severidade:** Baixo
**Área:** UX

Textos React contêm `**Compartilhar**` e `**Adicionar à Tela de Início**`; React não interpreta Markdown.

**Evidência:** `src/App.tsx:804-812`.

**Correção recomendada:** usar `<strong>`.

### AUD-023 — SEO e renderização inicial têm ganhos simples

**Severidade:** Baixo
**Áreas:** performance, SEO

- falta `<meta name="description">`, motivo da nota SEO 90;
- Google Fonts bloqueia parte da renderização;
- Lighthouse estimou 115 KiB de JavaScript não usado;
- Rotina e Agenda são carregadas no bundle inicial mesmo na tela de login/Compras.

**Correção recomendada:** meta description, lazy loading por aba, avaliar self-host/subset de fontes e remover dependências/estilos não utilizados.

### AUD-024 — Documentação e estrutura estão desatualizadas

**Severidade:** Baixo
**Área:** manutenção

O README ainda se chama “Mercado de Hoje”, descreve somente duas tabelas e não documenta Rotina/Agenda. O relatório técnico fornecido está mais atualizado que o repositório.

Também existem arquivos muito grandes:

- `src/App.tsx`: 845 linhas;
- `src/lib/useStore.ts`: 811 linhas;
- `src/index.css`: 845 linhas.

**Correção recomendada:** atualizar documentação e dividir UI, autenticação, sync e estilos por domínio.

### AUD-025 — Dados históricos e tombstones crescem sem política de retenção

**Severidade:** Baixo
**Áreas:** banco, Dexie

Compras, Rotina e Agenda acumulam linhas diárias. Tombstones da Agenda não são removidos. Para uso pessoal o crescimento é lento, mas indefinido.

**Correção recomendada:** retenção documentada, limpeza segura após janela de sincronização e opção de exportar backup antes da purga.

### AUD-026 — Recuperação de senha não abre o fluxo de nova senha

**Severidade:** Médio
**Áreas:** autenticação, UX, acessibilidade

A evolução local encontrada durante a auditoria troca o login cotidiano por e-mail/senha e envia link de recuperação. Entretanto, o evento `PASSWORD_RECOVERY` não é tratado para abrir automaticamente o formulário “Alterar senha”. O link pode autenticar o usuário e levá-lo à aplicação, deixando a etapa necessária escondida no rodapé.

Os campos também não declaram `autocomplete="email"`, `current-password` e `new-password`, prejudicando gerenciadores de senha.

**Evidências:** `src/lib/useStore.ts:68-94`, `src/App.tsx:438-481`, `src/App.tsx:856-911` no estado local incluído no fechamento.

**Correção recomendada:** expor o evento de recuperação no provider de autenticação, abrir um diálogo obrigatório de nova senha, tratar link expirado e adicionar os atributos de autocomplete adequados.

## 5. Sugestões de melhoria e evolução

### Curto prazo — confiabilidade

- implementar versão/tombstone de reset;
- corrigir motor da Agenda e cobri-lo com testes de propriedades;
- unificar o caminho de incremento de frequência;
- reconciliar RPCs rejeitadas;
- centralizar autenticação e escopar Dexie por usuário;
- sincronizar ao recuperar foco;
- proteger logout e ações destrutivas.

### Médio prazo — experiência

- editor completo de tarefas e compromissos;
- histórico diário navegável de Compras, Rotina e Agenda;
- desfazer para marcar, adiar, remover e limpar;
- reabrir/editar uma agenda já calculada;
- estados vazios próprios para primeira utilização;
- acessibilidade completa por teclado e leitor de tela;
- layout da Agenda em cards no celular.

### Médio/longo prazo — produto

- rotinas personalizáveis, com horários, recorrência e lembretes;
- notificações locais opcionais para medicamentos e compromissos;
- modelos de Agenda/Rotina reutilizáveis;
- exportação/importação em JSON/CSV e backup criptografado;
- indicadores locais de sequência, taxa de conclusão e tempo planejado x realizado;
- modo compartilhado opcional, com modelo explícito de permissões, somente se o produto deixar de ser estritamente pessoal.

### Engenharia e operação

- suíte unitária + integração + E2E offline;
- ambiente Supabase local reproduzível e migrations smoke-tested;
- observabilidade com eventos sanitizados e sem nomes de itens/tarefas;
- política de retenção e restauração;
- deploy atômico front-end + compatibilidade de schema;
- headers de segurança em hospedagem configurável.

## 6. Ordem recomendada de tratamento

1. `AUD-001`, `AUD-002`, `AUD-003`, `AUD-004`;
2. `AUD-005`, `AUD-007`, `AUD-008`, `AUD-009`;
3. `AUD-006`, `AUD-010`, `AUD-011`, `AUD-012`, `AUD-013`;
4. `AUD-014` a `AUD-020` e `AUD-026`;
5. `AUD-021` a `AUD-025` e evoluções de produto.

O plano executável, com sprints, dependências e critérios de aceite, está em `PLANO_EVOLUCAO_IMPLEMENTACAO.md`.
