import Dexie, { type Table } from 'dexie';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { logSyncFailure } from './logger';

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
  qty?: number; // per-day quantity override (default 1 = use catalog qty)
  updatedAt: number; // timestamp for LWW merge
  userId: string;
}

export interface SyncQueueEntry {
  id?: number;
  type: 'mark' | 'unmark' | 'postpone' | 'unpostpone' | 'add' | 'reset' | 'category' | 'incrementUse' | 'updateQty';
  dayKey: string;
  itemId?: string; // UUID v4
  itemName?: string;
  category?: string;
  qty?: number;
  emoji?: string;
  useCount?: number;
  lastUsed?: number;
  increment?: number; // 'incrementUse' only — amount to add atomically
  operationId?: string; // 'incrementUse' only — stable across retries, for idempotency (AUD-003)
  // AUD-009: which account queued this entry. Optional because entries
  // written before this field existed have none — treated as "belongs to
  // whoever is currently logged in" (see processPendingQueue), not filtered
  // out, so nothing already pending gets silently stranded by this change.
  userId?: string;
  timestamp: number;
  attemptCount?: number;
}

// Entries that fail this many times stop being retried automatically and
// are surfaced in the UI instead of failing silently forever.
export const MAX_SYNC_ATTEMPTS = 5;

// ─── Rotina tab records ─────────────────────────────────────────────
// Kept structurally separate from ItemRecord/DayItemRecord/SyncQueueEntry:
// Rotina has no growable catalog (steps are fixed in rotinaSteps.ts) and no
// postponed/carry-over concept, so reusing the grocery shapes would just
// carry a bunch of always-null fields. See rotinaDb.ts for the sync logic.
export interface RotinaStepStateRecord {
  dayKey: string; // "YYYY-MM-DD", same format as getTodayKey()
  stepId: string; // stable slug from rotinaSteps.ts — never renamed once shipped
  done: boolean;
  updatedAt: number; // timestamp for LWW merge
  userId: string;
}

export interface RotinaSyncQueueEntry {
  id?: number;
  type: 'complete' | 'uncomplete' | 'reset';
  dayKey: string;
  stepId?: string;
  updatedAt?: number;
  // AUD-009 — see SyncQueueEntry.userId above for why this is optional.
  userId?: string;
  timestamp: number;
  attemptCount?: number;
}

// ─── Agenda mode records ────────────────────────────────────────────
// Unlike grocery items (growable named catalog) or rotina steps (fixed
// slugs), an agenda task is a single self-contained per-day row. Deletion is
// modeled as just another field (`deleted`) synced through the same
// conditional "newer wins" RPC as every other edit, instead of a real row
// delete — so a delete can never race-resurrect a newer edit (or vice
// versa) without extra cutoff-timestamp machinery. See agendaDb.ts.
export interface AgendaTaskRecord {
  id: string; // uuid v4
  dayKey: string; // "YYYY-MM-DD" — agenda tasks never carry over to the next day
  title: string;
  estimatedMinutes: number; // baseline — only changed by the estimator or an explicit user edit, never by the scheduler
  fixed: boolean; // true = immovable commitment (appointment/meeting), duration never compressed
  fixedStart?: string; // "HH:MM" — only set when the exact clock time is known
  order: number; // insertion order — the placement order the scheduler uses
  scheduledStart?: string; // "HH:MM", written by generateSchedule()
  scheduledEnd?: string; // "HH:MM", written by generateSchedule()
  done: boolean;
  deleted: boolean; // soft-delete tombstone
  updatedAt: number;
  userId: string;
}

export interface AgendaSyncQueueEntry {
  id?: number;
  type: 'upsert'; // a single type is enough — every mutation just re-reads and pushes the whole row
  taskId: string;
  // AUD-009 — see SyncQueueEntry.userId above for why this is optional.
  userId?: string;
  timestamp: number;
  attemptCount?: number;
}

// ─── Reset cutoffs (AUD-001) ────────────────────────────────────────
// Compras and Rotina delete rows on reset instead of soft-deleting them
// (unlike Agenda's `deleted` tombstone), so a device that was offline during
// the reset has no per-row marker telling it "this is gone on purpose, not
// just never-synced". This cutoff is that marker at the day+domain level:
// any write older than it is rejected server-side (see
// 20260801_add_reset_cutoffs.sql) and filtered out of the local merge,
// regardless of whether a conflicting remote row still exists to compare against.
export type ResetDomain = 'compras' | 'rotina';

