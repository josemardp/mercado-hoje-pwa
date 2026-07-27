import { useState, useEffect, useCallback } from 'react';
import { type User } from '@supabase/supabase-js';
import {
  db, supabase, type DayItemRecord, type ItemRecord, type SyncQueueEntry,
  syncDayItemToSupabase, loadDayStateFromSupabase, mergeDayItemsWithLWW,
  processSyncQueue, atomicIncrementUseCount, syncCategoryToSupabase,
  initializeDefaultItems,
} from './db';

import { getTodayKey } from './categories';

export interface DayStateData {
  checked: Record<string, boolean>;
  postponed: Record<string, boolean>;
  inToday: Record<string, boolean>;
}

function getTodayItems(): DayStateData {
  return { checked: {}, postponed: {}, inToday: {} };
}

export function useDayState() {
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<DayStateData>(getTodayItems());
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [dayChanged, setDayChanged] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const todayKey = getTodayKey();

  // ─── Supabase Auth listener ─────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        setState(getTodayItems());
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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

  const loginWithMagicLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + '/mercado-hoje-pwa/',
      },
    });
    if (error) throw error;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    await db.items.clear();
    await db.dayItems.clear();
    await db.syncQueue.clear();
    setUser(null);
    setState(getTodayItems());
  }, []);

  const processPendingQueue = useCallback(async () => {
    if (!user) return;
    const entries = await db.syncQueue.toCollection().sortBy('timestamp');
    if (entries.length === 0) return;

    setSyncStatus('syncing');
    const successIds = await processSyncQueue(user.id, entries);

    if (successIds.length > 0) {
      for (const id of successIds) {
        await db.syncQueue.delete(id);
      }
    }

    if (successIds.length === entries.length) {
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } else {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  }, [user]);

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
    if (isOnline && user) {
      processPendingQueue();
    }
  }, [isOnline, user, processPendingQueue]);

  // ─── Load day state with LWW merge + carry over postponed ──────
  useEffect(() => {
    if (!user) return;

    if (dayChanged) {
      setState(getTodayItems());
      setLoading(false);
      return;
    }

    async function load() {
      try {
        setLoading(true);
        // Load from local DB first
        let localItems = await db.dayItems.where('dayKey').equals(todayKey).toArray();

        // ─── Day Transition: Carry over postponed items ───
        // If today has no items yet, check if there are postponed items from the last active day
        if (localItems.length === 0) {
          const lastItem = await db.dayItems
            .where('dayKey')
            .below(todayKey)
            .reverse()
            .first();

          if (lastItem) {
            const lastDayItems = await db.dayItems
              .where('dayKey')
              .equals(lastItem.dayKey)
              .toArray();

            const postponed = lastDayItems.filter(item => item.postponed && item.userId === user!.id);
            if (postponed.length > 0) {
              const now = Date.now();
              const carriedOver = postponed.map(item => ({
                dayKey: todayKey,
                itemId: item.itemId,
                checked: false,
                postponed: false,
                inToday: true,
                updatedAt: now,
                userId: user!.id,
              }));

              // Save carried over items to local DB
              await db.dayItems.bulkAdd(carriedOver);

              // Push the added items to the local sync queue so they propagate online
              for (const item of carriedOver) {
                await db.syncQueue.add({
                  type: 'unpostpone',
                  dayKey: todayKey,
                  itemId: item.itemId,
                  timestamp: now,
                });
              }

              // Update localItems to match
              localItems.push(...carriedOver);
            }
          }
        }

        const checked: Record<string, boolean> = {};
        const postponed: Record<string, boolean> = {};
        const inToday: Record<string, boolean> = {};

        // Parse local items to state
        localItems.forEach(item => {
          if (item.userId === user!.id) {
            if (item.checked) checked[item.itemId] = true;
            if (item.postponed) postponed[item.itemId] = true;
            if (item.inToday) inToday[item.itemId] = true;
          }
        });
        setState({ checked, postponed, inToday });

        if (isOnline) {
          try {
            const remoteItems = await loadDayStateFromSupabase(todayKey, user!.id);
            if (remoteItems) {
              const merged = mergeDayItemsWithLWW(localItems, remoteItems);
              
              // Filter and save merged to local DB
              const userMerged = merged.filter(item => item.userId === user!.id);
              await db.dayItems.bulkPut(userMerged);

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
            setSyncStatus('error');
            setTimeout(() => setSyncStatus('idle'), 3000);
          }
        }
      } catch (err) {
        console.error('Failed to load day state:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [todayKey, dayChanged, isOnline, user]);

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

  const addToSyncQueueLocal = useCallback(async (entry: Omit<SyncQueueEntry, 'id' | 'attemptCount'>) => {
    await db.syncQueue.add({
      ...entry,
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

    if (newState.checked[itemId]) {
      delete newState.checked[itemId];
    } else {
      newState.checked[itemId] = true;
      newState.inToday[itemId] = false;

      // Update local & remote catalog counts
      const updatedCount = (itemRecord?.useCount || 0) + 1;
      const updatedTime = Date.now();
      await db.items.update(itemId, {
        useCount: updatedCount,
        lastUsed: updatedTime,
      });

      if (isOnline) {
        atomicIncrementUseCount(itemId, user.id, 1).catch(() => {});
      }
    }

    setState(newState);

    // Save individual day item state
    await saveSingleItemState(itemId, {
      checked: !!newState.checked[itemId],
      postponed: !!newState.postponed[itemId],
      inToday: !!newState.inToday[itemId],
    });

    await addToSyncQueueLocal({
      type: willBeChecked ? 'mark' : 'unmark',
      dayKey: todayKey,
      itemId,
      timestamp: Date.now(),
    });

    if (willBeChecked && 'vibrate' in navigator) {
      navigator.vibrate(30);
    }

    return willBeChecked;
  }, [state, saveSingleItemState, addToSyncQueueLocal, todayKey, isOnline, user]);

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

  const resetAll = useCallback(async () => {
    if (!user) return;
    const newState = { checked: {}, postponed: {}, inToday: {} };
    setState(newState);

    // Delete day items from local DB for this day
    await db.dayItems.where('dayKey').equals(todayKey).and(x => x.userId === user.id).delete();

    if (isOnline) {
      try {
        await supabase
          .from('mh_day_items')
          .delete()
          .eq('day_key', todayKey)
          .eq('user_id', user.id);
      } catch {
        // Ignored, sync queue will run
      }
    }

    await addToSyncQueueLocal({
      type: 'reset',
      dayKey: todayKey,
      timestamp: Date.now(),
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
      timestamp: Date.now(),
    });
  }, [state, saveSingleItemState, addToSyncQueueLocal, todayKey, user]);

  return {
    user,
    loginWithMagicLink,
    logout,
    state,
    loading,
    syncStatus,
    isOnline,
    toggleItem,
    postponeItem,
    unpostponeItem,
    resetAll,
    addItemToToday,
    syncCategory,
    processSyncQueue: processPendingQueue,
  };
}

export function useItems() {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth changes listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        setItems([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadItems = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      // Initialize defaults if catalog is empty
      await initializeDefaultItems(user.id);

      const allItems = await db.items.where('userId').equals(user.id).toArray();
      allItems.sort((a, b) => (b.useCount || 0) - (a.useCount || 0));
      setItems(allItems);

      if (navigator.onLine) {
        try {
          const { data: remoteItems, error } = await supabase
            .from('mh_items')
            .select('*')
            .eq('user_id', user.id)
            .order('use_count', { ascending: false });

          if (!error && remoteItems && remoteItems.length > 0) {
            const updatedItems = [...allItems];
            for (const item of remoteItems) {
              const localItemIdx = updatedItems.findIndex(i => i.id === item.id);
              if (localItemIdx === -1) {
                // Not found locally: insert
                updatedItems.push({
                  id: item.id as string,
                  name: item.name as string,
                  category: item.category as string,
                  emoji: item.emoji as string | undefined,
                  qty: Number(item.qty) || 1,
                  useCount: Number(item.use_count) || 0,
                  lastUsed: Number(item.last_used) || undefined,
                  userId: item.user_id as string,
                });
              } else {
                const localItem = updatedItems[localItemIdx];
                const remoteLastUsed = Number(item.last_used) || 0;
                const localLastUsed = localItem.lastUsed || 0;

                if (remoteLastUsed > localLastUsed) {
                  // Remote has a newer update: update ALL fields
                  updatedItems[localItemIdx] = {
                    id: item.id as string,
                    name: item.name as string,
                    category: item.category as string,
                    emoji: item.emoji as string | undefined,
                    qty: Number(item.qty) || 1,
                    useCount: Number(item.use_count) || 0,
                    lastUsed: remoteLastUsed || undefined,
                    userId: item.user_id as string,
                  };
                }
              }
            }

            // Sync merged list back to Dexie
            await db.items.bulkPut(updatedItems);
            updatedItems.sort((a, b) => (b.useCount || 0) - (a.useCount || 0));
            setItems(updatedItems);
          }
        } catch {
          // Ignored: keep local
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadItems();
    }
  }, [user, loadItems]);

  const addItem = useCallback(async (name: string, category: string, emoji?: string, qty?: number): Promise<string> => {
    if (!user) throw new Error('User not logged in');

    // Check if item already exists locally by name (case-insensitive)
    const existing = await db.items
      .where('name')
      .equals(name)
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

      if (navigator.onLine) {
        await supabase
          .from('mh_items')
          .update({
            category,
            emoji,
            use_count: updatedCount,
            last_used: updatedTime,
          })
          .eq('id', existing.id);
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

    // Add local
    await db.items.add(newItem);

    // Sync remote
    if (navigator.onLine) {
      try {
        await supabase
          .from('mh_items')
          .insert({
            id: newItem.id,
            name: newItem.name,
            category: newItem.category,
            emoji: newItem.emoji || null,
            qty: newItem.qty || 1,
            use_count: newItem.useCount,
            last_used: newItem.lastUsed,
            user_id: user.id,
          });
      } catch {
        // Will be retried on catalog sync
      }
    }

    await loadItems();
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
