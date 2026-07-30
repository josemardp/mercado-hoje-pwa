import { db, supabase, MAX_SYNC_ATTEMPTS, type RotinaStepStateRecord, type RotinaSyncQueueEntry } from './db';

/**
 * Load today's Rotina step state from Supabase for a specific user/day.
 * Mirrors loadDayStateFromSupabase in db.ts.
 */
export async function loadRotinaStateFromSupabase(dayKey: string, userId: string): Promise<RotinaStepStateRecord[] | null> {
  try {
    const { data, error } = await supabase
      .from('mh_rotina_state')
      .select('*')
      .eq('day_key', dayKey)
      .eq('user_id', userId);

    if (error || !data) return null;

    return data.map((row: Record<string, unknown>): RotinaStepStateRecord => ({
      dayKey: row.day_key as string,
      stepId: row.step_id as string,
      done: !!row.done,
      updatedAt: new Date(row.updated_at as string).getTime(),
      userId: row.user_id as string,
    }));
  } catch {
    return null;
  }
}

/**
 * Merge local and remote Rotina state using Last-Write-Wins (LWW).
 * Structurally identical to mergeDayItemsWithLWW, kept separate rather than
 * generalized — mapping itemId<->stepId through a shared generic would be
 * more confusing than the ~15 duplicated lines.
 */
export function mergeRotinaStateWithLWW(
  localItems: RotinaStepStateRecord[],
  remoteItems: RotinaStepStateRecord[],
): RotinaStepStateRecord[] {
  const merged = new Map<string, RotinaStepStateRecord>();

  for (const item of localItems) {
    merged.set(item.stepId, item);
  }

  for (const remoteItem of remoteItems) {
    const localItem = merged.get(remoteItem.stepId);
    if (!localItem) {
      merged.set(remoteItem.stepId, remoteItem);
    } else if ((remoteItem.updatedAt || 0) > (localItem.updatedAt || 0)) {
      merged.set(remoteItem.stepId, remoteItem);
    }
  }

  return Array.from(merged.values());
}

/**
 * Sync a single Rotina step state to Supabase via the conditional RPC —
 * a stale write can never overwrite a newer one already stored server-side.
 */
export async function syncRotinaStepToSupabase(item: RotinaStepStateRecord): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('upsert_rotina_step_if_newer', {
      p_day_key: item.dayKey,
      p_step_id: item.stepId,
      p_done: item.done,
      p_updated_at: new Date(item.updatedAt).toISOString(),
      p_user_id: item.userId,
    });

    return !error;
  } catch {
    return false;
  }
}

/**
 * Process the local offline Rotina sync queue. Returns the ids of entries
 * that synced successfully; failed entries are left with attemptCount
 * incremented (same MAX_SYNC_ATTEMPTS/"stuck" convention as the grocery queue).
 */
export async function processRotinaSyncQueue(
  userId: string,
  entries: RotinaSyncQueueEntry[],
): Promise<number[]> {
  const successIds: number[] = [];

  for (const entry of entries) {
    try {
      switch (entry.type) {
        case 'complete':
        case 'uncomplete': {
          if (entry.stepId) {
            const local = await db.rotinaStepState.get([entry.dayKey, entry.stepId]);
            if (local) {
              const ok = await syncRotinaStepToSupabase(local);
              if (!ok) throw new Error('Failed to sync rotina step state');
            }
          }
          successIds.push(entry.id!);
          break;
        }

        case 'reset': {
          // Only delete rows that existed as of the reset moment — a row
          // another device writes afterward must survive.
          const { error } = await supabase
            .from('mh_rotina_state')
            .delete()
            .eq('day_key', entry.dayKey)
            .eq('user_id', userId)
            .lt('updated_at', new Date(entry.timestamp).toISOString());
          if (error) throw new Error(error.message);
          successIds.push(entry.id!);
          break;
        }
      }
    } catch (err) {
      console.error('Failed to process rotina sync queue entry:', entry, err);
      if (entry.id != null) {
        await db.rotinaSyncQueue.update(entry.id, { attemptCount: (entry.attemptCount || 0) + 1 });
      }
    }
  }

  return successIds;
}

export { MAX_SYNC_ATTEMPTS };
