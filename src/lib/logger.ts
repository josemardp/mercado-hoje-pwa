// S6-05/S6-06 (AUD-019): centralizes what's allowed to reach the console.
// In dev, errors print with full detail for debugging. In production,
// console.error calls survive the build (see vite.config.ts's
// drop_console: false, kept so a user reporting a bug can still screenshot
// something useful) — so anything passed through here in prod is sanitized
// first. Never pass itemName, category, task title, e-mail or tokens.
const isDev = import.meta.env.DEV;

// Only these fields are structural (ids, counters, timestamps) — nothing
// here is what the user typed or bought.
const SYNC_ENTRY_ALLOWLIST = [
  'id', 'type', 'dayKey', 'itemId', 'stepId', 'taskId', 'stepDefId',
  'timestamp', 'attemptCount', 'userId',
] as const;

function redactSyncEntry(entry: unknown): Record<string, unknown> {
  if (!entry || typeof entry !== 'object') return {};
  const source = entry as Record<string, unknown>;
  const safe: Record<string, unknown> = {};
  for (const key of SYNC_ENTRY_ALLOWLIST) {
    if (key in source) safe[key] = source[key];
  }
  return safe;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Generic error logging — never pass raw user input (item names, e-mail) as `context`. */
export function logError(context: string, err: unknown): void {
  if (isDev) {
    console.error(context, err);
  } else {
    console.error(context, errorMessage(err));
  }
}

/** For sync queue processing failures — redacts the entry before it can reach production logs. */
export function logSyncFailure(context: string, entry: unknown, err: unknown): void {
  if (isDev) {
    console.error(context, entry, err);
  } else {
    console.error(context, redactSyncEntry(entry), errorMessage(err));
  }
}

interface QueueHealth {
  domain: 'compras' | 'rotina' | 'agenda' | 'rotina-steps';
  pending: number;
  oldestTimestamp: number | null;
}

/** Sanitized sync-health snapshot — sizes/ages only, never row contents. */
export function logQueueHealth(health: QueueHealth): void {
  const ageMs = health.oldestTimestamp != null ? Date.now() - health.oldestTimestamp : null;
  console.info('[sync]', {
    domain: health.domain,
    pending: health.pending,
    oldestAgeSeconds: ageMs != null ? Math.round(ageMs / 1000) : null,
  });
}

/** Sanitized reconciliation event — a write was rejected by LWW and had to be reconciled from the canonical row. */
export function logReconciliation(domain: 'rotina' | 'agenda' | 'rotina-steps', context: Record<string, unknown>): void {
  console.info('[reconciliation]', { domain, ...redactSyncEntry(context) });
}
