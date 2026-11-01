import { useEffect, useRef } from 'react';
import { supabase } from './db';

// Domínios de dados que cada hook observa. "catalogo" é mh_items (nome,
// categoria, emoji, contagem de uso); os demais são as tabelas por dia.
export type RemoteSyncDomain = 'compras' | 'catalogo' | 'rotina' | 'agenda' | 'rotina-steps';

export interface RemoteChange {
  eventType: string;
  // false quando o evento é só o eco de um use_count que este próprio
  // aparelho acabou de incrementar (ver CATALOG_FIELDS abaixo).
  significant: boolean;
  newRow: Record<string, unknown>;
  oldRow: Record<string, unknown>;
}

interface TableBinding {
  table: string;
  domain: RemoteSyncDomain;
  isSignificant?: (change: Omit<RemoteChange, 'significant'>) => boolean;
}

// Campos do catálogo que, se mudarem, exigem reler a lista. use_count de
// sobra: marcar um item comprado incrementa esse contador, e sem este filtro
// cada toque baixaria o catálogo inteiro de novo em todos os aparelhos.
const CATALOG_FIELDS = ['name', 'category', 'emoji', 'qty'] as const;

function catalogChangeIsSignificant({ eventType, newRow, oldRow }: Omit<RemoteChange, 'significant'>): boolean {
  if (eventType !== 'UPDATE') return true;
  if (!oldRow || Object.keys(oldRow).length === 0) return true;
  return CATALOG_FIELDS.some(field => oldRow[field] !== newRow[field]);
}

// Tabelas observadas via Supabase Realtime. O filtro por user_id deixa o
// servidor mandar só as linhas deste usuário (RLS também se aplica).
const TABLE_BINDINGS: TableBinding[] = [
  { table: 'mh_day_items', domain: 'compras' },
  { table: 'mh_items', domain: 'catalogo', isSignificant: catalogChangeIsSignificant },
  { table: 'mh_rotina_state', domain: 'rotina' },
  { table: 'mh_agenda_tasks', domain: 'agenda' },
  { table: 'mh_rotina_steps', domain: 'rotina-steps' },
];

export const REMOTE_CHANGE_EVENT = 'mh:remote-change';

// Sem Realtime configurado no projeto (ou com o canal caído), este polling
// garante que outro aparelho apareça aqui em, no máximo, um intervalo. Curto
// o suficiente para parecer "instantâneo" no uso normal, sem martelar a API.
const POLL_INTERVAL_MS = 15000;

// Vários eventos chegam quase juntos (uma ação pode tocar mh_items e
// mh_day_items). Agrupa num único aviso por domínio.
const COALESCE_MS = 300;

const pendingChanges = new Map<RemoteSyncDomain, RemoteChange>();
let coalesceTimer: ReturnType<typeof setTimeout> | null = null;

function emitChanges() {
  const changes: Partial<Record<RemoteSyncDomain, RemoteChange>> = {};
  for (const [domain, change] of pendingChanges) changes[domain] = change;
  pendingChanges.clear();
  if (Object.keys(changes).length === 0) return;
  window.dispatchEvent(new CustomEvent(REMOTE_CHANGE_EVENT, { detail: { changes } }));
}

function scheduleEmit(domain: RemoteSyncDomain, change?: RemoteChange) {
  if (change) {
    const existing = pendingChanges.get(domain);
    // Um INSERT/edição real não pode ser engolido pelo UPDATE de use_count
    // que chega logo depois.
    if (!existing || change.significant || !existing.significant) {
      pendingChanges.set(domain, change);
    }
  } else if (!pendingChanges.has(domain)) {
    // Aviso vindo do polling: não há payload, mas o domínio precisa ser
    // relido do mesmo jeito.
    pendingChanges.set(domain, { eventType: 'POLL', significant: true, newRow: {}, oldRow: {} });
  }

  if (coalesceTimer) return;
  coalesceTimer = setTimeout(() => {
    coalesceTimer = null;
    emitChanges();
  }, COALESCE_MS);
}

/**
 * Liga o canal Realtime do usuário e o polling de segurança. Deve ser
 * chamado uma única vez por sessão (ver App.tsx). Retorna a função de
 * limpeza.
 *
 * O Realtime entrega a mudança assim que o outro aparelho grava; o polling
 * cobre o que ele não entrega (canal ainda conectando, publicação não
 * habilitada no projeto, DELETE sem replica identity, rede instável).
 */
export function startRemoteSync(userId: string): () => void {
  const channel = supabase.channel(`mh-sync-${userId}`);

  for (const binding of TABLE_BINDINGS) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: binding.table, filter: `user_id=eq.${userId}` },
      payload => {
        const change: Omit<RemoteChange, 'significant'> = {
          eventType: payload.eventType,
          newRow: (payload.new ?? {}) as Record<string, unknown>,
          oldRow: (payload.old ?? {}) as Record<string, unknown>,
        };
        scheduleEmit(binding.domain, {
          ...change,
          significant: binding.isSignificant ? binding.isSignificant(change) : true,
        });
      },
    );
  }

  channel.subscribe();

  const poll = () => {
    if (document.visibilityState !== 'visible') return;
    for (const binding of TABLE_BINDINGS) {
      // Catálogo fica de fora do polling: é a lista mais pesada e já é
      // atualizada pelo Realtime e ao ganhar foco. Aqui o polling existe
      // para o estado do dia, que é pequeno.
      if (binding.domain === 'catalogo') continue;
      scheduleEmit(binding.domain);
    }
  };
  const pollTimer = setInterval(poll, POLL_INTERVAL_MS);

  const handleOnline = () => poll();
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') poll();
  };
  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    clearInterval(pollTimer);
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibility);
    supabase.removeChannel(channel);
  };
}

/**
 * Avisa quando outro aparelho mudou dados deste domínio. `onChange` fica
 * numa ref para não reassinar o listener a cada render.
 */
export function useRemoteChanges(domain: RemoteSyncDomain, onChange: (change: RemoteChange) => void): void {
  const handlerRef = useRef(onChange);

  useEffect(() => {
    handlerRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ changes?: Partial<Record<RemoteSyncDomain, RemoteChange>> }>).detail;
      const change = detail?.changes?.[domain];
      if (change) handlerRef.current(change);
    };
    window.addEventListener(REMOTE_CHANGE_EVENT, handler);
    return () => window.removeEventListener(REMOTE_CHANGE_EVENT, handler);
  }, [domain]);
}
