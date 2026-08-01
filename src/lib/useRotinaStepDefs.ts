import { useState, useEffect, useCallback, useRef } from 'react';
import { type User } from '@supabase/supabase-js';
import { db, MAX_SYNC_ATTEMPTS, type RotinaStepDefRecord } from './db';
import {
  loadRotinaStepDefsFromSupabase, mergeRotinaStepDefsWithLWW,
  syncRotinaStepDefToSupabase, processRotinaStepDefSyncQueue, seedDefaultRotinaSteps,
} from './rotinaStepDefsDb';
import { logError, logQueueHealth } from './logger';

// S2-09: see useStore.ts's identical constant for the rationale.
const FOCUS_SYNC_THROTTLE_MS = 30000;

// Unlike useAgendaState/useRotinaState, this hook has no day-scoping at
// all — a step DEFINITION is a standing part of the routine, not a per-day
// row, so there's no dayKey, no day-rollover timer, and no reset cutoff.
export function useRotinaStepDefs(user: User | null) {
  const [allSteps, setAllSteps] = useState<RotinaStepDefRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [stuckSyncCount, setStuckSyncCount] = useState(0);
  const [focusRefresh, setFocusRefresh] = useState(false);

  const steps = allSteps.filter(s => !s.deleted).sort((a, b) => a.order - b.order);

  const belongsToActiveUser = useCallback((e: import('./db').RotinaStepDefSyncQueueEntry) => !e.userId || e.userId === user?.id, [user]);

  const refreshStuckSyncCount = useCallback(async () => {
    const count = await db.rotinaStepDefSyncQueue.filter(e => belongsToActiveUser(e) && (e.attemptCount || 0) >= MAX_SYNC_ATTEMPTS).count();
    setStuckSyncCount(count);
  }, [belongsToActiveUser]);

  // S2-03: mutex — see useStore.ts's processPendingQueue for why this is
  // needed (overlapping triggers processing the same pending entries twice).
  const processingRef = useRef(false);

  const processPendingQueue = useCallback(async () => {
    if (!user || processingRef.current) return;
    processingRef.current = true;
    try {
      const allEntries = await db.rotinaStepDefSyncQueue.toCollection().sortBy('timestamp');
      const entries = allEntries.filter(e => belongsToActiveUser(e) && (e.attemptCount || 0) < MAX_SYNC_ATTEMPTS);

      if (entries.length > 0) {
        logQueueHealth({ domain: 'rotina-steps', pending: entries.length, oldestTimestamp: entries[0].timestamp });
        setSyncStatus('syncing');
        const successIds = await processRotinaStepDefSyncQueue(user.id, entries);

        for (const id of successIds) {
          await db.rotinaStepDefSyncQueue.delete(id);
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
    const stuck = await db.rotinaStepDefSyncQueue.filter(e => belongsToActiveUser(e) && (e.attemptCount || 0) >= MAX_SYNC_ATTEMPTS).toArray();
    for (const entry of stuck) {
      await db.rotinaStepDefSyncQueue.update(entry.id!, { attemptCount: 0 });
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
      const count = await db.rotinaStepDefSyncQueue.filter(e => belongsToActiveUser(e) && (e.attemptCount || 0) >= MAX_SYNC_ATTEMPTS).count();
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

  // ─── Load steps, seeding defaults on first-ever run, LWW-merged with remote ──
  useEffect(() => {
    if (!user) {
      (async () => {
        setAllSteps([]);
        setLoading(false);
      })();
      return;
    }

    const userId = user.id;
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        // Deliberately unconditional (not gated behind `isOnline`) — the
        // Rotina tab has always shown its steps instantly with zero network
        // dependency, and seedDefaultRotinaSteps already falls back to the
        // local literal list when offline/unreachable.
        await seedDefaultRotinaSteps(userId);
        if (cancelled) return;

        const localItems = await db.rotinaStepDefs.where('userId').equals(userId).toArray();
        if (cancelled) return;
        setAllSteps(localItems);
      } catch (err) {
        logError('Failed to load rotina step definitions', err);
      } finally {
        if (!cancelled) setLoading(false);
      }

      if (isOnline) {
        try {
          const remoteItems = await loadRotinaStepDefsFromSupabase(userId);
          if (cancelled) return;
          if (remoteItems) {
            const freshLocalItems = await db.rotinaStepDefs.where('userId').equals(userId).toArray();
            if (cancelled) return;

            const merged = mergeRotinaStepDefsWithLWW(freshLocalItems, remoteItems);
            const userMerged = merged.filter(item => item.userId === userId);
            await db.rotinaStepDefs.bulkPut(userMerged);
            if (cancelled) return;

            setAllSteps(userMerged);
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
  }, [isOnline, user, focusRefresh]);

  // Mirrors the equivalent Agenda/Rotina-state listeners: reconcileLocal...
  // (rotinaStepDefsDb.ts) dispatches this after pulling the canonical row
  // down when the conditional RPC rejects a stale write.
  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    const handler = (e: Event) => {
      const { stepId } = (e as CustomEvent<{ stepId: string }>).detail;
      (async () => {
        const rec = await db.rotinaStepDefs.get([stepId, userId]);
        setAllSteps(prev => {
          if (!rec) return prev.filter(s => s.id !== stepId);
          const idx = prev.findIndex(s => s.id === stepId);
          return idx === -1 ? [...prev, rec] : prev.map(s => (s.id === stepId ? rec : s));
        });
      })();
    };
    window.addEventListener('mh:rotina-step-def-reconciled', handler);
    return () => window.removeEventListener('mh:rotina-step-def-reconciled', handler);
  }, [user]);

  const addToSyncQueueLocal = useCallback(async (stepDefId: string) => {
    await db.rotinaStepDefSyncQueue.add({ type: 'upsert', stepDefId, userId: user?.id, timestamp: Date.now(), attemptCount: 0 });
    if (isOnline && user) processPendingQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, user]);

  // Writes local-first, then tries a direct remote push; queues on
  // failure/offline. Every mutation funnels through this single path.
  const persistStep = useCallback(async (record: RotinaStepDefRecord) => {
    await db.rotinaStepDefs.put(record);

    if (isOnline) {
      try {
        const ok = await syncRotinaStepDefToSupabase(record);
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

  const addStep = useCallback(async (title: string, emoji: string, period: RotinaStepDefRecord['period']): Promise<string> => {
    if (!user) return '';
    const id = crypto.randomUUID();
    const now = Date.now();
    // Not steps.length: the seeded defaults use order 1..14 (from
    // ROTINA_STEPS), not a dense 0-based sequence — steps.length would
    // collide with the last default's order, making a fresh step's "move
    // up" swap two equal order values (a visible no-op). Max+1 is safe
    // regardless of what numbering scheme came before.
    const nextOrder = steps.length ? Math.max(...steps.map(s => s.order)) + 1 : 0;
    const record: RotinaStepDefRecord = {
      id,
      title,
      emoji,
      period,
      order: nextOrder,
      deleted: false,
      updatedAt: now,
      userId: user.id,
    };

    setAllSteps(prev => [...prev, record]);
    await persistStep(record);
    return id;
  }, [user, steps, persistStep]);

  const patchStep = useCallback(async (id: string, patch: Partial<Pick<RotinaStepDefRecord, 'title' | 'emoji' | 'period' | 'order'>>) => {
    const existing = allSteps.find(s => s.id === id);
    if (!existing) return;
    const updated: RotinaStepDefRecord = { ...existing, ...patch, updatedAt: Date.now() };
    setAllSteps(prev => prev.map(s => (s.id === id ? updated : s)));
    await persistStep(updated);
  }, [allSteps, persistStep]);

  const updateStep = useCallback(
    (id: string, patch: { title?: string; emoji?: string; period?: RotinaStepDefRecord['period'] }) => patchStep(id, patch),
    [patchStep],
  );

  const removeStep = useCallback(async (id: string) => {
    const existing = allSteps.find(s => s.id === id);
    if (!existing) return;
    const updated: RotinaStepDefRecord = { ...existing, deleted: true, updatedAt: Date.now() };
    setAllSteps(prev => prev.map(s => (s.id === id ? updated : s)));
    await persistStep(updated);
  }, [allSteps, persistStep]);

  // Swaps `order` with the adjacent (visible) step — mirrors moveTask in
  // useAgendaState.ts.
  const moveStep = useCallback(async (id: string, direction: -1 | 1) => {
    const idx = steps.findIndex(s => s.id === id);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= steps.length) return;

    const now = Date.now();
    const a = steps[idx];
    const b = steps[swapIdx];
    const updatedA: RotinaStepDefRecord = { ...a, order: b.order, updatedAt: now };
    const updatedB: RotinaStepDefRecord = { ...b, order: a.order, updatedAt: now };

    setAllSteps(prev => prev.map(s => (s.id === updatedA.id ? updatedA : s.id === updatedB.id ? updatedB : s)));
    await persistStep(updatedA);
    await persistStep(updatedB);
  }, [steps, persistStep]);

  return {
    steps,
    loading,
    syncStatus,
    stuckSyncCount,
    retryStuckEntries,
    addStep,
    updateStep,
    removeStep,
    moveStep,
    processSyncQueue: processPendingQueue,
  };
}
