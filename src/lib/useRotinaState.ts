import { useState, useEffect, useCallback } from 'react';
import { type User } from '@supabase/supabase-js';
import { db, supabase, type RotinaStepStateRecord } from './db';
import {
  loadRotinaStateFromSupabase, mergeRotinaStateWithLWW,
  syncRotinaStepToSupabase, processRotinaSyncQueue, MAX_SYNC_ATTEMPTS,
} from './rotinaDb';
import { getTodayKey } from './categories';

export interface RotinaStateData {
  done: Record<string, boolean>;
}

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

  const refreshStuckSyncCount = useCallback(async () => {
    const count = await db.rotinaSyncQueue.filter(e => (e.attemptCount || 0) >= MAX_SYNC_ATTEMPTS).count();
    setStuckSyncCount(count);
  }, []);

  const processPendingQueue = useCallback(async () => {
    if (!user) return;
    const allEntries = await db.rotinaSyncQueue.toCollection().sortBy('timestamp');
    const entries = allEntries.filter(e => (e.attemptCount || 0) < MAX_SYNC_ATTEMPTS);

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
  }, [user, refreshStuckSyncCount]);

  const retryStuckEntries = useCallback(async () => {
    const stuck = await db.rotinaSyncQueue.filter(e => (e.attemptCount || 0) >= MAX_SYNC_ATTEMPTS).toArray();
    for (const entry of stuck) {
      await db.rotinaSyncQueue.update(entry.id!, { attemptCount: 0 });
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
      const count = await db.rotinaSyncQueue.filter(e => (e.attemptCount || 0) >= MAX_SYNC_ATTEMPTS).count();
      setStuckSyncCount(count);
    })();
  }, [user]);

  useEffect(() => {
    if (!(isOnline && user)) return;
    (async () => { await processPendingQueue(); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, user]);

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
          const remoteItems = await loadRotinaStateFromSupabase(todayKey, userId);
          if (cancelled) return;
          if (remoteItems) {
            const freshLocalItems = await db.rotinaStepState
              .where('dayKey')
              .equals(todayKey)
              .and(item => item.userId === userId)
              .toArray();
            if (cancelled) return;

            const merged = mergeRotinaStateWithLWW(freshLocalItems, remoteItems);
            const userMerged = merged.filter(item => item.userId === userId);
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
  }, [todayKey, dayChanged, isOnline, user]);

  const addToSyncQueueLocal = useCallback(async (entry: Omit<import('./db').RotinaSyncQueueEntry, 'id' | 'attemptCount'>) => {
    await db.rotinaSyncQueue.add({ ...entry, attemptCount: 0 });
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
    const resetTimestamp = Date.now();
    setState({ done: {} });

    await db.rotinaStepState.where('dayKey').equals(todayKey).and(x => x.userId === user.id).delete();

    if (isOnline) {
      try {
        await supabase
          .from('mh_rotina_state')
          .delete()
          .eq('day_key', todayKey)
          .eq('user_id', user.id)
          .lt('updated_at', new Date(resetTimestamp).toISOString());
      } catch {
        // Ignored, sync queue will run
      }
    }

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