export interface ResetCutoffRecord {
  userId: string;
  dayKey: string;
  domain: ResetDomain;
  cutoffAt: number;
}

// ─── Dexie local DB ────────────────────────────────────────────────
class MercadoDatabase extends Dexie {
  items!: Table<ItemRecord, string>;
  dayItems!: Table<DayItemRecord, [string, string]>; // compound key [dayKey, itemId]
  syncQueue!: Table<SyncQueueEntry, number>;
  rotinaStepStateByUser!: Table<RotinaStepStateRecord, [string, string, string]>; // compound key [dayKey, stepId, userId]
  rotinaSyncQueue!: Table<RotinaSyncQueueEntry, number>;
  agendaTasks!: Table<AgendaTaskRecord, string>;
  agendaSyncQueue!: Table<AgendaSyncQueueEntry, number>;
  resetCutoffs!: Table<ResetCutoffRecord, [string, string, string]>; // compound key [userId+dayKey+domain]

  constructor() {
    super('MercadoHoje');
    this.version(2).stores({
      items: 'id, name, category, lastUsed, useCount, userId',
      dayItems: '[dayKey+itemId], dayKey, itemId, checked, postponed, inToday, updatedAt, userId',
      syncQueue: '++id, type, dayKey, timestamp',
    });
    this.version(3).stores({
      rotinaStepState: '[dayKey+stepId], dayKey, stepId, done, updatedAt, userId',
      rotinaSyncQueue: '++id, type, dayKey, timestamp',
    });
    this.version(4).stores({
      agendaTasks: 'id, dayKey, userId, order, done, deleted, updatedAt',
      agendaSyncQueue: '++id, type, taskId, timestamp',
    });
    this.version(5).stores({
      resetCutoffs: '[userId+dayKey+domain]',
    });
    // S2-07 (AUD-009): rotinaStepState's old key [dayKey+stepId] had no
    // userId, so two accounts on the same browser collided on the same row
    // for the same day+step (step slugs are fixed/shared across every
    // account). userId also added to every sync queue, for the same reason.
    //
    // IMPORTANT: IndexedDB (and therefore Dexie) does not support changing
    // an existing store's primary key in place — a version that tries
    // throws "UpgradeError: Not yet support for changing primary key" and
    // permanently breaks the local database for anyone who already had an
    // earlier version installed (this shipped broken once; see D-015).
    // The fix: leave the old rotinaStepState store's key untouched, add a
    // NEW store with the new key, copy the data across, then drop the old
    // store in a LATER version once the copy is safely done.
    this.version(6).stores({
      syncQueue: '++id, type, dayKey, timestamp, userId',
      rotinaStepStateByUser: '[dayKey+stepId+userId], dayKey, stepId, done, updatedAt, userId',
      rotinaSyncQueue: '++id, type, dayKey, timestamp, userId',
      agendaSyncQueue: '++id, type, taskId, timestamp, userId',
    }).upgrade(async tx => {
      const rows = await tx.table('rotinaStepState').toArray();
      await tx.table('rotinaStepStateByUser').bulkAdd(rows);
    });
    this.version(7).stores({
      rotinaStepState: null, // drop the old store now that its data lives in rotinaStepStateByUser
    });
    // S3-08: add `qty` to dayItems for per-day quantity overrides.
    // The column is optional in the interface (defaults to 1 at read time)
    // so the schema version bump is non-breaking — existing rows without
    // qty will return undefined, treated as 1 by the callers.
    this.version(8).stores({
      dayItems: '[dayKey+itemId], dayKey, itemId, checked, postponed, inToday, qty, updatedAt, userId',
    });
  }
}

export const db = new MercadoDatabase();

