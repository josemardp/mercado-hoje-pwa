import Dexie, { type Table } from 'dexie';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ─── Supabase config ───────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables. Define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

// Configured client using standard anon key
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Interfaces ────────────────────────────────────────────────────
export interface ItemRecord {
  id: string; // UUID v4
  name: string;
  category: string;
  emoji?: string;
  qty?: number;
  lastUsed?: number;
  useCount: number;
  userId: string;
}

export interface DayItemRecord {
  dayKey: string; // "YYYY-MM-DD"
  itemId: string; // UUID v4
  checked: boolean;
  postponed: boolean;
  inToday: boolean;
  updatedAt: number; // timestamp for LWW merge
  userId: string;
}

export interface SyncQueueEntry {
  id?: number;
  type: 'mark' | 'unmark' | 'postpone' | 'unpostpone' | 'add' | 'remove' | 'reset' | 'category';
  dayKey: string;
  itemId?: string; // UUID v4
  itemName?: string;
  category?: string;
  qty?: number;
  emoji?: string;
  useCount?: number;
  lastUsed?: number;
  timestamp: number;
  attemptCount?: number;
}

// ─── Dexie local DB ────────────────────────────────────────────────
class MercadoDatabase extends Dexie {
  items!: Table<ItemRecord, string>;
  dayItems!: Table<DayItemRecord, [string, string]>; // compound key [dayKey, itemId]
  syncQueue!: Table<SyncQueueEntry, number>;

  constructor() {
    super('MercadoHoje');
    this.version(2).stores({
      items: 'id, name, category, lastUsed, useCount, userId',
      dayItems: '[dayKey+itemId], dayKey, itemId, checked, postponed, inToday, updatedAt, userId',
      syncQueue: '++id, type, dayKey, timestamp',
    });
  }
}

export const db = new MercadoDatabase();

// ─── Default items ─────────────────────────────────────────────────
const DEFAULT_ITEMS: { id: string; name: string; category: string; emoji: string; qty: number; useCount: number }[] = [
  { id: '7b539a2f-9150-4822-b5df-1e8dc3a73c1d', name: 'Goiaba', category: 'frutas', emoji: '🍈', qty: 1, useCount: 0 },
  { id: 'a1c87641-a3f2-45e0-b6ab-d124b893f412', name: 'Morango', category: 'frutas', emoji: '🍓', qty: 1, useCount: 0 },
  { id: 'df4a1ef1-9556-4cf3-a7bb-20bb949a2123', name: 'Banana', category: 'frutas', emoji: '🍌', qty: 1, useCount: 0 },
  { id: '2bdf1723-5e16-4dfb-90f7-ebf81643c7b2', name: 'Energético', category: 'bebidas', emoji: '⚡', qty: 1, useCount: 0 },
  { id: 'c9cf3a56-896e-4731-bc6a-a82f1b4028ac', name: 'Pepsi black', category: 'bebidas', emoji: '🥤', qty: 1, useCount: 0 },
  { id: '92b4a112-9c12-4fb0-a7d1-e63bd28b9d0b', name: 'Coca zero', category: 'bebidas', emoji: '🥤', qty: 1, useCount: 0 },
  { id: '3a1df7a2-f8c6-4b90-9ce0-4813cd2f5a89', name: 'Ovos', category: 'mercearia', emoji: '🥚', qty: 1, useCount: 0 },
  { id: '6fa23ab1-52e1-4560-bf82-7d1bb39ac98d', name: 'Linguiça', category: 'mercearia', emoji: '🌭', qty: 1, useCount: 0 },
  { id: 'bc92a83f-4e6f-45a7-96a2-bc9cde47bb1e', name: 'Óleo', category: 'mercearia', emoji: '🫙', qty: 2, useCount: 0 },
  { id: '8fbcf2ab-d456-4ec9-8d12-eb7dfb9c02ab', name: 'Salada', category: 'mercearia', emoji: '🥗', qty: 1, useCount: 0 },
  { id: 'd19acde2-98ab-4ec7-9bc1-dcfa8b9d034a', name: 'Queijo ralado', category: 'mercearia', emoji: '🧀', qty: 1, useCount: 0 },
  { id: 'ecbd3fa5-c67d-41a2-9bc2-3cdfa789dc12', name: 'Cenoura', category: 'mercearia', emoji: '🥕', qty: 1, useCount: 0 },
  { id: '98cfbad1-a2ef-467d-93cb-b9cd7c8f90ab', name: 'Cebola', category: 'mercearia', emoji: '🧅', qty: 1, useCount: 0 },
  { id: '12cf9a3e-4fb6-45bc-8bd1-abdf8e9c01bc', name: 'Farofa', category: 'mercearia', emoji: '🌾', qty: 1, useCount: 0 },
  { id: 'bcfdc8a9-45bc-4da8-96ab-cdef90ab12cd', name: 'Calabresa', category: 'mercearia', emoji: '🍖', qty: 1, useCount: 0 },
  { id: 'f89acde1-bcde-4abc-8def-90abcdef1234', name: 'Sabonete líquido', category: 'casa', emoji: '🧴', qty: 1, useCount: 0 },
  { id: '098a7bc6-789a-43cd-af12-3456789abcde', name: 'Papel higiênico', category: 'casa', emoji: '🧻', qty: 1, useCount: 0 },
  { id: '12345678-abcd-4ef1-a345-67890abcdef1', name: 'Chinelo', category: 'outros', emoji: '🩴', qty: 1, useCount: 0 },
];

