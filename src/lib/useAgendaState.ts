import { useState, useEffect, useCallback, useRef } from 'react';
import { type User } from '@supabase/supabase-js';
import { db, MAX_SYNC_ATTEMPTS, type AgendaTaskRecord } from './db';
import {
  loadAgendaTasksFromSupabase, mergeAgendaTasksWithLWW,
  syncAgendaTaskToSupabase, processAgendaSyncQueue,
} from './agendaDb';
import { getTodayKey } from './categories';
import { estimateDurationMinutes, FLOOR_MINUTES } from './agendaDurationEstimator';
import { generateSchedule as computeSchedule, type SchedulableTask } from './agendaScheduler';

// S2-09: see useStore.ts's identical constant for the rationale.
const FOCUS_SYNC_THROTTLE_MS = 30000;

// Same shape/constraints as useRotinaState: takes `user` as a parameter
// (resolved once in App.tsx) instead of its own auth subscription.
export function useAgendaState(user: User | null) {
  const [tasks, setTasks] = useState<AgendaTaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [dayChanged, setDayChanged] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [stuckSyncCount, setStuckSyncCount] = useState(0);
  const [focusRefresh, setFocusRefresh] = useState(false);

  const todayKey = getTodayKey();

  // ─── Day transition detection ───────────────────────────────────────
  // Own localStorage key (not shared with useDayState/useRotinaState) so
  // this hook's day-rollover doesn't depend on the others mounting.
  useEffect(() => {
    const interval = setInterval(() => {
      const newKey = getTodayKey();
      const oldKey = localStorage.getItem('mh_agenda_last_day_key');
      if (oldKey && oldKey !== newKey) {
        localStorage.setItem('mh_agenda_last_day_key', newKey);
        setDayChanged(prev => !prev);
      }
    }, 30000);

    localStorage.setItem('mh_agenda_last_day_key', todayKey);
    return () => clearInterval(interval);
  }, [todayKey]);

  // AUD-009: entries without a userId predate this field and are treated as
  // belonging to whoever is currently logged in — see SyncQueueEntry.userId
  // in db.ts for the full rationale (shared across all three queues).
  const belongsToActiveUser = useCallback((e: import('./db').AgendaSyncQueueEntry) => !e.userId || e.userId === user?.id, [user]);

  const refreshStuckSyncCount = useCallback(async () => {
    const count = await db.agendaSyncQueue.filter(e => belongsToActiveUser(e) && (e.attemptCount || 0) >= MAX_SYNC_ATTEMPTS).count();
    setStuckSyncCount(count);
  }, [belongsToActiveUser]);

  // S2-03: mutex — see useStore.ts's processPendingQueue for why this is
  // needed (overlapping triggers processing the same pending entries twice).
  const processingRef = useRef(false);

  const processPendingQueue = useCallback(async () => {
    if (!user || processingRef.current) return;
    processingRef.current = true;
    try {
      const allEntries = await db.agendaSyncQueue.toCollection().sortBy('timestamp');
      const entries = allEntries.filter(e => belongsToActiveUser(e) && (e.attemptCount || 0) < MAX_SYNC_ATTEMPTS);

      if (entries.length > 0) {
        setSyncStatus('syncing');
        const successIds = await processAgendaSyncQueue(entries);

        for (const id of successIds) {
          await db.agendaSyncQueue.delete(id);
        }

        if (successIds.length === entries.length) {
          setSyncStatus('synced');
          setTimeout(() => setSyncStatus('idle'), 2000);
        } else {
          setSyncStatus('error');
          setTimeout(() => setSyncStatus('idle'), 3000);
        }
      }

      await refreshStuckSyncCount();
    } finally {
      processingRef.current = false;
    }
  }, [user, refreshStuckSyncCount, belongsToActiveUser]);

  const retryStuckEntries = useCallback(async () => {
    const stuck = await db.agendaSyncQueue.filter(e => belongsToActiveUser(e) && (e.attemptCount || 0) >= MAX_SYNC_ATTEMPTS).toArray();
    for (const entry of stuck) {
      await db.agendaSyncQueue.update(entry.id!, { attemptCount: 0 });
    }
    await processPendingQueue();
  }, [processPendingQueue, belongsToActiveUser]);

  // ─── Online/offline listener ────────────────────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (user) processPendingQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const count = await db.agendaSyncQueue.filter(e => belongsToActiveUser(e) && (e.attemptCount || 0) >= MAX_SYNC_ATTEMPTS).count();
      setStuckSyncCount(count);
    })();
  }, [user, belongsToActiveUser]);

  useEffect(() => {
    if (!(isOnline && user)) return;
    (async () => { await processPendingQueue(); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, user]);

  // S2-09 (AUD-006): see useStore.ts's identical effect for the rationale.
  const lastFocusSyncRef = useRef(0);
  useEffect(() => {
    const trigger = () => {
      if (!user || !isOnline) return;
      const now = Date.now();
      if (now - lastFocusSyncRef.current < FOCUS_SYNC_THROTTLE_MS) return;
      lastFocusSyncRef.current = now;
      processPendingQueue();
      setFocusRefresh(prev => !prev);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') trigger();
    };
    window.addEventListener('focus', trigger);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', trigger);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user, isOnline, processPendingQueue]);

  // ─── Load today's tasks, LWW-merged with remote ─────────────────────
  useEffect(() => {
    if (!user) {
      (async () => {
        setTasks([]);
        setLoading(false);
      })();
      return;
    }

    const userId = user.id;
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const localItems = await db.agendaTasks
          .where('dayKey')
          .equals(todayKey)
          .and(item => item.userId === userId)
          .toArray();

        if (cancelled) return;
        setTasks(localItems.filter(t => !t.deleted).sort((a, b) => a.order - b.order));
      } catch (err) {
        console.error('Failed to load agenda tasks:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }

      if (isOnline) {
        try {
          const remoteItems = await loadAgendaTasksFromSupabase(todayKey, userId);
          if (cancelled) return;
          if (remoteItems) {
            const freshLocalItems = await db.agendaTasks
              .where('dayKey')
              .equals(todayKey)
              .and(item => item.userId === userId)
              .toArray();
            if (cancelled) return;

            const merged = mergeAgendaTasksWithLWW(freshLocalItems, remoteItems);
            const userMerged = merged.filter(item => item.userId === userId);
            await db.agendaTasks.bulkPut(userMerged);
            if (cancelled) return;

            setTasks(userMerged.filter(t => !t.deleted).sort((a, b) => a.order - b.order));
            setSyncStatus('synced');
            setTimeout(() => setSyncStatus('idle'), 2000);
          }
        } catch {
          if (!cancelled) {
            setSyncStatus('error');
            setTimeout(() => setSyncStatus('idle'), 3000);
          }
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [todayKey, dayChanged, isOnline, user, focusRefresh]);

  // AUD-004: agendaDb.ts dispatches this after reconciling a rejected write
  // (applied === false) with the canonical remote row — see the equivalent
  // Rotina-side listener in useRotinaState.ts.
  useEffect(() => {
    const handler = (e: Event) => {
      const { taskId } = (e as CustomEvent<{ taskId: string }>).detail;
      (async () => {
        const rec = await db.agendaTasks.get(taskId);
        setTasks(prev => {
          if (!rec || rec.deleted) return prev.filter(t => t.id !== taskId);
          const idx = prev.findIndex(t => t.id === taskId);
          const next = idx === -1 ? [...prev, rec] : prev.map(t => (t.id === taskId ? rec : t));
          return next.sort((a, b) => a.order - b.order);
        });
      })();
    };
    window.addEventListener('mh:agenda-reconciled', handler);
    return () => window.removeEventListener('mh:agenda-reconciled', handler);
  }, []);

  const addToSyncQueueLocal = useCallback(async (taskId: string) => {
    await db.agendaSyncQueue.add({ type: 'upsert', taskId, userId: user?.id, timestamp: Date.now(), attemptCount: 0 });
    if (isOnline && user) processPendingQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, user]);

  // Writes local-first, then tries a direct remote push; queues on
  // failure/offline. Every mutation funnels through this single path.
  const persistTask = useCallback(async (record: AgendaTaskRecord) => {
    await db.agendaTasks.put(record);

    if (isOnline) {
      try {
        const ok = await syncAgendaTaskToSupabase(record);
        if (ok) {
          setSyncStatus('synced');
          setTimeout(() => setSyncStatus('idle'), 2000);
        } else {
          throw new Error('Supabase sync error');
        }
      } catch {
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 3000);
        await addToSyncQueueLocal(record.id);
      }
    } else {
      await addToSyncQueueLocal(record.id);
    }
  }, [isOnline, addToSyncQueueLocal]);

  const addTask = useCallback(async (title: string, opts?: { fixed?: boolean; fixedStart?: string }): Promise<string> => {
    if (!user) return '';
    const id = crypto.randomUUID();
    const now = Date.now();
    const record: AgendaTaskRecord = {
      id,
      dayKey: todayKey,
      title,
      estimatedMinutes: estimateDurationMinutes(title),
      fixed: !!opts?.fixed,
      fixedStart: opts?.fixedStart,
      order: tasks.length,
      done: false,
      deleted: false,
      updatedAt: now,
      userId: user.id,
    };

    setTasks(prev => [...prev, record]);
    await persistTask(record);
    return id;
  }, [user, todayKey, tasks.length, persistTask]);

  const patchTask = useCallback(async (id: string, patch: Partial<AgendaTaskRecord>) => {
    const existing = tasks.find(t => t.id === id);
    if (!existing) return;
    const updated: AgendaTaskRecord = { ...existing, ...patch, updatedAt: Date.now() };
    setTasks(prev => prev.map(t => (t.id === id ? updated : t)));
    await persistTask(updated);
  }, [tasks, persistTask]);

  const updateTaskTitle = useCallback((id: string, title: string) => patchTask(id, { title }), [patchTask]);
  // AUD-012: the domain enforces the same floor the scheduler compresses
  // down to (FLOOR_MINUTES) — a duration below it can't exist here at all,
  // so compression never has to "grow" an already-too-small task.
  const updateTaskDuration = useCallback((id: string, minutes: number) => patchTask(id, { estimatedMinutes: Math.max(FLOOR_MINUTES, minutes) }), [patchTask]);
  const toggleFixed = useCallback((id: string, fixedStart?: string) => {
    const existing = tasks.find(t => t.id === id);
    if (!existing) return Promise.resolve();
    return patchTask(id, { fixed: !existing.fixed, fixedStart: !existing.fixed ? fixedStart : undefined });
  }, [tasks, patchTask]);
  const toggleDone = useCallback((id: string) => {
    const existing = tasks.find(t => t.id === id);
    if (!existing) return Promise.resolve();
    return patchTask(id, { done: !existing.done });
  }, [tasks, patchTask]);

  const removeTask = useCallback(async (id: string) => {
    const existing = tasks.find(t => t.id === id);
    if (!existing) return;
    const updated: AgendaTaskRecord = { ...existing, deleted: true, updatedAt: Date.now() };
    setTasks(prev => prev.filter(t => t.id !== id));
    await persistTask(updated);
  }, [tasks, persistTask]);

  // Swaps `order` with the adjacent task (by current order) — this is what
  // the scheduler uses to decide sequencing and gap membership around fixed
  // appointments, so reordering here is what actually changes the schedule
  // the next time generateSchedule() runs.
  const moveTask = useCallback(async (id: string, direction: -1 | 1) => {
    const sorted = tasks.slice().sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(t => t.id === id);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return;

    const now = Date.now();
    const a = sorted[idx];
    const b = sorted[swapIdx];
    const updatedA: AgendaTaskRecord = { ...a, order: b.order, updatedAt: now };
    const updatedB: AgendaTaskRecord = { ...b, order: a.order, updatedAt: now };

    setTasks(prev => prev.map(t => (t.id === updatedA.id ? updatedA : t.id === updatedB.id ? updatedB : t)));
    await persistTask(updatedA);
    await persistTask(updatedB);
  }, [tasks, persistTask]);

  // Soft-deletes every task in today's agenda — the "reiniciar" action for
  // Agenda mode, mirroring resetToday()'s role for the fixed routine.
  const clearAll = useCallback(async () => {
    const now = Date.now();
    const toDelete = tasks.map(t => ({ ...t, deleted: true, updatedAt: now }));
    setTasks([]);
    for (const t of toDelete) {
      await persistTask(t);
    }
  }, [tasks, persistTask]);

  const generateSchedule = useCallback(async (windowStart: string, windowEnd: string) => {
    const schedulable: SchedulableTask[] = tasks.map(t => ({
      id: t.id,
      order: t.order,
      estimatedMinutes: t.estimatedMinutes,
      fixed: t.fixed,
      fixedStart: t.fixedStart,
      done: t.done,
      scheduledStart: t.scheduledStart,
      scheduledEnd: t.scheduledEnd,
    }));

    const result = computeSchedule(schedulable, windowStart, windowEnd);

    // S3-06 (AUD-002): never persist an invalid or partial result — an
    // invalid window or two colliding fixed commitments mean there is no
    // schedule to save at all, not an empty/best-effort one.
    if (result.invalidWindow || result.fixedConflicts.length > 0) {
      return {
        shortfallMinutes: 0,
        invalidWindow: result.invalidWindow,
        fixedConflicts: result.fixedConflicts,
      };
    }

    const now = Date.now();
    const updatedTasks = tasks.map(t => {
      const scheduled = result.tasks.find(s => s.id === t.id);
      if (!scheduled) return t;
      return { ...t, scheduledStart: scheduled.scheduledStart, scheduledEnd: scheduled.scheduledEnd, updatedAt: now };
    });

    setTasks(updatedTasks.sort((a, b) => (a.scheduledStart || '').localeCompare(b.scheduledStart || '')));
    for (const t of updatedTasks) {
      await persistTask(t);
    }

    return { shortfallMinutes: result.shortfallMinutes, invalidWindow: false, fixedConflicts: [] };
  }, [tasks, persistTask]);

  return {
    tasks,
    loading,
    syncStatus,
    stuckSyncCount,
    retryStuckEntries,
    addTask,
    updateTaskTitle,
    updateTaskDuration,
    toggleFixed,
    removeTask,
    moveTask,
    clearAll,
    toggleDone,
    generateSchedule,
  };
}
