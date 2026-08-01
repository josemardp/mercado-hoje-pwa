import { db, supabase, type RotinaStepDefRecord, type RotinaStepDefSyncQueueEntry } from './db';
import { ROTINA_STEPS } from './rotinaSteps';
import { logSyncFailure, logReconciliation } from './logger';

/**
 * Load a user's Rotina step definitions from Supabase. Deliberately does NOT
 * filter `deleted = false` server-side — tombstones must be merged too,
 * otherwise the LWW merge could resurrect a step another device removed.
 * Filtering `!deleted` happens only in the hook, right before exposing steps
 * to the UI. Mirrors loadAgendaTasksFromSupabase in agendaDb.ts.
 */
export async function loadRotinaStepDefsFromSupabase(userId: string): Promise<RotinaStepDefRecord[] | null> {
  try {
    const { data, error } = await supabase
      .from('mh_rotina_steps')
      .select('*')
      .eq('user_id', userId);

    if (error || !data) return null;

    return data.map((row: Record<string, unknown>): RotinaStepDefRecord => ({
      id: row.id as string,
      title: row.title as string,
      emoji: (row.emoji as string) || '✅',
      period: (row.period as RotinaStepDefRecord['period']) || 'morning',
      order: Number(row.step_order) || 0,
      deleted: !!row.deleted,
      updatedAt: new Date(row.updated_at as string).getTime(),
      userId: row.user_id as string,
    }));
  } catch {
    return null;
  }
}

/**
 * Merge local and remote step definitions using Last-Write-Wins (LWW), keyed
 * by step id. Structurally identical to mergeAgendaTasksWithLWW.
 */
export function mergeRotinaStepDefsWithLWW(
  localItems: RotinaStepDefRecord[],
  remoteItems: RotinaStepDefRecord[],
): RotinaStepDefRecord[] {
  const merged = new Map<string, RotinaStepDefRecord>();

  for (const item of localItems) {
    merged.set(item.id, item);
  }

  for (const remoteItem of remoteItems) {
    const localItem = merged.get(remoteItem.id);
    if (!localItem) {
      merged.set(remoteItem.id, remoteItem);
    } else if ((remoteItem.updatedAt || 0) > (localItem.updatedAt || 0)) {
      merged.set(remoteItem.id, remoteItem);
    }
  }

  return Array.from(merged.values());
}

/**
 * Fetch the canonical mh_rotina_steps row and overwrite the local copy with
 * it, then notify useRotinaStepDefs so the on-screen list reflects it. Used
 * when the conditional RPC rejects our write as older than what's already
 * stored — see reconcileLocalAgendaTaskFromRemote in agendaDb.ts for the
 * equivalent Agenda-side fix.
 */
async function reconcileLocalRotinaStepDefFromRemote(stepId: string, userId: string): Promise<void> {
  const { data: canonical } = await supabase
    .from('mh_rotina_steps')
    .select('*')
    .eq('id', stepId)
    .eq('user_id', userId)
    .maybeSingle();

  if (canonical) {
    await db.rotinaStepDefs.put({
      id: canonical.id as string,
      title: canonical.title as string,
      emoji: (canonical.emoji as string) || '✅',
      period: (canonical.period as RotinaStepDefRecord['period']) || 'morning',
      order: Number(canonical.step_order) || 0,
      deleted: !!canonical.deleted,
      updatedAt: new Date(canonical.updated_at as string).getTime(),
      userId: canonical.user_id as string,
    });
    window.dispatchEvent(new CustomEvent('mh:rotina-step-def-reconciled', { detail: { stepId } }));
    logReconciliation('rotina-steps', { stepId });
  }
}

/**
 * Push a single step definition to Supabase via the conditional RPC — a
 * stale write (including a soft-delete) can never overwrite a newer one
 * already stored server-side.
 */
