import { db, supabase, MAX_SYNC_ATTEMPTS, resetDayDomain, type RotinaStepStateRecord, type RotinaSyncQueueEntry } from './db';

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
 *
 * `cutoffAt`, when given, drops any surviving step older than the day's
 * reset cutoff (see resetDayDomain in db.ts) — see mergeDayItemsWithLWW for
 * why this is needed (AUD-001).
 */
export function mergeRotinaStateWithLWW(
  localItems: RotinaStepStateRecord[],
  remoteItems: RotinaStepStateRecord[],
  cutoffAt?: number,
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

  if (cutoffAt != null) {
    for (const [key, item] of merged) {
      if ((item.updatedAt || 0) < cutoffAt) {
        merged.delete(key);
      }
    }
  }

  return Array.from(merged.values());
}

/**
 * Fetch the canonical mh_rotina_state row and overwrite the local copy with
 * it, then notify useRotinaState so the on-screen toggle reflects it. Used
 * when the conditional RPC rejects our write as older than what's already
 * stored (AUD-004) — without this, the rejected write still looked like a
 * "success" to the caller (no `error`), so the stale local value stuck
 * around forever with nothing to ever correct it.
 */
async function reconcileLocalRotinaStepFromRemote(dayKey: string, stepId: string, userId: string): Promise<void> {
  const { data: canonical } = await supabase
    .from('mh_rotina_state')
    .select('*')
    .eq('day_key', dayKey)
    .eq('step_id', stepId)
    .eq('user_id', userId)
    .maybeSingle();

  if (canonical) {
    await db.rotinaStepState.put({
      dayKey: canonical.day_key as string,
      stepId: canonical.step_id as string,
      done: !!canonical.done,
      updatedAt: new Date(canonical.updated_at as string).getTime(),
      userId: canonical.user_id as string,
    });
    window.dispatchEvent(new CustomEvent('mh:rotina-reconciled', { detail: { stepId } }));
  }
}

/**
 * Sync a single Rotina step state to Supabase via the conditional RPC —
 * a stale write can never overwrite a newer one already stored server-side.
 * Returns true even when the RPC rejects the write (applied === false):
 * that's not a failure to retry — it means another device's edit already
 * won, and reconcileLocalRotinaStepFromRemote() above already pulled that
 * canonical value down, so there is nothing left to resync for this entry.
 */
export async function syncRotinaStepToSupabase(item: RotinaStepStateRecord): Promise<boolean> {
  try {
    const { data: applied, error } = await supabase.rpc('upsert_rotina_step_if_newer', {
      p_day_key: item.dayKey,
      p_step_id: item.stepId,
      p_done: item.done,
      p_updated_at: new Date(item.updatedAt).toISOString(),
      p_user_id: item.userId,
    });

    if (error) return false;

    if (applied === false) {
      await reconcileLocalRotinaStepFromRemote(item.dayKey, item.stepId, item.userId);
    }

    return true;
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
            const local = await db.rotinaStepState.get([entry.dayKey, entry.stepId, userId]);
            if (local) {
              const ok = await syncRotinaStepToSupabase(local);
              if (!ok) throw new Error('Failed to sync rotina step state');
            }
          }
          successIds.push(entry.id!);
          break;
        }

        case 'reset': {
          // Registers/advances the server-side cutoff (AUD-001) and deletes
          // only rows older than it, atomically — a row another device
          // writes afterward must survive.
          await resetDayDomain(userId, entry.dayKey, 'rotina');
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
