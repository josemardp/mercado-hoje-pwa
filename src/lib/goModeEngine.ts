// Pure state-transition logic for Agenda's "modo Go" (sequential per-task
// countdown). Kept side-effect-free and Dexie-free on purpose — the hook
// (useGoMode.ts) owns persistence, vibration/sound, and the ticking
// interval; this module only ever asks "given this session and this
// instant, what should the session become, and what happened along the
// way?". That split is what makes the actual advance-on-expiry logic
// unit-testable without faking IndexedDB or a timer.
import type { AgendaGoSessionRecord, GoPhase } from './db';

export type GoEvent =
  | { type: 'task-expired'; taskId: string }
  | { type: 'bonus-expired' };

export interface GoTickResult {
  patch: Partial<AgendaGoSessionRecord> | null;
  events: GoEvent[];
}

function buildSession(
  base: Pick<AgendaGoSessionRecord, 'dayKey' | 'userId' | 'taskOrder' | 'bankedExtraMs' | 'startedAt'>,
  overrides: Partial<AgendaGoSessionRecord>,
): AgendaGoSessionRecord {
  return {
    phase: 'task',
    currentIndex: 0,
    paused: false,
    bonusEndedEarly: false,
    updatedAt: base.startedAt,
    ...base,
    ...overrides,
  };
}

/** Starting point for a fresh Go run — always begins on the first task. */
export function createGoSession(
  dayKey: string,
  userId: string,
  taskOrder: string[],
  durationsMs: Record<string, number>,
  now: number,
): AgendaGoSessionRecord {
  return buildSession(
    { dayKey, userId, taskOrder, bankedExtraMs: 0, startedAt: now },
    {
      phase: 'task',
      currentIndex: 0,
      paused: false,
      phaseEndsAt: now + (durationsMs[taskOrder[0]] ?? 0),
      updatedAt: now,
    },
  );
}

/**
 * Moves past the task at `currentIndex` — shared by both a natural
 * expiry (tick, extraMs = 0) and an explicit "Concluir agora" (extraMs =
 * whatever time was left). Skips any task id no longer present in
 * `durationsMs` (removed mid-run) without stopping the run.
 */
function advancePastCurrentTask(
  session: AgendaGoSessionRecord,
  durationsMs: Record<string, number>,
  now: number,
  bankedDeltaMs: number,
): Partial<AgendaGoSessionRecord> {
  let nextIndex = session.currentIndex + 1;
  while (nextIndex < session.taskOrder.length && !(session.taskOrder[nextIndex] in durationsMs)) {
    nextIndex++;
  }
  const bankedExtraMs = session.bankedExtraMs + Math.max(0, bankedDeltaMs);

  if (nextIndex < session.taskOrder.length) {
    return {
      phase: 'task',
      currentIndex: nextIndex,
      paused: false,
      phaseEndsAt: now + durationsMs[session.taskOrder[nextIndex]],
      pausedRemainingMs: undefined,
      bankedExtraMs,
      updatedAt: now,
    };
  }

  // Ran out of tasks — enter the bonus phase if there's banked time to
  // spend, otherwise skip straight to the final confirm question.
  if (bankedExtraMs > 0) {
    return {
      phase: 'bonus',
      currentIndex: nextIndex,
      paused: false,
      phaseEndsAt: now + bankedExtraMs,
      pausedRemainingMs: undefined,
      bankedExtraMs,
      updatedAt: now,
    };
  }
  return {
    phase: 'confirm',
    currentIndex: nextIndex,
    paused: false,
    phaseEndsAt: undefined,
    pausedRemainingMs: undefined,
    bankedExtraMs,
    updatedAt: now,
  };
}

/**
 * Advances the session as far as `now` allows — a task (or the bonus
 * phase) can expire more than once in a single tick if the app was closed
 * past several deadlines, so this loops until nothing more would happen at
 * this instant. No-op (patch: null) when paused, already at 'confirm', or
 * simply not due yet.
 */
