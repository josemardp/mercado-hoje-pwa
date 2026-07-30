import { useState, useEffect, useCallback, useRef } from 'react';
import { type User } from '@supabase/supabase-js';
import { db, type RotinaStepStateRecord, fetchAndStoreResetCutoff, setLocalResetCutoff, resetDayDomain } from './db';
import {
  loadRotinaStateFromSupabase, mergeRotinaStateWithLWW,
  syncRotinaStepToSupabase, processRotinaSyncQueue, MAX_SYNC_ATTEMPTS,
} from './rotinaDb';
import { getTodayKey } from './categories';

export interface RotinaStateData {
  done: Record<string, boolean>;
}

// S2-09: see useStore.ts's identical constant for the rationale.
const FOCUS_SYNC_THROTTLE_MS = 30000;

// Takes `user` as a parameter (resolved by useDayState in App.tsx) instead of
// running its own auth.onAuthStateChange subscription — two independent
// listeners could briefly disagree about who's logged in (e.g. across a
// magic-link redirect), for no benefit here.
export function useRotinaState(user: User | null) {
  const [state, setState] = useState<RotinaStateData>({ done: {} });
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [dayChanged, setDayChanged] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [stuckSyncCount, setStuckSyncCount] = useState(0);
  const [focusRefresh, setFocusRefresh] = useState(false);

  const todayKey = getTodayKey();

  // ─── Day transition detection ───────────────────────────────────────
  // Own localStorage key (not shared with useDayState's 'mh_last_day_key')
  // so this hook's day-rollover doesn't depend on the grocery hook mounting.
  useEffect(() => {
    const interval = setInterval(() => {
      const newKey = getTodayKey();
      const oldKey = localStorage.getItem('mh_rotina_last_day_key');
      if (oldKey && oldKey !== newKey) {
        localStorage.setItem('mh_rotina_last_day_key', newKey);
        setDayChanged(prev => !prev);
      }
    }, 30000);

    localStorage.setItem('mh_rotina_last_day_key', todayKey);
    return () => clearInterval(interval);
  }, [todayKey]);

  // AUD-009: entries without a userId predate this field and are treated as
  // belonging to whoever is currently logged in — see SyncQueueEntry.userId
  // in db.ts for the full rationale (shared across all three queues).
  const belongsToActiveUser = useCallback((e: import('./db').RotinaSyncQueueEntry) => !e.userId || e.userId === user?.id, [user]);

  const refreshStuckSyncCount = useCallback(async () => {
    const count = await db.rotinaSyncQueue.filter(e => belongsToActiveUser(e) && (e.attemptCount || 0) >= MAX_SYNC_ATTEMPTS).count();
    setStuckSyncCount(count);
  }, [belongsToActiveUser]);

  // S2-03: mutex — see useStore.ts's processPendingQueue for why this is
  // needed (overlapping triggers processing the same pending entries twice).
  const processingRef = useRef(false);

  const processPendingQueue = useCallback(async () => {
    if (!user || processingRef.current) return;
    processingRef.current = true;
    try {
      const allEntries = await db.rotinaSyncQueue.toCollection().sortBy('timestamp');
      const entries = allEntries.filter(e => belongsToActiveUser(e) && (e.attemptCount || 0) < MAX_SYNC_ATTEMPTS);

      if (entries.length > 0) {
        setSyncStatus('syncing');
        const successIds = await processRotinaSyncQueue(user.id, entries);

        for (const id of successIds) {
          await db.rotinaSyncQueue.delete(id);
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
    const stuck = await db.rotinaSyncQueue.filter(e => belongsToActiveUser(e) && (e.attemptCount || 0) >= MAX_SYNC_ATTEMPTS).toArray();
    for (const entry of stuck) {
      await db.rotinaSyncQueue.update(entry.id!, { attemptCount: 0 });
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
      const count = await db.rotinaSyncQueue.filter(e => belongsToActiveUser(e) && (e.attemptCount || 0) >= MAX_SYNC_ATTEMPTS).count();
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

  // ─── Load today's state, LWW-merged with remote ────────────────────
  useEffect(() => {
    if (!user) {
      (async () => {
        setState({ done: {} });
        setLoading(false);
      })();
      return;
    }

    const userId = user.id;
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const localItems = await db.rotinaStepState
          .where('dayKey')
          .equals(todayKey)
          .and(item => item.userId === userId)
          .toArray();

        const done: Record<string, boolean> = {};
        localItems.forEach(item => { if (item.done) done[item.stepId] = true; });

        if (cancelled) return;
        setState({ done });
      } catch (err) {
        console.error('Failed to load rotina state:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }

      if (isOnline) {
        try {
          const [remoteItems, cutoffAt] = await Promise.all([
            loadRotinaStateFromSupabase(todayKey, userId),
            fetchAndStoreResetCutoff(userId, todayKey, 'rotina'),
          ]);
          if (cancelled) return;
          if (remoteItems) {
            const freshLocalItems = await db.rotinaStepState
              .where('dayKey')
              .equals(todayKey)
              .and(item => item.userId === userId)
              .toArray();
            if (cancelled) return;

            const merged = mergeRotinaStateWithLWW(freshLocalItems, remoteItems, cutoffAt);
            const userMerged = merged.filter(item => item.userId === userId);

            // AUD-001: purge whatever the cutoff dropped from Dexie too, so
            // this device's own stale copy doesn't linger or get re-pushed.
            const survivingIds = new Set(userMerged.map(item => item.stepId));
            const staleIds = freshLocalItems.filter(item => !survivingIds.has(item.stepId)).map(item => item.stepId);
            if (staleIds.length > 0) {
              await db.rotinaStepState.bulkDelete(staleIds.map(id => [todayKey, id, userId] as [string, string, string]));
            }

            await db.rotinaStepState.bulkPut(userMerged);
            if (cancelled) return;

            const mergedDone: Record<string, boolean> = {};
            userMerged.forEach(item => { if (item.done) mergedDone[item.stepId] = true; });

            setState({ done: mergedDone });
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

  // AUD-004: rotinaDb.ts dispatches this after reconciling a rejected write
  // (applied === false) with the canonical remote row. That only touches
  // Dexie — this hook's own `done` map is in React memory and would
  // otherwise keep showing the stale value until the next full reload.
  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    const handler = (e: Event) => {
      const { stepId } = (e as CustomEvent<{ stepId: string }>).detail;
      (async () => {
        const rec = await db.rotinaStepState.get([todayKey, stepId, userId]);
        setState(prev => {
          const done = { ...prev.done };
          if (rec?.done) done[stepId] = true; else delete done[stepId];
          return { done };
        });
      })();
    };
    window.addEventListener('mh:rotina-reconciled', handler);
    return () => window.removeEventListener('mh:rotina-reconciled', handler);
  }, [todayKey, user]);

  const addToSyncQueueLocal = useCallback(async (entry: Omit<import('./db').RotinaSyncQueueEntry, 'id' | 'attemptCount' | 'userId'>) => {
    await db.rotinaSyncQueue.add({ ...entry, userId: user?.id, attemptCount: 0 });
    if (isOnline && user) processPendingQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, user]);

  const toggleStep = useCallback(async (stepId: string): Promise<boolean> => {
    if (!user) return false;
    const willBeDone = !state.done[stepId];
    const now = Date.now();

    const record: RotinaStepStateRecord = {
      dayKey: todayKey,
      stepId,
      done: willBeDone,
      updatedAt: now,
      userId: user.id,
    };

    setState(prev => {
      const done = { ...prev.done };
      if (willBeDone) done[stepId] = true; else delete done[stepId];
      return { done };
    });

    await db.rotinaStepState.put(record);

    if (isOnline) {
      try {
        const ok = await syncRotinaStepToSupabase(record);
        if (ok) {
          setSyncStatus('synced');
          setTimeout(() => setSyncStatus('idle'), 2000);
        } else {
          throw new Error('Supabase sync error');
        }
      } catch {
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 3000);
        await addToSyncQueueLocal({
          type: willBeDone ? 'complete' : 'uncomplete',
          dayKey: todayKey,
          stepId,
          updatedAt: now,
          timestamp: now,
        });
      }
    } else {
      await addToSyncQueueLocal({
        type: willBeDone ? 'complete' : 'uncomplete',
        dayKey: todayKey,
        stepId,
        updatedAt: now,
        timestamp: now,
      });
    }

    if (willBeDone && 'vibrate' in navigator) navigator.vibrate(30);

    return willBeDone;
  }, [state, todayKey, isOnline, user, addToSyncQueueLocal]);

  const resetToday = useCallback(async () => {
    if (!user) return;
    setState({ done: {} });

    await db.rotinaStepState.where('dayKey').equals(todayKey).and(x => x.userId === user.id).delete();

    if (isOnline) {
      try {
        // AUD-001: registers/advances the server-side cutoff and deletes
        // stale rows atomically, using the server's own clock as the
        // reset boundary.
        await resetDayDomain(user.id, todayKey, 'rotina');
        return;
      } catch {
        // Falls through: record a local cutoff immediately and queue the
        // real reset for when connectivity (or the RPC) works again.
      }
    }

    const resetTimestamp = Date.now();
    await setLocalResetCutoff(user.id, todayKey, 'rotina', resetTimestamp);
    await addToSyncQueueLocal({
      type: 'reset',
      dayKey: todayKey,
      timestamp: resetTimestamp,
    });
  }, [todayKey, isOnline, user, addToSyncQueueLocal]);

  return {
    done: state.done,
    loading,
    syncStatus,
    toggleStep,
    resetToday,
    stuckSyncCount,
    retryStuckEntries,
  };
}
