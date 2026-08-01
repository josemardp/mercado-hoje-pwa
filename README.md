# Meu Diário

App pessoal, offline-first, instalável como PWA em Android e iOS, com três módulos:

- **Compras**: lista diária de mercado, com autocomplete por frequência e categorização automática.
- **Rotina**: checklist fixo de 14 passos da rotina matinal (medicação, higiene, trabalho).
- **Agenda**: planejador do dia — você lista as tarefas soltas e o tempo disponível, o app monta um horário automaticamente, comprimindo tarefas flexíveis e respeitando compromissos fixos.

**[Acessar o app](https://josemardp.github.io/mercado-hoje-pwa/)**

---

## Autenticação

E-mail + senha via **Supabase Auth**. A tela de login também oferece "Esqueci minha senha" (link de redefinição por e-mail) e um botão de mostrar/ocultar senha.

As políticas de RLS no Postgres verificam `auth.uid()` diretamente em toda tabela — sem token compartilhado, sem variável de sessão via RPC.

---

## Tech Stack

| Tecnologia | Uso |
|---|---|
| React 19 + TypeScript | Interface e lógica |
| Vite 8 | Build e dev server |
| Dexie (IndexedDB) | Banco de dados local (offline-first) |
| Supabase (PostgreSQL) | Backend remoto + autenticação |
| vite-plugin-pwa / Workbox | Service worker, manifest e ícones |
| GitHub Actions | CI (lint/typecheck/test/audit/build) + deploy automático para GitHub Pages |

`RotinaTab`/`AgendaPlanner` (e seu CSS) são carregados sob demanda (`React.lazy`) — só entram no bundle quando o usuário abre a aba Rotina.

---

## Sincronização e conflitos

Estratégia **offline-first com Last-Write-Wins (LWW) por linha**, replicada nos três módulos:

1. Cada unidade de dado (item do dia, passo da rotina, tarefa da agenda) é uma linha independente, nunca um blob JSON — elimina condição de corrida entre dispositivos editando coisas diferentes.
2. Alterações locais são salvas imediatamente no IndexedDB (Dexie). Se online, a mudança é enviada direto ao Supabase; se offline, entra numa fila local própria por módulo (`syncQueue`/`rotinaSyncQueue`/`agendaSyncQueue`).
3. Toda escrita remota passa por uma função RPC condicional (`upsert_*_if_newer`) que compara `updated_at` no servidor antes de gravar — uma escrita mais antiga nunca sobrescreve uma mais recente. Quando a RPC rejeita (`applied = false`), o app busca a linha canônica e reconcilia o estado local/React na hora, em vez de ficar tentando de novo pra sempre.
4. **Reset com tombstone**: "Limpar lista do dia"/reiniciar rotina grava um cutoff server-side (`mh_reset_cutoffs`, timestamp do próprio Postgres) por usuário+dia+domínio — um aparelho que estava offline no momento do reset não ressuscita dados antigos ao reconectar.
5. `use_count` (frequência de uso de um item) só é incrementado por um caminho idempotente (`operation_id` único), nunca por uma escrita "absoluta" concorrente com o incremento.
6. Reconectar/voltar o foco na aba dispara automaticamente um novo pull+merge e reprocessa a fila pendente (throttle de 30s).
7. Compras: qualquer item não comprado (adiado ou não) carrega pro dia seguinte automaticamente; só item marcado como comprado fica pra trás. Rotina e Agenda são por-dia — não carregam histórico.

---

## Estrutura do banco de dados (Supabase)

Todas as tabelas de dados do usuário usam `user_id UUID REFERENCES auth.users(id)` e RLS habilitado (`auth.uid() = user_id`).

| Tabela | Descrição |
|---|---|
| `mh_items` | Catálogo de itens de compras (nome, categoria, emoji, qty, use_count) |
| `mh_day_items` | Estado diário de Compras (PK: user_id + day_key + item_id — checked, postponed, in_today) |
| `mh_rotina_state` | Estado diário dos 14 passos da Rotina (PK: user_id + day_key + step_id — done) |
| `mh_agenda_tasks` | Tarefas da Agenda por dia (título, duração estimada, fixo/flexível, horário gerado, concluída, tombstone de soft-delete) |
| `mh_reset_cutoffs` | Cutoff de reset por usuário+dia+domínio (compras/rotina/agenda) — usado pelas RPCs condicionais pra rejeitar reinserção de dado apagado |
| `mh_processed_operations` | Registro de `operation_id` já aplicados — garante que um incremento de `use_count` reenviado (retry offline) nunca é contado duas vezes |

**RPCs principais** (todas comparam `updated_at`/`p_updated_at` no servidor antes de gravar): `upsert_day_item_if_newer`, `upsert_rotina_step_if_newer`, `upsert_agenda_task_if_newer`, `update_item_category_if_newer`, `update_item_use_count_if_newer`, `upsert_item_reconcile_name`, `increment_use_count` (idempotente via `operation_id`), `reset_day_domain`, `get_reset_cutoff`.

---

## Exportar/backup dos dados

No rodapé do app, "Exportar meus dados" baixa um `.json` com tudo que está salvo no Supabase pra aquela conta (catálogo de compras, estados diários, rotina e agenda), direto do navegador — não passa por nenhum servidor além do próprio Supabase.

---

## Segurança

- Nenhum segredo em texto puro no código, `.env.example` ou histórico da branch `main`. A chave `anon` do Supabase é pública por design.
- Acesso aos dados exige `auth.uid()`; sem login, toda operação falha por RLS.
- CSP aplicada via `<meta http-equiv>` em `index.html` — GitHub Pages não serve headers HTTP customizados, então essa é a única forma de entregar CSP nesse hosting. Isso significa que `frame-ancestors` (proteção contra clickjacking) e `X-Content-Type-Options: nosniff` **não** têm efeito, pois são headers-only e não têm equivalente em `<meta>`. Ver decisão sobre hospedagem abaixo.
- Console de produção nunca recebe nome de item, título de tarefa, categoria, e-mail ou token — `src/lib/logger.ts` filtra qualquer payload de erro/sync antes de logar (só sobrevivem ids, timestamps e contadores). Em desenvolvimento, o erro completo aparece normalmente.
- Classificação de itens é 100% local (sem IA externa).

### Sobre a hospedagem atual (GitHub Pages)

GitHub Pages não permite configurar headers HTTP customizados, então X-Frame-Options/nosniff/Permissions-Policy reais (não via `<meta>`) não são possíveis nesse hosting. Para um app pessoal de baixo risco, sem conteúdo de terceiros embutido, isso foi avaliado e considerado um risco aceitável por ora — migrar pra um host com esse suporte (Cloudflare Pages, Netlify, Vercel) é uma mudança maior de infraestrutura (DNS, pipeline de deploy) que não foi feita nesta sprint; ver `STATUS_EVOLUCAO.md` pela decisão registrada.

- **Incidente histórico**: uma versão anterior do projeto usava um `secret_token` compartilhado (em vez de autenticação real), e esse token chegou a ser commitado em texto puro. O esquema de `secret_token` foi completamente removido do banco e a branch `main` foi recriada sem esse histórico.

---

## Desenvolvimento local

```bash
# Instalar dependências
pnpm install

# Criar .env local (não commitado)
# Copie .env.example, renomeie para .env e preencha as variáveis

pnpm dev             # modo desenvolvimento
pnpm build           # build de produção (tsc -b && vite build)
pnpm preview         # servir o build de produção localmente
pnpm lint            # ESLint
pnpm typecheck       # tsc --noEmit
pnpm test            # Vitest (suite completa)
pnpm test:coverage   # Vitest com cobertura
```

---

## Deploy

Automático via GitHub Actions (`.github/workflows/deploy.yml`) a cada push na branch `main`:

1. Instala dependências com `pnpm --frozen-lockfile`.
2. Roda lint, typecheck, testes e `pnpm audit --prod`.
3. Sobe um Postgres descartável (`supabase start`) e valida a cadeia de migrations do zero.
4. `pnpm build`.
5. Publica `dist/` no GitHub Pages.

**Secrets necessários no repositório GitHub:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

### Runbook de rollback

**Front-end (GitHub Pages):**
1. `git revert <commit-do-problema>` (nunca `git reset --hard` numa branch compartilhada) e push na `main` — o workflow reconstrói e republica automaticamente.
2. Alternativa mais rápida: reabrir uma run anterior aprovada em GitHub Actions e usar "Re-run all jobs" — publica de novo o artefato daquele commit sem esperar um novo build.

**Banco (Supabase):**
- Este projeto não versiona migrations "down" — a estratégia sempre foi aditiva (nova tabela/coluna + cópia de dados, nunca alterar uma chave primária existente in-place; ver o incidente documentado em `STATUS_EVOLUCAO.md`, decisão D-015, sobre por que essa regra existe).
- Reverter uma migration já aplicada em produção é uma operação manual, caso a caso: escrever o SQL inverso, testar contra `supabase start` local primeiro, e só então aplicar com `supabase db query --linked` — nunca direto em produção sem esse passo.
- Antes de qualquer rollback de schema, rodar `supabase migration list` e comparar com `supabase_migrations.schema_migrations` pra confirmar exatamente o que está aplicado remotamente.
