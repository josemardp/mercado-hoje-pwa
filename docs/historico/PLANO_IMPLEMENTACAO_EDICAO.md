# Plano de Implementação: Edição de Quantidade e Itens

## Problema Atual
Atualmente, ao adicionar um item já existente na lista de compras (ex: "Goiaba"), o app apenas reutiliza o mesmo ID e não altera a quantidade. Além disso, ao tocar no item na lista, ele é marcado como "concluído" (checked), não havendo uma forma direta de editar a quantidade ou corrigir um item já na lista.

## Solução Proposta
Implementar uma funcionalidade para editar a quantidade de itens (ex: "2 goiabas" em vez de apenas "goiaba") e permitir a edição de dados do item diretamente na lista do dia.

### 1. Alterações no Banco de Dados (Supabase & Dexie)
O estado diário de compras (`mh_day_items`) atualmente armazena apenas booleanos (`checked`, `postponed`, `in_today`). Para suportar uma quantidade específica para o dia (ex: 2 goiabas hoje, mas apenas 1 amanhã), precisamos adicionar um campo de quantidade.

*   **Supabase**: Alterar a tabela `mh_day_items` para adicionar uma coluna `qty INTEGER DEFAULT 1`. Atualizar a função RPC `upsert_day_item_if_newer` para aceitar e gravar esse novo parâmetro `p_qty`.
*   **Dexie (db.ts)**: Atualizar a interface `DayItemRecord` para incluir `qty?: number`. Atualizar o schema do Dexie para a versão 8, incluindo o campo `qty`.
*   **Sincronização**: Atualizar `loadDayStateFromSupabase`, `mergeDayItemsWithLWW`, `syncDayItemToSupabase` e `processSyncQueue` para lidar com a nova coluna `qty`.

### 2. Alterações na Lógica de Negócio (useStore.ts)
*   **Adicionar Item Existente**: Ao adicionar um item que já está na lista (via autocomplete ou pesquisa), ao invés de apenas reutilizar o ID, devemos **incrementar a quantidade** (qty) desse item no estado diário.
*   **Novo Estado**: Atualizar o hook `useDayState` para suportar `qty` no estado (`DayStateData`).
*   **Nova Função**: Criar `updateItemQty(itemId, newQty)` para atualizar a quantidade no estado local, persistir no Dexie e enviar para a fila de sincronização.

### 3. Alterações na Interface do Usuário (App.tsx e ItemRow.tsx)
O desafio é permitir a edição sem quebrar a experiência de "tocar para concluir".

*   **Botão de Adição Rápida (+)**: No `ItemRow`, adicionar um botão `+` discreto (ao lado do botão de adiar 🕒). Clicar nele incrementa a quantidade em +1 e mostra um toast "Adicionado! Total: X".
*   **Edição Completa (Modal)**: Ao clicar no ícone de quantidade atual (ex: `2x`), ou em um novo ícone de lápis, abrir um Modal (reutilizando o `Modal.tsx` existente) permitindo editar a quantidade manualmente (número) e, opcionalmente, remover o item da lista.
*   **Visual**: A quantidade atual será exibida como uma "badge" destacada.

## Passos de Implementação
1.  **Migration**: Criar nova migration no Supabase para adicionar `qty` em `mh_day_items` e atualizar RPCs.
2.  **Types & DB**: Atualizar `db.ts` (interfaces, schema Dexie v8, funções de merge/sync).
3.  **Store**: Atualizar `useStore.ts` (estado, funções de incrementar e atualizar).
4.  **UI**: Atualizar `App.tsx` e `ItemRow` (adicionar controles de quantidade, modal de edição).
5.  **Testes**: Garantir que o fluxo offline-first e LWW continue funcionando com o novo campo.