// ─── Default items ─────────────────────────────────────────────────
// No `id` here on purpose: initializeDefaultItems() generates a fresh
// crypto.randomUUID() per item at seed time. These used to be hardcoded
// shared UUIDs, which meant any two accounts that both seeded defaults
// ended up with rows sharing the same primary key — the second account's
// upsert then hit RLS's USING clause on the first account's row (a real
// row it doesn't own) and failed with 403.
const DEFAULT_ITEMS: { name: string; category: string; emoji: string; qty: number; useCount: number }[] = [
  { name: 'Goiaba', category: 'frutas', emoji: '🍈', qty: 2, useCount: 0 },
  { name: 'Morango', category: 'frutas', emoji: '🍓', qty: 1, useCount: 0 },
  { name: 'Banana', category: 'frutas', emoji: '🍌', qty: 1, useCount: 0 },
  { name: 'Energético', category: 'bebidas', emoji: '⚡', qty: 1, useCount: 0 },
  { name: 'Pepsi black', category: 'bebidas', emoji: '🥤', qty: 1, useCount: 0 },
  { name: 'Coca zero', category: 'bebidas', emoji: '🥤', qty: 1, useCount: 0 },
  { name: 'Ovos', category: 'mercearia', emoji: '🥚', qty: 1, useCount: 0 },
  { name: 'Linguiça', category: 'mercearia', emoji: '🌭', qty: 1, useCount: 0 },
  { name: 'Óleo', category: 'mercearia', emoji: '🫙', qty: 2, useCount: 0 },
  { name: 'Salada', category: 'mercearia', emoji: '🥗', qty: 1, useCount: 0 },
  { name: 'Queijo ralado', category: 'mercearia', emoji: '🧀', qty: 1, useCount: 0 },
  { name: 'Cenoura', category: 'mercearia', emoji: '🥕', qty: 1, useCount: 0 },
  { name: 'Cebola', category: 'mercearia', emoji: '🧅', qty: 1, useCount: 0 },
  { name: 'Farofa', category: 'mercearia', emoji: '🌾', qty: 1, useCount: 0 },
  { name: 'Calabresa', category: 'mercearia', emoji: '🍖', qty: 1, useCount: 0 },
  { name: 'Sabonete líquido', category: 'casa', emoji: '🧴', qty: 1, useCount: 0 },
  { name: 'Papel higiênico', category: 'casa', emoji: '🧻', qty: 1, useCount: 0 },
  { name: 'Chinelo', category: 'outros', emoji: '🩴', qty: 1, useCount: 0 },
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
        const localItems = remoteItems.map((item: Record<string, unknown>): ItemRecord => ({
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

    // Prepare default items with current userId and a fresh id each — never
    // reuse a fixed id across accounts (see DEFAULT_ITEMS comment above).
    const localDefaults: ItemRecord[] = DEFAULT_ITEMS.map(item => ({
      ...item,
      id: crypto.randomUUID(),
      userId,
    }));

    // Seed local IndexedDB
    await db.items.bulkAdd(localDefaults);

    // Seed Supabase if online. If this fails, the local catalog is no
    // longer empty, so this function won't run again — queue each default
    // so the normal sync queue (which does check errors) retries them,
    // instead of silently never pushing the seed to the remote catalog.
    try {
      const { error } = await supabase
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
      if (error) throw new Error(error.message);
    } catch {
      const now = Date.now();
      await db.syncQueue.bulkAdd(localDefaults.map(item => ({
        type: 'add' as const,
        dayKey: '',
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        qty: item.qty,
        emoji: item.emoji,
        useCount: item.useCount,
        lastUsed: item.lastUsed || now,
        timestamp: now,
        attemptCount: 0,
      })));
      // This runs from useItems, which has no reference to useDayState's
      // processPendingQueue — without this, these entries would just sit
      // until the next unrelated trigger (online event, reload, etc).
      window.dispatchEvent(new Event('mh:queue-updated'));
    }
  }
}

// ─── Reset cutoffs (AUD-001) ────────────────────────────────────────

/**
 * Read the locally cached reset cutoff for a domain/day, if any.
 * Used so filtering still works offline, without a round-trip.
 */
export async function getLocalResetCutoff(userId: string, dayKey: string, domain: ResetDomain): Promise<number | undefined> {
  const rec = await db.resetCutoffs.get([userId, dayKey, domain]);
  return rec?.cutoffAt;
}

/**
 * Store a reset cutoff locally. Never moves it backwards — a stale fetch
 * (e.g. a late response racing a newer one) must not reopen a window that
 * was already closed.
 */
export async function setLocalResetCutoff(userId: string, dayKey: string, domain: ResetDomain, cutoffAt: number): Promise<void> {
  const existing = await db.resetCutoffs.get([userId, dayKey, domain]);
  if (existing && existing.cutoffAt >= cutoffAt) return;
  await db.resetCutoffs.put({ userId, dayKey, domain, cutoffAt });
}

/**
 * Fetch the authoritative cutoff from the server and cache it locally.
 * Falls back to whatever is cached locally if offline/unreachable, so a
 * previously-known cutoff still applies even without a live round-trip.
 */
export async function fetchAndStoreResetCutoff(userId: string, dayKey: string, domain: ResetDomain): Promise<number | undefined> {
  try {
    const { data, error } = await supabase.rpc('get_reset_cutoff', { p_day_key: dayKey, p_domain: domain });
    if (error || !data) return getLocalResetCutoff(userId, dayKey, domain);
    const cutoffAt = new Date(data as string).getTime();
    await setLocalResetCutoff(userId, dayKey, domain, cutoffAt);
    return cutoffAt;
  } catch {
    return getLocalResetCutoff(userId, dayKey, domain);
  }
}

/**
 * Reset a domain for a day: asks the server to register/advance the cutoff
 * and delete the now-stale rows atomically, using the SERVER's clock
 * (clock_timestamp()) as the cutoff boundary rather than this device's own
 * — a device with a skewed-forward clock can no longer stretch out how long
 * its pre-reset writes stay valid. Throws on failure so callers can fall
 * back to a local-only cutoff + queued retry (see resetAll/resetToday).
 */
export async function resetDayDomain(userId: string, dayKey: string, domain: ResetDomain): Promise<number> {
  const { data, error } = await supabase.rpc('reset_day_domain', { p_day_key: dayKey, p_domain: domain });
  if (error || !data) throw new Error(error?.message || 'reset_day_domain failed');
  const cutoffAt = new Date(data as string).getTime();
  await setLocalResetCutoff(userId, dayKey, domain, cutoffAt);
  return cutoffAt;
}

// ─── LWW Merge ──────────────────────────────────────

function mapSupabaseDayItem(item: Record<string, unknown>): DayItemRecord {
  return {
    dayKey: item.day_key as string,
    itemId: item.item_id as string,
    checked: !!item.checked,
    postponed: !!item.postponed,
    inToday: !!item.in_today,
    qty: Number(item.qty) || 1,
    updatedAt: new Date(item.updated_at as string).getTime(),
    userId: item.user_id as string,
  };
}

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

    return data.map(mapSupabaseDayItem);
  } catch {
    return null;
  }
}

