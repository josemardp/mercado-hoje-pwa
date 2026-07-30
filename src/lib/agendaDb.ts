import { db, supabase, type AgendaTaskRecord, type AgendaSyncQueueEntry } from './db';

/**
 * Load today's Agenda tasks from Supabase for a specific user/day.
 * Deliberately does NOT filter `deleted = false` server-side — tombstones
 * must be merged too, otherwise the LWW merge could resurrect a task
 * another device soft-deleted. Filtering `!deleted` happens only in the
 * hook, right before exposing tasks to the UI.
 */
export async function loadAgendaTasksFromSupabase(dayKey: string, userId: string): Promise<AgendaTaskRecord[] | null> {
  try {
    const { data, error } = await supabase
      .from('mh_agenda_tasks')
      .select('*')
      .eq('day_key', dayKey)
      .eq('user_id', userId);

    if (error || !data) return null;

    return data.map((row: Record<string, unknown>): AgendaTaskRecord => ({
      id: row.id as string,
      dayKey: row.day_key as string,
      title: row.title as string,
      estimatedMinutes: Number(row.estimated_minutes) || 0,
      fixed: !!row.fixed,
      fixedStart: (row.fixed_start as string) || undefined,
      order: Number(row.order) || 0,
      scheduledStart: (row.scheduled_start as string) || undefined,
      scheduledEnd: (row.scheduled_end as string) || undefined,
      done: !!row.done,
      deleted: !!row.deleted,
      updatedAt: new Date(row.updated_at as string).getTime(),
      userId: row.user_id as string,
    }));
  } catch {
    return null;
  }
}

/**
 * Merge local and remote Agenda tasks using Last-Write-Wins (LWW), keyed by
 * task id. Structurally identical to mergeDayItemsWithLWW/mergeRotinaStateWithLWW.
 */
export function mergeAgendaTasksWithLWW(
  localItems: AgendaTaskRecord[],
  remoteItems: AgendaTaskRecord[],
): AgendaTaskRecord[] {
  const merged = new Map<string, AgendaTaskRecord>();

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
 * Push a single Agenda task to Supabase via the conditional RPC — a stale
 * write (including a soft-delete) can never overwrite a newer one already
 * stored server-side.
 */
export async function syncAgendaTaskToSupabase(task: AgendaTaskRecord): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('upsert_agenda_task_if_newer', {
      p_id: task.id,
      p_day_key: task.dayKey,
      p_title: task.title,
      p_estimated_minutes: task.estimatedMinutes,
      p_fixed: task.fixed,
      p_fixed_start: task.fixedStart || null,
      p_order: task.order,
      p_scheduled_start: task.scheduledStart || null,
      p_scheduled_end: task.scheduledEnd || null,
      p_done: task.done,
      p_deleted: task.deleted,
      p_updated_at: new Date(task.updatedAt).toISOString(),
      p_user_id: task.userId,
    });

    return !error;
  } catch {
    return false;
  }
}

/**
 * Process the local offline Agenda sync queue. A single entry type
 * ('upsert') is enough — every mutation (add/edit/remove/toggle-done/
 * reschedule) is just re-reading the current local row and pushing it
 * whole, since soft-delete is modeled as a normal field.
 */
export async function processAgendaSyncQueue(
  entries: AgendaSyncQueueEntry[],
): Promise<number[]> {
  const successIds: number[] = [];

  for (const entry of entries) {
    try {
      const local = await db.agendaTasks.get(entry.taskId);
      if (local) {
        const ok = await syncAgendaTaskToSupabase(local);
        if (!ok) throw new Error('Failed to sync agenda task');
      }
      successIds.push(entry.id!);
    } catch (err) {
      console.error('Failed to process agenda sync queue entry:', entry, err);
      if (entry.id != null) {
        await db.agendaSyncQueue.update(entry.id, { attemptCount: (entry.attemptCount || 0) + 1 });
      }
    }
  }

  return successIds;
}