// ─── Initialization ────────────────────────────────────────────────
export async function initializeDefaultItems(userId: string) {
  const count = await db.items.where('userId').equals(userId).count();
  if (count === 0) {
    try {
      const { data: remoteItems, error } = await supabase
        .from('mh_items')
        .select('*')
        .eq('user_id', userId)
        .order('use_count', { ascending: false });

      if (!error && remoteItems && remoteItems.length > 0) {
        const localItems = remoteItems.map((item: Record<string, any>): ItemRecord => ({
          id: item.id as string,
          name: item.name as string,
          category: item.category as string,
          emoji: item.emoji as string | undefined,
          qty: Number(item.qty) || 1,
          useCount: Number(item.use_count) || 0,
          lastUsed: Number(item.last_used) || undefined,
          userId: item.user_id as string,
        }));
        await db.items.bulkAdd(localItems);
        return;
      }
    } catch {
      // Offline or network error: fall back to local seed
    }

    // Prepare default items with current userId
    const localDefaults: ItemRecord[] = DEFAULT_ITEMS.map(item => ({
      ...item,
      userId,
    }));

    // Seed local IndexedDB
    await db.items.bulkAdd(localDefaults);

    // Seed Supabase if online
    try {
      await supabase
        .from('mh_items')
        .upsert(
          localDefaults.map(item => ({
            id: item.id,
            name: item.name,
            category: item.category,
            emoji: item.emoji,
            qty: item.qty,
            use_count: item.useCount,
            last_used: item.lastUsed || null,
            user_id: userId,
          })),
          { onConflict: 'id' }
        );
    } catch {
      // Ignored: sync queue will catch up later or next catalog sync
    }
  }
}

// ─── LWW Merge ──────────────────────────────────────

/**
 * Load day items from Supabase for a specific user and day.
 */
export async function loadDayStateFromSupabase(dayKey: string, userId: string): Promise<DayItemRecord[] | null> {
  try {
    const { data, error } = await supabase
      .from('mh_day_items')
      .select('*')
      .eq('day_key', dayKey)
      .eq('user_id', userId);

    if (error || !data) return null;

    return data.map((item: Record<string, any>): DayItemRecord => ({
      dayKey: item.day_key as string,
      itemId: item.item_id as string,
      checked: !!item.checked,
      postponed: !!item.postponed,
      inToday: !!item.in_today,
      updatedAt: new Date(item.updated_at).getTime(),
      userId: item.user_id as string,
    }));
  } catch {
    return null;
  }
}

/**
 * Merge local and remote day item arrays using Last-Write-Wins (LWW)
 */
export function mergeDayItemsWithLWW(
  localItems: DayItemRecord[],
  remoteItems: DayItemRecord[],
): DayItemRecord[] {
  const merged = new Map<string, DayItemRecord>();

  for (const item of localItems) {
    merged.set(item.itemId, item);
  }

  for (const remoteItem of remoteItems) {
    const localItem = merged.get(remoteItem.itemId);
    if (!localItem) {
      merged.set(remoteItem.itemId, remoteItem);
    } else {
      const remoteTs = remoteItem.updatedAt || 0;
      const localTs = localItem.updatedAt || 0;
      if (remoteTs > localTs) {
        merged.set(remoteItem.itemId, remoteItem);
      }
    }
  }

  return Array.from(merged.values());
}

/**
 * Sync a single day item record to Supabase
 */