/**
 * Recovery path for the "items vanished at day rollover" bug: items left
 * unchecked on an earlier day only ever carry forward via this device's own
 * IndexedDB (see useDayState's load()) — a device that never had those rows
 * locally (a different device, or one that had its storage cleared) can
 * still pull them back from Supabase, since add/mark actions always synced
 * there while the device that made them was online. Deliberately ignores
 * per-day reset cutoffs: an explicit "Limpar lista do dia" already deletes
 * the underlying rows, so nothing here could resurrect them anyway.
 */
export async function loadStaleUnfinishedItemsFromSupabase(userId: string, beforeDayKey: string): Promise<DayItemRecord[] | null> {
  try {
    const { data, error } = await supabase
      .from('mh_day_items')
      .select('*')
      .lt('day_key', beforeDayKey)
      .eq('user_id', userId)
      .eq('checked', false);

    if (error || !data) return null;

    return data.map(mapSupabaseDayItem);
  } catch {
    return null;
  }
}

/**
 * Merge local and remote day item arrays using Last-Write-Wins (LWW).
 *
 * `cutoffAt`, when given (the day's reset cutoff — see resetDayDomain),
 * drops any surviving row older than it. This is what stops a device that
 * was offline during a reset from resurrecting its stale local copy: the
 * remote side already deleted the row, so there's nothing there to compare
 * timestamps against, but the cutoff itself still says "anything from
 * before this moment doesn't count".
 */
export function mergeDayItemsWithLWW(
  localItems: DayItemRecord[],
  remoteItems: DayItemRecord[],
  cutoffAt?: number,
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

  if (cutoffAt != null) {
    for (const [key, item] of merged) {
      if ((item.updatedAt || 0) < cutoffAt) {
        merged.delete(key);
      }
    }
  }

  return Array.from(merged.values());
}

