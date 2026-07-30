import { useState, useEffect, useCallback } from 'react';
import { type User } from '@supabase/supabase-js';
import { db, MAX_SYNC_ATTEMPTS, type AgendaTaskRecord } from './db';
import {
  loadAgendaTasksFromSupabase, mergeAgendaTasksWithLWW,
  syncAgendaTaskToSupabase, processAgendaSyncQueue,
} from './agendaDb';
import { getTodayKey } from './categories';
import { estimateDurationMinutes } from './agendaDurationEstimator';
import { generateSchedule as computeSchedule, type SchedulableTask } from './agendaScheduler';

// Same shape/constraints as useRotinaState: takes `user` as a parameter
// (resolved once in App.tsx) instead of its own auth subscription.
export function useAgendaState(user: User | null) {
  const [tasks, setTasks] = useState<AgendaTaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [dayChanged, setDayChanged] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [stuckSyncCount, setStuckSyncCount] = useState(0);

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

  const refreshStuckSyncCount = useCallback(async () => {
    const count = await db.agendaSyncQueue.filter(e => (e.attemptCount || 0) >= MAX_SYNC_ATTEMPTS).count();
    setStuckSyncCount(count);
  }, []);

  const processPendingQueue = useCallback(async () => {
    if (!user) return;
    const allEntries = await db.agendaSyncQueue.toCollection().sortBy('timestamp');
    const entries = allEntries.filter(e => (e.attemptCount || 0) < MAX_SYNC_ATTEMPTS);

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
  }, [user, refreshStuckSyncCount]);

  const retryStuckEntries = useCallback(async () => {
    const stuck = await db.agendaSyncQueue.filter(e => (e.attemptCount || 0) >= MAX_SYNC_ATTEMPTS).toArray();
    for (const entry of stuck) {
      await db.agendaSyncQueue.update(entry.id!, { attemptCount: 0 });
    }
    await processPendingQueue();
  }, [processPendingQueue]);

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
      const count = await db.agendaSyncQueue.filter(e => (e.attemptCount || 0) >= MAX_SYNC_ATTEMPTS).count();
      setStuckSyncCount(count);
    })();
  }, [user]);

  useEffect(() => {
    if (!(isOnline && user)) return;
    (async () => { await processPendingQueue(); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, user]);

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
  }, [todayKey, dayChanged, isOnline, user]);

  const addToSyncQueueLocal = useCallback(async (taskId: string) => {
    await db.agendaSyncQueue.add({ type: 'upsert', taskId, timestamp: Date.now(), attemptCount: 0 });
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
  const updateTaskDuration = useCallback((id: string, minutes: number) => patchTask(id, { estimatedMinutes: minutes }), [patchTask]);
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

    return { shortfallMinutes: result.shortfallMinutes };
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
    clearAll,
    toggleDone,
    generateSchedule,
  };
}
