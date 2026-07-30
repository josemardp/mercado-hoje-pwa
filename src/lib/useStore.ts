import { useState, useEffect, useCallback, useRef } from 'react';
import { type User } from '@supabase/supabase-js';
import {
  db, supabase, type DayItemRecord, type ItemRecord, type SyncQueueEntry,
  syncDayItemToSupabase, loadDayStateFromSupabase, mergeDayItemsWithLWW,
  processSyncQueue, syncCategoryToSupabase, compactSyncQueueEntries,
  initializeDefaultItems, MAX_SYNC_ATTEMPTS, remapItemId,
  fetchAndStoreResetCutoff, setLocalResetCutoff, resetDayDomain,
} from './db';

import { getTodayKey } from './categories';
import { logError, logQueueHealth } from './logger';

export interface DayStateData {
  checked: Record<string, boolean>;
  postponed: Record<string, boolean>;
  inToday: Record<string, boolean>;
}

function getTodayItems(): DayStateData {
  return { checked: {}, postponed: {}, inToday: {} };
}

// S2-09: don't re-sync on every single focus/visibility blip (e.g. rapid
// tab switching) — once per window is enough to catch up with whatever
// another device changed while this tab sat in the background.
const FOCUS_SYNC_THROTTLE_MS = 30000;

// S2-08: takes `user` as a parameter, resolved once by AuthProvider — see
// useRotinaState/useAgendaState for the same convention. This hook used to
// run its own getSession()/onAuthStateChange subscription in parallel with
// useItems()' identical one; AuthProvider is now the single source of truth.
export function useDayState(user: User | null) {
  const [state, setState] = useState<DayStateData>(getTodayItems());
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [dayChanged, setDayChanged] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [stuckSyncCount, setStuckSyncCount] = useState(0);
  const [focusRefresh, setFocusRefresh] = useState(false);

  const todayKey = getTodayKey();

  // ─── Day transition detection ──────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const newKey = getTodayKey();
      const oldKey = localStorage.getItem('mh_last_day_key');
      if (oldKey && oldKey !== newKey) {
        localStorage.setItem('mh_last_day_key', newKey);
        setDayChanged(prev => !prev);
      }
    }, 30000);

    localStorage.setItem('mh_last_day_key', todayKey);
    return () => clearInterval(interval);
  }, [todayKey]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  // One-time recovery path only (forgot password) — not the everyday login,
  // which now goes through signInWithPassword above.
  const sendPasswordReset = useCallback(async (email: string) => {
    // AUD-015: derive from Vite's own base path instead of hardcoding
    // '/mercado-hoje-pwa/' — works for any base/domain the app is deployed
    // under (a different GitHub Pages repo name, a custom domain, etc).
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + import.meta.env.BASE_URL,
    });
    if (error) throw error;
  }, []);

  // Requires an already-active session (used both right after a password
  // reset redirect and from the logged-in "Alterar senha" action).
  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    await db.items.clear();
    await db.dayItems.clear();
    await db.syncQueue.clear();
    await db.rotinaStepStateByUser.clear();
    await db.rotinaSyncQueue.clear();
    await db.agendaTasks.clear();
    await db.agendaSyncQueue.clear();
    // `user` itself is owned by AuthProvider now — signOut() above already
    // triggers its onAuthStateChange listener, which clears it there.
    setState(getTodayItems());
  }, []);

  // AUD-009: entries without a userId predate this field and are treated as
  // belonging to whoever is currently logged in, so nothing already pending
  // gets silently stranded by this change — see SyncQueueEntry.userId.
  const belongsToActiveUser = useCallback((e: SyncQueueEntry) => !e.userId || e.userId === user?.id, [user]);

  const refreshStuckSyncCount = useCallback(async () => {
    const count = await db.syncQueue.filter(e => belongsToActiveUser(e) && (e.attemptCount || 0) >= MAX_SYNC_ATTEMPTS).count();
    setStuckSyncCount(count);
  }, [belongsToActiveUser]);

  // S2-03: mutex — 'online', the mount effect, and 'mh:queue-updated' can
  // all fire close together and each call processPendingQueue(); without
  // this, two overlapping runs could both read the same pending entries
  // before either finishes deleting them, syncing every one of them twice.
  const processingRef = useRef(false);

  const processPendingQueue = useCallback(async () => {
    if (!user || processingRef.current) return;
    processingRef.current = true;
    try {
      const allEntries = await db.syncQueue.toCollection().sortBy('timestamp');
      // Entries that already exhausted their retries are left alone here —
      // they only move again via an explicit retryStuckEntries() call — so a
      // permanently-broken entry doesn't hammer the API forever in silence.
      const pending = allEntries.filter(e => belongsToActiveUser(e) && (e.attemptCount || 0) < MAX_SYNC_ATTEMPTS);
      const { entries, idsCoveredBy } = compactSyncQueueEntries(pending);

      if (entries.length > 0) {
        logQueueHealth({ domain: 'compras', pending: entries.length, oldestTimestamp: pending[0]?.timestamp ?? null });
        setSyncStatus('syncing');
        const successIds = await processSyncQueue(user.id, entries);

        for (const id of successIds) {
          const covered = idsCoveredBy.get(id) || [id];
          for (const coveredId of covered) {
            await db.syncQueue.delete(coveredId);
          }
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
    const stuck = await db.syncQueue.filter(e => belongsToActiveUser(e) && (e.attemptCount || 0) >= MAX_SYNC_ATTEMPTS).toArray();
    for (const entry of stuck) {
      await db.syncQueue.update(entry.id!, { attemptCount: 0 });
    }
    await processPendingQueue();
  }, [processPendingQueue, belongsToActiveUser]);

  // Reflect stuck-entry count as soon as we know who's logged in, not only
  // after the first sync run this session.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const count = await db.syncQueue.filter(e => belongsToActiveUser(e) && (e.attemptCount || 0) >= MAX_SYNC_ATTEMPTS).count();
      setStuckSyncCount(count);
    })();
  }, [user, belongsToActiveUser]);

  // ─── Online/offline listener + sync queue reprocessing ──
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (user) {
        processPendingQueue();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user, processPendingQueue]);

  // Process pending queue on mount or login if online
  useEffect(() => {
    if (!(isOnline && user)) return;
    (async () => {
      await processPendingQueue();
    })();
  }, [isOnline, user, processPendingQueue]);

  // db.ts dispatches this when something outside this hook (useItems'
  // addItem, initializeDefaultItems) enqueues sync entries this hook has
  // no direct reference to — kick the queue instead of waiting for the
  // next unrelated online/mount trigger.
  useEffect(() => {
    const handler = () => {
      if (isOnline && user) processPendingQueue();
    };
    window.addEventListener('mh:queue-updated', handler);
    return () => window.removeEventListener('mh:queue-updated', handler);
  }, [isOnline, user, processPendingQueue]);

  // S2-09 (AUD-006): pulls happen on login, day change and online/offline —
  // never just from switching back to an already-open tab, so two open
  // devices can silently drift until something else triggers a reload.
  // Coming back to this tab (focus/visibility) now also re-syncs, throttled
  // so rapid tab-switching doesn't hammer the API.
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

  // db.ts dispatches this after remapItemId (name-collision reconciliation)
  // moves an item to its canonical id. That only touches Dexie — this
  // hook's own checked/postponed/inToday state is in React memory and
  // would otherwise keep the stale id until the next full day-state
  // reload, making the item vanish from every tab in the meantime.
  useEffect(() => {
    const handler = (e: Event) => {
      const { oldId, newId } = (e as CustomEvent<{ oldId: string; newId: string }>).detail;
      setState(prev => {
        const remapKey = (obj: Record<string, boolean>) => {
          if (!(oldId in obj)) return obj;
          const { [oldId]: value, ...rest } = obj;
          return { ...rest, [newId]: value };
        };
        return {
          checked: remapKey(prev.checked),
          postponed: remapKey(prev.postponed),
          inToday: remapKey(prev.inToday),
        };
      });
    };
    window.addEventListener('mh:item-remapped', handler);
    return () => window.removeEventListener('mh:item-remapped', handler);
  }, []);

  // ─── Load day state with LWW merge + carry over postponed ──────
  useEffect(() => {
    if (!user) {
      // Covers both "never logged in yet" and "session ended externally"
      // (expired/revoked without going through this app's own logout button)
      // — either way, nothing here should keep showing a previous user's data.
      (async () => {
        setState(getTodayItems());
        setLoading(false);
      })();
      return;
    }

    const userId = user.id;
    let cancelled = false;

    async function load() {
      // Deliberate safe fallback (not dead code): read in the online-merge
      // block below even if the try block throws before ever assigning to it.
      // eslint-disable-next-line no-useless-assignment
      let localItems: DayItemRecord[] = [];

      try {
        setLoading(true);

        localItems = await db.dayItems
          .where('dayKey')
          .equals(todayKey)
          .and(item => item.userId === userId)
          .toArray();

        const lastItem = await db.dayItems
          .where('dayKey')
          .below(todayKey)
          .and(item => item.userId === userId)
          .reverse()
          .first();

        if (lastItem) {
          const lastDayItems = await db.dayItems
            .where('dayKey')
            .equals(lastItem.dayKey)
            .and(item => item.userId === userId)
            .toArray();
          const postponed = lastDayItems.filter(item => item.postponed);
          if (postponed.length > 0) {
            const now = Date.now();
            const alreadyToday = new Set(localItems.map(item => item.itemId));
            const carriedOver = postponed
              .filter(item => !alreadyToday.has(item.itemId))
              .map(item => ({
                dayKey: todayKey,
                itemId: item.itemId,
                checked: false,
                postponed: false,
                inToday: true,
                updatedAt: now,
                userId,
              }));

            if (carriedOver.length > 0) {
              await db.dayItems.bulkAdd(carriedOver);

              for (const item of carriedOver) {
                await db.syncQueue.add({
                  type: 'unpostpone',
                  dayKey: todayKey,
                  itemId: item.itemId,
                  timestamp: now,
                });
              }

              localItems = [...localItems, ...carriedOver];
            }
          }
        }

        const checked: Record<string, boolean> = {};
        const postponed: Record<string, boolean> = {};
        const inToday: Record<string, boolean> = {};

        localItems.forEach(item => {
          if (item.checked) checked[item.itemId] = true;
          if (item.postponed) postponed[item.itemId] = true;
          if (item.inToday) inToday[item.itemId] = true;
        });

        if (cancelled) return;
        setState({ checked, postponed, inToday });
      } catch (err) {
        logError('Failed to load day state', err);
      } finally {
        if (!cancelled) setLoading(false);
      }

      if (isOnline) {
        try {
          const [remoteItems, cutoffAt] = await Promise.all([
            loadDayStateFromSupabase(todayKey, userId),
            fetchAndStoreResetCutoff(userId, todayKey, 'compras'),
          ]);
          if (cancelled) return;
          if (remoteItems) {
            // Re-read local state fresh right before merging: the network
            // request above may have taken a while, and the user could have
            // acted on an item in the meantime. Merging against the stale
            // `localItems` snapshot captured at the top of this function
            // would silently revert that action.
            const freshLocalItems = await db.dayItems
              .where('dayKey')
              .equals(todayKey)
              .and(item => item.userId === userId)
              .toArray();
            if (cancelled) return;

            const merged = mergeDayItemsWithLWW(freshLocalItems, remoteItems, cutoffAt);
            const userMerged = merged.filter(item => item.userId === userId);

            // AUD-001: anything the cutoff dropped must also leave Dexie —
            // otherwise this device's own stale copy lingers locally and can
            // resurface in a future sync-queue push.
            const survivingIds = new Set(userMerged.map(item => item.itemId));
            const staleIds = freshLocalItems.filter(item => !survivingIds.has(item.itemId)).map(item => item.itemId);
            if (staleIds.length > 0) {
              await db.dayItems.bulkDelete(staleIds.map(id => [todayKey, id] as [string, string]));
            }

            await db.dayItems.bulkPut(userMerged);
            if (cancelled) return;

            const mergedChecked: Record<string, boolean> = {};
            const mergedPostponed: Record<string, boolean> = {};
            const mergedInToday: Record<string, boolean> = {};

            userMerged.forEach(item => {
              if (item.checked) mergedChecked[item.itemId] = true;
              if (item.postponed) mergedPostponed[item.itemId] = true;
              if (item.inToday) mergedInToday[item.itemId] = true;
            });

            setState({ checked: mergedChecked, postponed: mergedPostponed, inToday: mergedInToday });
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
    return () => {
      cancelled = true;
    };
  }, [todayKey, dayChanged, isOnline, user, focusRefresh]);

  const saveSingleItemState = useCallback(async (itemId: string, itemState: Omit<DayItemRecord, 'dayKey' | 'itemId' | 'userId' | 'updatedAt'>) => {
    if (!user) return;
    const now = Date.now();
    const itemRecord: DayItemRecord = {
      dayKey: todayKey,
      itemId,
      checked: itemState.checked,
      postponed: itemState.postponed,
      inToday: itemState.inToday,
      updatedAt: now,
      userId: user.id,
    };

    // Save local
    await db.dayItems.put(itemRecord);

    // Sync remote
    if (isOnline) {
      try {
        const ok = await syncDayItemToSupabase(itemRecord);
        if (ok) {
          setSyncStatus('synced');
          setTimeout(() => setSyncStatus('idle'), 2000);
        } else {
          throw new Error('Supabase sync error');
        }
      } catch {
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 3000);
      }
    }
  }, [todayKey, isOnline, user]);

  const addToSyncQueueLocal = useCallback(async (entry: Omit<SyncQueueEntry, 'id' | 'attemptCount' | 'userId'>) => {
    await db.syncQueue.add({
      ...entry,
      userId: user?.id,
      attemptCount: 0,
    });
    if (isOnline && user) {
      processPendingQueue();
    }
  }, [isOnline, user, processPendingQueue]);

  const syncCategory = useCallback(async (itemId: string, newCategory: string) => {
    if (!user) return;
    // Update local immediately
    await db.items.update(itemId, { category: newCategory });

    if (isOnline) {
      const ok = await syncCategoryToSupabase(itemId, user.id, newCategory);
      if (!ok) {
        await addToSyncQueueLocal({
          type: 'category',
          dayKey: todayKey,
          itemId,
          category: newCategory,
          timestamp: Date.now(),
        });
      }
    } else {
      await addToSyncQueueLocal({
        type: 'category',
        dayKey: todayKey,
        itemId,
        category: newCategory,
        timestamp: Date.now(),
      });
    }
  }, [isOnline, addToSyncQueueLocal, todayKey, user]);

  const toggleItem = useCallback(async (itemId: string, itemRecord?: ItemRecord) => {
    if (!user) return false;
    const newState = { ...state };
    newState.checked = { ...newState.checked };
    newState.inToday = { ...newState.inToday };

    const willBeChecked = !newState.checked[itemId];
    let updatedCount: number | undefined;
    let updatedTime: number | undefined;

    if (newState.checked[itemId]) {
      delete newState.checked[itemId];
    } else {
      newState.checked[itemId] = true;
      // NOTE: inToday stays true — checking an item means "done", not
      // "no longer part of today's list". Setting it false here made the
      // item vanish from allItemsForDay (items.filter(inToday)), which
      // concludedItems/concludedByCategory are also derived from — so the
      // Concluídos tab could never show anything a user had just checked.
      // "Hoje" already correctly hides checked items via the separate
      // !state.checked filter in pendingByCategory, so this was never
      // needed for that side either.

      // Update local catalog count first — local write must be complete
      // and confirmed before any sync is triggered (item 3).
      updatedCount = (itemRecord?.useCount || 0) + 1;
      updatedTime = Date.now();
      await db.items.update(itemId, {
        useCount: updatedCount,
        lastUsed: updatedTime,
      });
    }

    setState(newState);

    // Save individual day item state locally (and attempt direct remote
    // sync) BEFORE queuing/triggering background reprocessing, so the
    // queue never reads a not-yet-written local record.
    await saveSingleItemState(itemId, {
      checked: !!newState.checked[itemId],
      postponed: !!newState.postponed[itemId],
      inToday: !!newState.inToday[itemId],
    });

    if (willBeChecked) {
      await addToSyncQueueLocal({
        type: 'mark',
        dayKey: todayKey,
        itemId,
        timestamp: updatedTime!,
      });

      // AUD-003: a single strategy for use_count — an idempotent atomic
      // increment, queued and retried like every other write, instead of
      // also enqueuing an absolute "use_count = N" write for the same
      // action. Combining both let a queued write with a slightly later
      // timestamp silently clobber a concurrent increment from another
      // device. operationId stays stable across retries of this same entry.
      await addToSyncQueueLocal({
        type: 'incrementUse',
        dayKey: todayKey,
        itemId,
        increment: 1,
        operationId: crypto.randomUUID(),
        timestamp: updatedTime!,
      });
    } else {
      await addToSyncQueueLocal({
        type: 'unmark',
        dayKey: todayKey,
        itemId,
        timestamp: Date.now(),
      });
    }

    if (willBeChecked && 'vibrate' in navigator) {
      navigator.vibrate(30);
    }

    return willBeChecked;
  }, [state, saveSingleItemState, addToSyncQueueLocal, todayKey, user]);

  const postponeItem = useCallback(async (itemId: string) => {
    if (!user) return state;
    const newState = { ...state };
    newState.postponed = { ...newState.postponed };
    newState.checked = { ...newState.checked };
    newState.inToday = { ...newState.inToday };

    newState.postponed[itemId] = true;
    delete newState.checked[itemId];
    newState.inToday[itemId] = false;

    setState(newState);

    await saveSingleItemState(itemId, {
      checked: false,
      postponed: true,
      inToday: false,
    });

    await addToSyncQueueLocal({
      type: 'postpone',
      dayKey: todayKey,
      itemId,
      timestamp: Date.now(),
    });

    return newState;
  }, [state, saveSingleItemState, addToSyncQueueLocal, todayKey, user]);

  const unpostponeItem = useCallback(async (itemId: string) => {
    if (!user) return state;
    const newState = { ...state };
    newState.postponed = { ...newState.postponed };
    newState.inToday = { ...newState.inToday };

    delete newState.postponed[itemId];
    newState.inToday[itemId] = true;

    setState(newState);

    await saveSingleItemState(itemId, {
      checked: false,
      postponed: false,
      inToday: true,
    });

    await addToSyncQueueLocal({
      type: 'unpostpone',
      dayKey: todayKey,
      itemId,
      timestamp: Date.now(),
    });

    return newState;
  }, [state, saveSingleItemState, addToSyncQueueLocal, todayKey, user]);

  // AUD-010: separate from resetAll below — this only unchecks items still
  // marked as bought, keeping them on today's list. resetAll wipes the whole
  // list (including items never checked); the two were previously conflated
  // behind a single "Limpar marcações" button that acted like this one but
  // actually behaved like the other.
  const unmarkAllChecked = useCallback(async () => {
    if (!user) return;
    const checkedIds = Object.keys(state.checked).filter(id => state.checked[id]);
    if (checkedIds.length === 0) return;

    setState(prev => ({ ...prev, checked: {} }));

    for (const itemId of checkedIds) {
      await saveSingleItemState(itemId, {
        checked: false,
        postponed: state.postponed[itemId] || false,
        inToday: true,
      });
      await addToSyncQueueLocal({
        type: 'unmark',
        dayKey: todayKey,
        itemId,
        timestamp: Date.now(),
      });
    }
  }, [state, saveSingleItemState, addToSyncQueueLocal, todayKey, user]);

  const resetAll = useCallback(async () => {
    if (!user) return;
    const newState = { checked: {}, postponed: {}, inToday: {} };
    setState(newState);

    // Delete day items from local DB for this day
    await db.dayItems.where('dayKey').equals(todayKey).and(x => x.userId === user.id).delete();

    if (isOnline) {
      try {
        // AUD-001: registers/advances the server-side cutoff and deletes
        // stale rows atomically, using the server's own clock — not this
        // device's — as the reset boundary.
        await resetDayDomain(user.id, todayKey, 'compras');
        return;
      } catch {
        // Falls through to the offline-style path below: record a local
        // cutoff immediately and queue the real reset for when connectivity
        // (or the RPC) works again.
      }
    }

    const resetTimestamp = Date.now();
    await setLocalResetCutoff(user.id, todayKey, 'compras', resetTimestamp);
    await addToSyncQueueLocal({
      type: 'reset',
      dayKey: todayKey,
      timestamp: resetTimestamp,
    });
  }, [addToSyncQueueLocal, todayKey, isOnline, user]);

  const addItemToToday = useCallback(async (item: ItemRecord) => {
    if (!user) return;
    const newState = { ...state };
    newState.checked = { ...newState.checked };
    newState.postponed = { ...newState.postponed };
    newState.inToday = { ...newState.inToday };

    newState.inToday[item.id] = true;
    delete newState.postponed[item.id];
    delete newState.checked[item.id];

    setState(newState);

    await saveSingleItemState(item.id, {
      checked: false,
      postponed: false,
      inToday: true,
    });

    await addToSyncQueueLocal({
      type: 'add',
      dayKey: todayKey,
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      qty: item.qty,
      emoji: item.emoji,
      useCount: item.useCount,
      lastUsed: item.lastUsed,
      timestamp: Date.now(),
    });
  }, [state, saveSingleItemState, addToSyncQueueLocal, todayKey, user]);

  return {
    signInWithPassword,
    sendPasswordReset,
    updatePassword,
    logout,
    state,
    loading,
    syncStatus,
    isOnline,
    toggleItem,
    postponeItem,
    unpostponeItem,
    unmarkAllChecked,
    resetAll,
    addItemToToday,
    syncCategory,
    processSyncQueue: processPendingQueue,
    stuckSyncCount,
    retryStuckEntries,
  };
}

// S2-08: takes `user` as a parameter (AuthProvider) instead of running its
// own getSession()/onAuthStateChange subscription in parallel with
// useDayState's identical one — see useDayState for the same change.
export function useItems(user: User | null) {
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tracks whose data is currently "current" so a slow load() that started
  // for a previous session can't apply its result after logout/user switch.
  const currentUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentUserIdRef.current = user?.id ?? null;
  }, [user]);

  // Clears the catalog on logout/session-loss — mirrors the reset that used
  // to happen inside this hook's own onAuthStateChange listener.
  useEffect(() => {
    if (!user) {
      (async () => { setItems([]); })();
    }
  }, [user]);

  // db.ts dispatches this after a name-collision remap. loadItems()'s own
  // remote merge can race with remapItemId's Dexie cleanup and resurrect
  // the old id as a spurious duplicate catalog entry (it has no dayItems
  // row anymore, so it wouldn't show in any list, but it would show up
  // twice in autocomplete) — delete it defensively and drop it from state
  // regardless of which one actually won the race.
  useEffect(() => {
    const handler = (e: Event) => {
      const { oldId } = (e as CustomEvent<{ oldId: string; newId: string }>).detail;
      db.items.delete(oldId).catch(() => {});
      setItems(prev => prev.filter(i => i.id !== oldId));
    };
    window.addEventListener('mh:item-remapped', handler);
    return () => window.removeEventListener('mh:item-remapped', handler);
  }, []);

  const loadItems = useCallback(async () => {
    if (!user) return;
    const requestUserId = user.id;
    const isStale = () => currentUserIdRef.current !== requestUserId;

    try {
      setLoading(true);
      const allItems = await db.items.where('userId').equals(user.id).toArray();
      if (isStale()) return;
      allItems.sort((a, b) => (b.useCount || 0) - (a.useCount || 0));
      setItems(allItems);
    } catch (err) {
      if (!isStale()) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(msg);
        setItems([]);
      }
    } finally {
      if (!isStale()) setLoading(false);
    }

    if (navigator.onLine) {
      try {
        await initializeDefaultItems(user.id);
        if (isStale()) return;

        const { data: remoteItems, error } = await supabase
          .from('mh_items')
          .select('*')
          .eq('user_id', user.id)
          .order('use_count', { ascending: false });
        if (isStale()) return;

        if (!error && remoteItems && remoteItems.length > 0) {
          const updatedItems = await db.items.where('userId').equals(user.id).toArray();
          if (isStale()) return;
          const merged = [...updatedItems];

          for (const item of remoteItems) {
            const localItemIdx = merged.findIndex(i => i.id === item.id);
            const remoteLastUsed = Number(item.last_used) || 0;
            const remoteUseCount = Number(item.use_count) || 0;
            const remoteRecord: ItemRecord = {
              id: item.id as string,
              name: item.name as string,
              category: item.category as string,
              emoji: item.emoji as string | undefined,
              qty: Number(item.qty) || 1,
              useCount: remoteUseCount,
              lastUsed: remoteLastUsed || undefined,
              userId: item.user_id as string,
            };

            if (localItemIdx === -1) {
              merged.push(remoteRecord);
            } else {
              const localItem = merged[localItemIdx];
              const localLastUsed = localItem.lastUsed || 0;
              if (remoteLastUsed > localLastUsed) {
                merged[localItemIdx] = remoteRecord;
              }
            }
          }

          merged.sort((a, b) => (b.useCount || 0) - (a.useCount || 0));
          await db.items.bulkPut(merged);
          if (isStale()) return;
          setItems(merged);
        }
      } catch {
        // Ignored: keep local
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      await loadItems();
    })();
  }, [user, loadItems]);

  const addItem = useCallback(async (name: string, category: string, emoji?: string, qty?: number): Promise<string> => {
    if (!user) throw new Error('User not logged in');

    // Check if item already exists locally by name (case-insensitive)
    const existing = await db.items
      .where('name')
      .equalsIgnoreCase(name)
      .and(x => x.userId === user.id)
      .first();

    if (existing) {
      const updatedCount = (existing.useCount || 0) + 1;
      const updatedTime = Date.now();
      await db.items.update(existing.id, {
        category,
        emoji,
        useCount: updatedCount,
        lastUsed: updatedTime,
      });

      const queueFallback = () => db.syncQueue.add({
        type: 'add',
        dayKey: getTodayKey(),
        itemId: existing.id,
        itemName: existing.name,
        category,
        qty: existing.qty,
        emoji,
        useCount: updatedCount,
        lastUsed: updatedTime,
        timestamp: updatedTime,
        attemptCount: 0,
      });

      if (navigator.onLine) {
        try {
          // Goes through the same conditional RPC as a fresh 'add' — an
          // existing id just takes the "update if newer" branch, so a
          // stale write here can never clobber a more recent change made
          // from another device.
          const { data: canonicalId, error } = await supabase.rpc('upsert_item_reconcile_name', {
            p_id: existing.id,
            p_name: existing.name,
            p_category: category,
            p_emoji: emoji || null,
            p_qty: existing.qty || 1,
            p_use_count: updatedCount,
            p_last_used: updatedTime,
            p_updated_at: new Date(updatedTime).toISOString(),
            p_user_id: user.id,
          });
          if (error) throw new Error(error.message);
          if (canonicalId && canonicalId !== existing.id) {
            await remapItemId(existing.id, canonicalId as string);
          }
        } catch {
          await queueFallback();
        }
      } else {
        await queueFallback();
      }
      await loadItems();
      return existing.id;
    }

    // Generate local UUID
    const uuid = crypto.randomUUID();

    const newItem: ItemRecord = {
      id: uuid,
      name,
      category,
      emoji,
      qty: qty || 1,
      useCount: 1,
      lastUsed: Date.now(),
      userId: user.id,
    };

    // Add local — the item is usable immediately after this.
    await db.items.add(newItem);

    // Sync remote in the background. The caller doesn't need this
    // round-trip to finish (offline-first: local state is already correct),
    // so don't block the UI on network latency here.
    (async () => {
      if (navigator.onLine) {
        try {
          // A plain .insert() here would silently resolve with an unchecked
          // {error} on a name collision (Supabase doesn't throw for that),
          // so two devices creating the same new item close together would
          // each keep their own local id forever. Go through the same
          // reconcile RPC the offline queue uses instead.
          const { data: canonicalId, error } = await supabase.rpc('upsert_item_reconcile_name', {
            p_id: newItem.id,
            p_name: newItem.name,
            p_category: newItem.category,
            p_emoji: newItem.emoji || null,
            p_qty: newItem.qty || 1,
            p_use_count: newItem.useCount,
            p_last_used: newItem.lastUsed,
            p_updated_at: new Date(newItem.lastUsed || Date.now()).toISOString(),
            p_user_id: user.id,
          });
          if (error) throw new Error(error.message);
          if (canonicalId && canonicalId !== newItem.id) {
            await remapItemId(newItem.id, canonicalId as string);
          }
        } catch {
          await db.syncQueue.add({
            type: 'add',
            dayKey: getTodayKey(),
            itemId: newItem.id,
            itemName: newItem.name,
            category: newItem.category,
            qty: newItem.qty,
            emoji: newItem.emoji,
            useCount: newItem.useCount,
            lastUsed: newItem.lastUsed,
            timestamp: Date.now(),
            attemptCount: 0,
          });
        }
      } else {
        await db.syncQueue.add({
          type: 'add',
          dayKey: getTodayKey(),
          itemId: newItem.id,
          itemName: newItem.name,
          category: newItem.category,
          qty: newItem.qty,
          emoji: newItem.emoji,
          useCount: newItem.useCount,
          lastUsed: newItem.lastUsed,
          timestamp: Date.now(),
          attemptCount: 0,
        });
      }
      await loadItems();
    })();

    return uuid;
  }, [user, loadItems]);

  const searchItems = useCallback(async (query: string): Promise<ItemRecord[]> => {
    if (!user || !query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    const allItems = await db.items.where('userId').equals(user.id).toArray();
    return allItems
      .filter(item => item.name.toLowerCase().includes(lowerQuery))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(lowerQuery);
        const bStarts = b.name.toLowerCase().startsWith(lowerQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return (b.useCount || 0) - (a.useCount || 0);
      });
  }, [user]);

  return { items, loading, error, addItem, searchItems, loadItems };
}