/**
 * Fetch the canonical mh_items row and overwrite the local copy with it.
 * Used when a conditional RPC rejects our write as older than what's
 * already stored, so this device stops showing its own stale state.
 */
async function reconcileLocalItemFromRemote(itemId: string, userId: string): Promise<void> {
  const { data: canonical } = await supabase
    .from('mh_items')
    .select('*')
    .eq('id', itemId)
    .eq('user_id', userId)
    .maybeSingle();

  if (canonical) {
    await db.items.put({
      id: canonical.id as string,
      name: canonical.name as string,
      category: canonical.category as string,
      emoji: canonical.emoji as string | undefined,
      qty: Number(canonical.qty) || 1,
      useCount: Number(canonical.use_count) || 0,
      lastUsed: Number(canonical.last_used) || undefined,
      userId: canonical.user_id as string,
    });
  }
}

/**
 * Sync a single day item record to Supabase.
 * Goes through upsert_day_item_if_newer so a stale write can never
 * overwrite a newer one already stored server-side. If our write is the
 * stale one, pull the canonical row back down so this device converges
 * immediately instead of showing wrong state until the next full reload.
 */
export async function syncDayItemToSupabase(item: DayItemRecord): Promise<boolean> {
  try {
    const { data: applied, error } = await supabase.rpc('upsert_day_item_if_newer', {
      p_day_key: item.dayKey,
      p_item_id: item.itemId,
      p_checked: item.checked,
      p_postponed: item.postponed,
      p_in_today: item.inToday,
      p_qty: item.qty || 1,
      p_updated_at: new Date(item.updatedAt).toISOString(),
      p_user_id: item.userId,
    });

    if (error) return false;

    if (applied === false) {
      const { data: canonical } = await supabase
        .from('mh_day_items')
        .select('*')
        .eq('day_key', item.dayKey)
        .eq('item_id', item.itemId)
        .eq('user_id', item.userId)
        .maybeSingle();

      if (canonical) {
        await db.dayItems.put({
          dayKey: canonical.day_key as string,
          itemId: canonical.item_id as string,
          checked: !!canonical.checked,
          postponed: !!canonical.postponed,
          inToday: !!canonical.in_today,
          qty: Number(canonical.qty) || 1,
          updatedAt: new Date(canonical.updated_at as string).getTime(),
          userId: canonical.user_id as string,
        });
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Remap every local reference from an old (locally-generated) item id to
 * the canonical remote id returned by upsert_item_reconcile_name, after a
 * catalog name collision with another device. Dexie primary keys are
 * immutable, so this is a delete+recreate under the new id, not an update.
 */
export async function remapItemId(oldId: string, newId: string): Promise<void> {
  const localItem = await db.items.get(oldId);
  if (localItem) {
    await db.items.delete(oldId);
    // Adopt the canonical remote row's data rather than force our copy onto
    // it: another device already created this named item first.
    const { data: remoteItem } = await supabase
      .from('mh_items')
      .select('*')
      .eq('id', newId)
      .single();

    await db.items.put(remoteItem
      ? {
          id: remoteItem.id as string,
          name: remoteItem.name as string,
          category: remoteItem.category as string,
          emoji: remoteItem.emoji as string | undefined,
          qty: Number(remoteItem.qty) || 1,
          useCount: Number(remoteItem.use_count) || 0,
          lastUsed: Number(remoteItem.last_used) || undefined,
          userId: remoteItem.user_id as string,
        }
      : { ...localItem, id: newId });
  }

  const staleDayItems = await db.dayItems.where('itemId').equals(oldId).toArray();
  if (staleDayItems.length > 0) {
    // Don't blindly overwrite: the canonical id may already have a local
    // record newer than the one we're remapping (e.g. pulled in by an
    // earlier merge). Compare updatedAt before deciding which one wins.
    for (const stale of staleDayItems) {
      const remapped = { ...stale, itemId: newId };
      const existingCanonical = await db.dayItems.get([stale.dayKey, newId]);
      if (!existingCanonical || existingCanonical.updatedAt < remapped.updatedAt) {
        await db.dayItems.put(remapped);
      }
    }
    await db.dayItems.bulkDelete(staleDayItems.map(d => [d.dayKey, d.itemId] as [string, string]));
  }

  // 'itemId' isn't an indexed field on syncQueue, so .where() can't be used
  // here — .filter() does a full scan, which is fine for a small local queue.
  await db.syncQueue.filter(e => e.itemId === oldId).modify({ itemId: newId });

  // useDayState's React state (checked/postponed/inToday, keyed by item id)
  // lives in a separate hook and isn't refreshed by the Dexie writes above.
  // Without this, the just-remapped item can vanish from every tab until
  // the next full day-state reload (mount/day-change/online toggle).
  window.dispatchEvent(new CustomEvent('mh:item-remapped', { detail: { oldId, newId } }));
}

/**
 * Collapses redundant pending sync-queue entries before processing them
 * (S2-04). Two kinds of entry are safe to compact because each one's real
 * effect is re-derived at processing time, not carried in the entry itself:
 *  - mark/unmark/postpone/unpostpone for the same (dayKey, itemId): only the
 *    latest needs to run — it re-reads and pushes whatever db.dayItems
 *    currently holds, which already reflects every earlier toggle.
 *  - incrementUse for the same itemId: N separate +1s are equivalent to one
 *    +N, so they merge into a single entry (a genuinely new net operation,
 *    not a retry of an old one — the representative keeps its own id/
 *    operationId, nothing is invented).
 * 'add', 'reset' and 'category' entries are never touched — a reset in
 * particular must never be silently dropped or merged away.
 *
 * `idsCoveredBy` maps each surviving representative's id to every original
 * id it stands in for (including itself), so the caller can delete all of
 * them once the representative's operation succeeds — otherwise the
 * collapsed-away duplicates would linger in Dexie forever, never processed
 * and never deleted.
 */
export interface CompactedSyncQueue {
  entries: SyncQueueEntry[];
  idsCoveredBy: Map<number, number[]>;
}

export function compactSyncQueueEntries(entries: SyncQueueEntry[]): CompactedSyncQueue {
  const DAY_ITEM_TYPES = new Set(['mark', 'unmark', 'postpone', 'unpostpone', 'updateQty']);
  const latestByDayItem = new Map<string, SyncQueueEntry>();
  const coveredByDayItem = new Map<string, number[]>();
  const incrementByItem = new Map<string, SyncQueueEntry>();
  const coveredByItem = new Map<string, number[]>();
  const passthrough: SyncQueueEntry[] = [];

  for (const entry of entries) {
    if (entry.id == null) {
      passthrough.push(entry);
      continue;
    }

    if (DAY_ITEM_TYPES.has(entry.type) && entry.itemId) {
      const key = `${entry.dayKey}::${entry.itemId}`;
      const existing = latestByDayItem.get(key);
      if (!existing || entry.timestamp >= existing.timestamp) {
        latestByDayItem.set(key, entry);
      }
      coveredByDayItem.set(key, [...(coveredByDayItem.get(key) || []), entry.id]);
    } else if (entry.type === 'incrementUse' && entry.itemId) {
      const existing = incrementByItem.get(entry.itemId);
      if (!existing) {
        incrementByItem.set(entry.itemId, { ...entry });
      } else {
        existing.increment = (existing.increment || 1) + (entry.increment || 1);
      }
      coveredByItem.set(entry.itemId, [...(coveredByItem.get(entry.itemId) || []), entry.id]);
    } else {
      passthrough.push(entry);
    }
  }

  const idsCoveredBy = new Map<number, number[]>();
  for (const [key, representative] of latestByDayItem) {
    idsCoveredBy.set(representative.id!, coveredByDayItem.get(key) || [representative.id!]);
  }
  for (const [itemId, representative] of incrementByItem) {
    idsCoveredBy.set(representative.id!, coveredByItem.get(itemId) || [representative.id!]);
  }

  const compactedEntries = [...passthrough, ...latestByDayItem.values(), ...incrementByItem.values()]
    .sort((a, b) => a.timestamp - b.timestamp);

  return { entries: compactedEntries, idsCoveredBy };
}

/**
 * Process local offline sync queue.
 * Returns only the list of successfully synchronized queue entry IDs.
 * Entries that fail are left in the queue with attemptCount incremented;
 * once MAX_SYNC_ATTEMPTS is reached they stop being auto-retried (see
 * useStore's processPendingQueue) and are surfaced in the UI instead.
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
            let itemId = entry.itemId;
            const updatedAtIso = new Date(entry.lastUsed || entry.timestamp).toISOString();

            const { data: canonicalId, error: itemErr } = await supabase.rpc('upsert_item_reconcile_name', {
              p_id: entry.itemId,
              p_name: entry.itemName,
              p_category: entry.category,
              p_emoji: entry.emoji || null,
              p_qty: entry.qty || 1,
              p_use_count: entry.useCount || 0,
              p_last_used: entry.lastUsed || null,
              p_updated_at: updatedAtIso,
              p_user_id: userId,
            });
            if (itemErr) throw new Error(itemErr.message);

            if (canonicalId && canonicalId !== entry.itemId) {
              // Another device already created an item with this name.
              // Adopt its id instead of leaving two conflicting rows.
              await remapItemId(entry.itemId, canonicalId as string);
              itemId = canonicalId as string;
            }

            // Upsert day item state under the (possibly remapped) item id
            const localDayItem = await db.dayItems.get([entry.dayKey, itemId]);
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
          }
          successIds.push(entry.id!);
          break;
        }

        case 'incrementUse': {
          // AUD-003: the only place use_count is ever written from a mark —
          // no absolute "set use_count = N" write competes with this atomic
          // increment for the same action anymore.
          if (entry.itemId) {
            const ok = await atomicIncrementUseCount(entry.itemId, userId, entry.increment || 1, entry.operationId);
            if (!ok) throw new Error('Failed to increment use_count');
          }
          successIds.push(entry.id!);
          break;
        }

        case 'reset': {
          // Registers/advances the server-side cutoff (AUD-001) and deletes
          // only rows older than it, atomically — a row created/updated by
          // another device after the reset must survive.
          await resetDayDomain(userId, entry.dayKey, 'compras');
          successIds.push(entry.id!);
          break;
        }

        case 'category': {
          if (entry.itemId && entry.category) {
            const ok = await syncCategoryToSupabase(entry.itemId, userId, entry.category, entry.timestamp);
            if (!ok) throw new Error('Failed to sync category');
          }
          successIds.push(entry.id!);
          break;
        }

        case 'updateQty': {
          // Per-day quantity override — re-read the local row (which already
          // has the new qty) and push it to Supabase.
          if (entry.itemId) {
            const localDayItem = await db.dayItems.get([entry.dayKey, entry.itemId]);
            if (localDayItem) {
              const ok = await syncDayItemToSupabase(localDayItem);
              if (!ok) throw new Error('Failed to sync day item qty');
            }
          }
          successIds.push(entry.id!);
          break;
        }
      }
    } catch (err) {
      logSyncFailure('Failed to process sync queue entry', entry, err);
      if (entry.id != null) {
        await db.syncQueue.update(entry.id, { attemptCount: (entry.attemptCount || 0) + 1 });
      }
    }
  }

  return successIds;
}

/**
 * Sync a single item's category change to Supabase.
 * Goes through update_item_category_if_newer so a stale queued correction
 * can never undo a more recent one made from another device.
 */
export async function syncCategoryToSupabase(itemId: string, userId: string, newCategory: string, updatedAt: number = Date.now()): Promise<boolean> {
  try {
    const { data: applied, error } = await supabase.rpc('update_item_category_if_newer', {
      p_id: itemId,
      p_user_id: userId,
      p_category: newCategory,
      p_updated_at: new Date(updatedAt).toISOString(),
    });

    if (error) return false;
    if (applied === false) {
      await reconcileLocalItemFromRemote(itemId, userId);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Atomic increment for use_count via Supabase RPC.
 * `operationId`, when given, makes the increment idempotent server-side
 * (AUD-003): a client retry after an ambiguous network failure (server
 * applied it, but the response never reached this device) reports success
 * without incrementing a second time.
 */
export async function atomicIncrementUseCount(itemId: string, userId: string, increment: number = 1, operationId?: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('increment_use_count', {
      p_item_id: itemId,
      p_increment: increment,
      p_operation_id: operationId ?? null,
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

    const { error: updateErr } = await supabase
      .from('mh_items')
      .update({
        use_count: (data.use_count || 0) + increment,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('user_id', userId);

    return !updateErr;
  } catch {
    return false;
  }
}