export function tickGoSession(
  session: AgendaGoSessionRecord,
  durationsMs: Record<string, number>,
  now: number,
): GoTickResult {
  if (session.paused || session.phase === 'confirm') return { patch: null, events: [] };

  const events: GoEvent[] = [];
  let current = session;
  let changed = false;

  // Bounded by taskOrder.length + 1 (task-by-task, then the bonus phase) —
  // never actually infinite, this cap just guards against a logic bug
  // looping forever instead of hanging the tab.
  for (let guard = 0; guard < current.taskOrder.length + 2; guard++) {
    if (current.phase === 'task') {
      if (current.phaseEndsAt === undefined || current.phaseEndsAt > now) break;
      const expiredId = current.taskOrder[current.currentIndex];
      events.push({ type: 'task-expired', taskId: expiredId });
      current = { ...current, ...advancePastCurrentTask(current, durationsMs, now, 0) };
      changed = true;
      continue;
    }
    if (current.phase === 'bonus') {
      if (current.phaseEndsAt === undefined || current.phaseEndsAt > now) break;
      events.push({ type: 'bonus-expired' });
      current = { ...current, phase: 'confirm', phaseEndsAt: undefined, pausedRemainingMs: undefined, updatedAt: now };
      changed = true;
      continue;
    }
    break;
  }

  if (!changed) return { patch: null, events: [] };
  // Returning the whole recomputed session (not just the fields the loop
  // touched) is simplest here — dayKey/userId round-trip back onto
  // themselves harmlessly when the hook merges this into the stored row.
  return { patch: current, events };
}

/** Explicit "Concluir agora" on the current task — banks whatever time was left. */
export function finishCurrentTaskEarly(
  session: AgendaGoSessionRecord,
  durationsMs: Record<string, number>,
  now: number,
): { patch: Partial<AgendaGoSessionRecord>; finishedTaskId: string | null } {
  if (session.phase !== 'task') return { patch: {}, finishedTaskId: null };
  const finishedTaskId = session.taskOrder[session.currentIndex];
  const remaining = session.paused
    ? (session.pausedRemainingMs ?? 0)
    : Math.max(0, (session.phaseEndsAt ?? now) - now);
  return {
    patch: advancePastCurrentTask(session, durationsMs, now, remaining),
    finishedTaskId,
  };
}

export function pauseGoSession(session: AgendaGoSessionRecord, now: number): Partial<AgendaGoSessionRecord> {
  if (session.paused || session.phase === 'confirm') return {};
  const remaining = Math.max(0, (session.phaseEndsAt ?? now) - now);
  return { paused: true, phaseEndsAt: undefined, pausedRemainingMs: remaining, updatedAt: now };
}

export function resumeGoSession(session: AgendaGoSessionRecord, now: number): Partial<AgendaGoSessionRecord> {
  if (!session.paused) return {};
  return {
    paused: false,
    phaseEndsAt: now + (session.pausedRemainingMs ?? 0),
    pausedRemainingMs: undefined,
    updatedAt: now,
  };
}

/** "Fim" tapped during the bonus phase — records whether time was still left, for the bigger celebration. */
export function endBonusNow(session: AgendaGoSessionRecord, now: number): Partial<AgendaGoSessionRecord> {
  if (session.phase !== 'bonus') return {};
  const remaining = session.paused ? (session.pausedRemainingMs ?? 0) : Math.max(0, (session.phaseEndsAt ?? now) - now);
  return {
    phase: 'confirm',
    paused: false,
    phaseEndsAt: undefined,
    pausedRemainingMs: undefined,
    bonusEndedEarly: remaining > 0,
    updatedAt: now,
  };
}

/** Remaining time for whichever phase is currently active, for display. 0 once in 'confirm'. */
export function remainingMs(session: AgendaGoSessionRecord, now: number): number {
  if (session.phase === 'confirm') return 0;
  if (session.paused) return session.pausedRemainingMs ?? 0;
  return Math.max(0, (session.phaseEndsAt ?? now) - now);
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export type { GoPhase };
