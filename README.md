# Mercado de Hoje

Lista de compras pessoal, offline-first, instalável como PWA em Android e iOS.

**[Acessar o app](https://josemardp.github.io/mercado-hoje-pwa/)**

---

## O que o app faz

- **Lista diária**: adicione itens digitando; a cada dia novo a lista começa vazia.
- **Autocomplete por frequência**: sugere itens já usados antes, ordenados por uso.
- **Categorização automática**: novos itens são classificados localmente (dicionário em português). Categorias ficam salvas para a próxima vez.
- **Correção de categoria**: ao adicionar um item novo, o app permite corrigir a categoria sugerida.
- **Marcar como comprado**: item marcado vai para "Concluídos" com feedback tátil (vibração) e visual.
- **Adiar para amanhã**: cada item pendente tem um botão 🕒; itens adiados aparecem automaticamente no dia seguinte.
- **Transição automática de dia**: quando o dia vira, itens adiados voltam para "Hoje" automaticamente.
- **Offline-first**: funciona sem internet via IndexedDB (Dexie). Ao reconectar, sincroniza com Supabase.
- **Sincronização multi-dispositivo**: dados persistem no Supabase via autenticação real. RLS garante que apenas você acessa seus dados.
- **Instalável**: pode ser adicionado à tela inicial no Android (botão automático) e iOS (instrução passo-a-passo embutida no app).
- **Deploy automático**: qualquer push na branch `main` publica automaticamente via GitHub Actions.

---

## Autenticação

O app usa **Supabase Auth com Magic Link** (link enviado por e-mail). Não há senha.

- Na primeira visita, o app exibe uma tela de login.
- Insira seu e-mail e clique em "Receber Link de Acesso".
- Verifique seu e-mail e clique no link recebido.
- A sessão persiste localmente; você só precisa fazer login uma vez por dispositivo.

As políticas de RLS no Postgres verificam `auth.uid()` diretamente — sem token compartilhado, sem variável de sessão via RPC.

---

## Tech Stack

| Tecnologia | Uso |
|---|---|
| React 19 + TypeScript | Interface e lógica |
| Vite 8 | Build e dev server |
| Dexie (IndexedDB) | Banco de dados local (offline-first) |
| Supabase (PostgreSQL) | Backend remoto + autenticação (Magic Link) |
| vite-plugin-pwa | Service worker, manifest e ícones |
| Tailwind CSS 4 | Estilização |
| GitHub Actions | Deploy automático para GitHub Pages |

---

## Sincronização

Estratégia **offline-first com Last-Write-Wins (LWW) por linha**:

1. Cada item do dia é uma linha independente em `mh_day_items` (não um blob JSON). Isso elimina condições de corrida entre dispositivos.
2. Alterações locais são salvas imediatamente no IndexedDB.
3. Se online, a mudança é enviada diretamente ao Supabase.
4. Se offline, a operação entra em uma fila local. Ao reconectar, a fila processa cada operação individualmente — só remove da fila as que confirmaram sucesso no Supabase.
5. Ao abrir o app em outro dispositivo, os estados local e remoto são mesclados linha a linha pelo `updated_at`.
6. Itens adiados carregam para o dia seguinte automaticamente.

---

## Deploy

O deploy é automático via GitHub Actions (`.github/workflows/deploy.yml`).

A cada push na branch `main`:
1. O workflow instala as dependências com `pnpm`.
2. Cria o `.env` a partir das secrets do repositório (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
3. Executa `pnpm build`.
4. Publica o conteúdo de `dist/` no GitHub Pages.

**Secrets necessários no repositório GitHub:**
- `VITE_SUPABASE_URL` — URL do projeto Supabase
- `VITE_SUPABASE_ANON_KEY` — Chave anon pública do Supabase

---

## Desenvolvimento local

```bash
# Instalar dependências
pnpm install

# Criar .env local (não commitado)
# Copie .env.example e preencha as variáveis

pnpm dev        # modo desenvolvimento (http://localhost:5173)
pnpm build      # build de produção
pnpm lint       # lint com ESLint
pnpm preview    # visualizar o build localmente
```

---

## Estrutura do banco de dados (Supabase)

Todas as tabelas usam `user_id UUID REFERENCES auth.users(id)` e RLS habilitado com política `auth.uid() = user_id`.

| Tabela | Descrição |
|---|---|
| `mh_items` | Catálogo de itens (id UUID, nome, categoria, emoji, qty, use_count) |
| `mh_day_items` | Estado diário por item (PK composta: user_id + day_key + item_id, checked, postponed, in_today) |

A tabela `mh_sync_queue` foi removida — a fila de sincronização existe apenas localmente no IndexedDB.

---

## Segurança

- Nenhum segredo está em texto puro no código ou no histórico do Git.
- A chave `anon` do Supabase é pública por design (é a chave de acesso não autenticado).
- Acesso aos dados requer autenticação via `auth.uid()`. Sem login, todas as operações falham com erro de RLS.
- A API key da OpenAI foi removida completamente. Classificação de itens é feita localmente.