export async function syncRotinaStepDefToSupabase(step: RotinaStepDefRecord): Promise<boolean> {
  try {
    const { data: applied, error } = await supabase.rpc('upsert_rotina_step_def_if_newer', {
      p_id: step.id,
      p_title: step.title,
      p_emoji: step.emoji,
      p_period: step.period,
      p_order: step.order,
      p_deleted: step.deleted,
      p_updated_at: new Date(step.updatedAt).toISOString(),
      p_user_id: step.userId,
    });

    if (error) return false;

    if (applied === false) {
      await reconcileLocalRotinaStepDefFromRemote(step.id, step.userId);
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Process the local offline sync queue for step definitions. A single entry
 * type ('upsert') is enough — every mutation (add/edit/reorder/remove) is
 * just re-reading the current local row and pushing it whole.
 */
export async function processRotinaStepDefSyncQueue(
  userId: string,
  entries: RotinaStepDefSyncQueueEntry[],
): Promise<number[]> {
  const successIds: number[] = [];

  for (const entry of entries) {
    try {
      const local = await db.rotinaStepDefs.get([entry.stepDefId, userId]);
      if (local) {
        const ok = await syncRotinaStepDefToSupabase(local);
        if (!ok) throw new Error('Failed to sync rotina step definition');
      }
      successIds.push(entry.id!);
    } catch (err) {
      logSyncFailure('Failed to process rotina step def sync queue entry', entry, err);
      if (entry.id != null) {
        await db.rotinaStepDefSyncQueue.update(entry.id, { attemptCount: (entry.attemptCount || 0) + 1 });
      }
    }
  }

  return successIds;
}

/**
 * Seed a user's very first set of step definitions, copying ROTINA_STEPS
 * (rotinaSteps.ts) verbatim — same ids ('xixi', 'pesar-se', ...), titles,
 * emojis, periods and order the app has always shipped with. That's not
 * arbitrary: today's completion history (mh_rotina_state/
 * rotinaStepStateByUser) is already keyed against exactly those ids, so a
 * seed with different ids would make already-recorded progress look lost.
 *
 * Deliberately callable offline (no `isOnline` gate around this call): the
 * Rotina tab has always rendered its 14 steps instantly, with zero network
 * dependency, because they used to be a plain array baked into the bundle.
 * This preserves that — tries Supabase first (in case another device
 * already seeded/customized this account's steps), but always falls back to
 * the local literal list so the tab never shows empty just because the
 * device happens to be offline right now.
 */
export async function seedDefaultRotinaSteps(userId: string): Promise<void> {
  const count = await db.rotinaStepDefs.where('userId').equals(userId).count();
  if (count > 0) return;

  try {
    const remote = await loadRotinaStepDefsFromSupabase(userId);
    if (remote && remote.length > 0) {
      await db.rotinaStepDefs.bulkAdd(remote);
      return;
    }
  } catch {
    // Offline or network error: fall back to the local literal seed below.
  }

  const now = Date.now();
  const seeded: RotinaStepDefRecord[] = ROTINA_STEPS.map(step => ({
    id: step.id,
    title: step.title,
    emoji: step.emoji,
    period: step.period,
    order: step.order,
    deleted: false,
    updatedAt: now,
    userId,
  }));

  await db.rotinaStepDefs.bulkAdd(seeded);

  // Best-effort push to Supabase. If this fails, the local table is no
  // longer empty, so this function won't run again — queue each seeded step
  // so the normal sync queue (which does check errors) retries the push,
  // instead of silently never syncing the seed to the remote catalog.
  try {
    const { error } = await supabase
      .from('mh_rotina_steps')
      .upsert(
        seeded.map(step => ({
          id: step.id,
          user_id: userId,
          title: step.title,
          emoji: step.emoji,
          period: step.period,
          step_order: step.order,
          deleted: step.deleted,
          updated_at: new Date(step.updatedAt).toISOString(),
        })),
        { onConflict: 'user_id,id' }
      );
    if (error) throw new Error(error.message);
  } catch {
    await db.rotinaStepDefSyncQueue.bulkAdd(seeded.map(step => ({
      type: 'upsert' as const,
      stepDefId: step.id,
      userId,
      timestamp: now,
    })));
  }
}