export async function syncDayItemToSupabase(item: DayItemRecord): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('mh_day_items')
      .upsert({
        day_key: item.dayKey,
        item_id: item.itemId,
        checked: item.checked,
        postponed: item.postponed,
        in_today: item.inToday,
        updated_at: new Date(item.updatedAt).toISOString(),
        user_id: item.userId,
      }, { onConflict: 'user_id,day_key,item_id' });

    return !error;
  } catch {
    return false;
  }
}

/**
 * Process local offline sync queue.
 * Returns only the list of successfully synchronized queue entry IDs.
 */
export async function processSyncQueue(
  userId: string,
  entries: SyncQueueEntry[],
): Promise<number[]> {
  const successIds: number[] = [];

  for (const entry of entries) {
    try {
      switch (entry.type) {
        case 'add': {
          if (entry.itemId && entry.itemName && entry.category) {
            // Upsert catalog item
            const { error: itemErr } = await supabase
              .from('mh_items')
              .upsert({
                id: entry.itemId,
                name: entry.itemName,
                category: entry.category,
                emoji: entry.emoji || null,
                qty: entry.qty || 1,
                use_count: entry.useCount || 0,
                last_used: entry.lastUsed || null,
                updated_at: new Date(entry.lastUsed || entry.timestamp).toISOString(),
                user_id: userId,
              }, { onConflict: 'id' });
            if (itemErr) throw new Error(itemErr.message);

            // Upsert day item state
            const localDayItem = await db.dayItems.get([entry.dayKey, entry.itemId]);
            if (localDayItem) {
              const ok = await syncDayItemToSupabase(localDayItem);
              if (!ok) throw new Error('Failed to sync day item');
            }
          }
          successIds.push(entry.id!);
          break;
        }

        case 'mark':
        case 'unmark':
        case 'postpone':
        case 'unpostpone': {
          if (entry.itemId) {
            const localDayItem = await db.dayItems.get([entry.dayKey, entry.itemId]);
            if (localDayItem) {
              const ok = await syncDayItemToSupabase(localDayItem);
              if (!ok) throw new Error('Failed to sync day item state');
            }

            if (entry.type === 'mark' && entry.useCount != null) {
              const { error: itemErr } = await supabase
                .from('mh_items')
                .update({
                  use_count: entry.useCount,
                  last_used: entry.lastUsed || null,
                  updated_at: new Date(entry.lastUsed || entry.timestamp).toISOString(),
                })
                .eq('id', entry.itemId)
                .eq('user_id', userId);
              if (itemErr) throw new Error(itemErr.message);
            }
          }
          successIds.push(entry.id!);
          break;
        }

        case 'reset': {
          const { error } = await supabase
            .from('mh_day_items')
            .delete()
            .eq('day_key', entry.dayKey)
            .eq('user_id', userId);
          if (error) throw new Error(error.message);
          successIds.push(entry.id!);
          break;
        }

        case 'category': {
          if (entry.itemId && entry.category) {
            const { error } = await supabase
              .from('mh_items')
              .update({ category: entry.category })
              .eq('id', entry.itemId)
              .eq('user_id', userId);
            if (error) throw new Error(error.message);
          }
          successIds.push(entry.id!);
          break;
        }
      }
    } catch (err) {
      console.error('Failed to process sync queue entry:', entry, err);
    }
  }

  return successIds;
}

/**
 * Sync entire catalog local items to Supabase
 */
export async function syncItemsToSupabase(items: ItemRecord[]) {
  try {
    const records = items.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      emoji: item.emoji || null,
      qty: item.qty || 1,
      use_count: item.useCount || 0,
      last_used: item.lastUsed || null,
      user_id: item.userId,
    }));

    const { error } = await supabase
      .from('mh_items')
      .upsert(records, { onConflict: 'id' });

    return !error;
  } catch {
    return false;
  }
}

/**
 * Sync a single item's category change to Supabase.
 */
export async function syncCategoryToSupabase(itemId: string, userId: string, newCategory: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('mh_items')
      .update({ category: newCategory, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .eq('user_id', userId);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Atomic increment for use_count via Supabase RPC.
 */
export async function atomicIncrementUseCount(itemId: string, userId: string, increment: number = 1): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('increment_use_count', {
      p_item_id: itemId,
      p_increment: increment,
    });
    if (!error) return true;

    // Fallback: read-then-write
    const { data, error: readErr } = await supabase
      .from('mh_items')
      .select('use_count')
      .eq('id', itemId)
      .eq('user_id', userId)
      .single();
    if (readErr || !data) return false;

    await supabase
      .from('mh_items')
      .update({
        use_count: (data.use_count || 0) + increment,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('user_id', userId);

    return true;
  } catch {
    return false;
  }
}
