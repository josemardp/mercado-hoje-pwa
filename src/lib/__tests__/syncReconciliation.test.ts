import { describe, it, expect, vi, afterEach } from 'vitest';
import { supabase, db, atomicIncrementUseCount, compactSyncQueueEntries, type SyncQueueEntry } from '../db';
import { syncRotinaStepToSupabase } from '../rotinaDb';
import { syncAgendaTaskToSupabase } from '../agendaDb';

afterEach(() => {
  vi.restoreAllMocks();
});

function mockCanonicalRow(row: Record<string, unknown>) {
  vi.spyOn(supabase, 'from').mockReturnValue({
    select: () => ({
      eq: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: row, error: null }) }),
          maybeSingle: () => Promise.resolve({ data: row, error: null }),
        }),
      }),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

// ─── AUD-004 (Alto, resolvido na Sprint 2): as RPCs condicionais retornam
// `applied` (boolean) além de `error`. Quando a escrita é legitimamente
// rejeitada por ser mais antiga (`applied === false`, sem erro), a função
// agora busca a linha canônica, atualiza o Dexie local e avisa o hook via
// evento — e continua retornando `true`, porque não sobra nada pra
// reprocessar: reenfileirar uma escrita que o servidor rejeitou de propósito
// só produziria uma entrada "travada" pra sempre, sem nenhum efeito real.
describe('AUD-004 — escrita rejeitada por LWW (applied=false) reconcilia com o valor canônico', () => {
  it('Rotina: syncRotinaStepToSupabase busca e grava a linha canônica quando a RPC rejeita por ser mais antiga', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: false, error: null } as never);
    mockCanonicalRow({
      day_key: '2026-07-30', step_id: 'xixi', done: false, updated_at: '2026-07-30T12:00:00.000Z', user_id: 'user-1',
    });

    const ok = await syncRotinaStepToSupabase({
      dayKey: '2026-07-30', stepId: 'xixi', done: true, updatedAt: 100, userId: 'user-1',
    });

    expect(ok).toBe(true);
    const local = await db.rotinaStepState.get(['2026-07-30', 'xixi', 'user-1']);
    expect(local?.done).toBe(false); // valor canônico do servidor, não o `true` que tentamos empurrar
    await db.rotinaStepState.delete(['2026-07-30', 'xixi', 'user-1']);
  });

  it('Agenda: syncAgendaTaskToSupabase busca e grava a linha canônica quando a RPC rejeita por ser mais antiga', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: false, error: null } as never);
    mockCanonicalRow({
      id: 't1', day_key: '2026-07-30', title: 'Título canônico', estimated_minutes: 45,
      fixed: false, order: 0, done: false, deleted: false,
      updated_at: '2026-07-30T12:00:00.000Z', user_id: 'user-1',
    });

    const ok = await syncAgendaTaskToSupabase({
      id: 't1', dayKey: '2026-07-30', title: 'Tarefa local desatualizada', estimatedMinutes: 30,
      fixed: false, order: 0, done: false, deleted: false, updatedAt: 100, userId: 'user-1',
    });

    expect(ok).toBe(true);
    const local = await db.agendaTasks.get('t1');
    expect(local?.title).toBe('Título canônico');
    await db.agendaTasks.delete('t1');
  });
});

// ─── AUD-003 (Alto, resolvido na Sprint 2): marcar um item online disparava
// tanto o incremento atômico de use_count quanto uma entrada de fila 'mark'
// com valor absoluto — se a fila processasse antes do incremento responder,
// o contador podia ser somado duas vezes. A correção elimina o caminho
// duplo: 'mark' não carrega mais use_count, e existe um único tipo
// 'incrementUse'. compactSyncQueueEntries garante que múltiplas entradas
// 'incrementUse' pendentes pro mesmo item nunca virem duas chamadas de rede
// separadas — são somadas numa só antes de qualquer request.
describe('AUD-003 — use_count não é mais incrementado duas vezes para a mesma marcação', () => {
  it('compacta múltiplas entradas incrementUse do mesmo item numa só, somando o incremento', () => {
    const entries: SyncQueueEntry[] = [
      { id: 1, type: 'incrementUse', dayKey: '2026-07-30', itemId: 'item-1', increment: 1, operationId: 'op-1', timestamp: 100 },
      { id: 2, type: 'incrementUse', dayKey: '2026-07-30', itemId: 'item-1', increment: 1, operationId: 'op-2', timestamp: 200 },
    ];

    const { entries: compacted, idsCoveredBy } = compactSyncQueueEntries(entries);

    expect(compacted).toHaveLength(1);
    expect(compacted[0].increment).toBe(2);
    expect(idsCoveredBy.get(compacted[0].id!)).toEqual(expect.arrayContaining([1, 2]));
  });

  it('nunca compacta entradas de tipos diferentes (add/reset/category) mesmo pro mesmo item', () => {
    const entries: SyncQueueEntry[] = [
      { id: 1, type: 'incrementUse', dayKey: '2026-07-30', itemId: 'item-1', increment: 1, timestamp: 100 },
      { id: 2, type: 'category', dayKey: '2026-07-30', itemId: 'item-1', category: 'frutas', timestamp: 200 },
    ];

    const { entries: compacted } = compactSyncQueueEntries(entries);
    expect(compacted).toHaveLength(2);
  });

  it('atomicIncrementUseCount encaminha o operationId pra RPC (idempotência)', async () => {
    const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: true, error: null } as never);
    await atomicIncrementUseCount('item-1', 'user-1', 1, 'op-123');
    expect(rpcSpy).toHaveBeenCalledWith('increment_use_count', expect.objectContaining({
      p_item_id: 'item-1',
      p_increment: 1,
      p_operation_id: 'op-123',
    }));
  });
});
