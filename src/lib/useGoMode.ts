import { useState, useEffect, useCallback } from 'react';
import { type User } from '@supabase/supabase-js';
import { db, type AgendaGoSessionRecord, type AgendaTaskRecord } from './db';
import {
  createGoSession, tickGoSession, finishCurrentTaskEarly as engineFinishEarly,
  pauseGoSession, resumeGoSession, endBonusNow as engineEndBonusNow, remainingMs,
} from './goModeEngine';
import { getTodayKey } from './categories';
import { logError } from './logger';

// Visual countdown resolution — a task timer only needs to look right to
// the second, not tick with millisecond precision. The actual expiry
// check (tickGoSession) runs on this same cadence; up to ~1s of slop
// before a transition is detected is imperceptible here.
const TICK_MS = 1000;

let audioCtx: AudioContext | null = null;
function ensureAudioContext(): AudioContext | null {
  const Ctor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioCtx ??= new Ctor();
  // Browsers create/keep an AudioContext suspended until a user gesture —
  // calling this from startGo() (itself a click handler) is what unlocks
  // it for the beeps that fire later, unattended, from the tick interval.
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

// A short two-tone beep, synthesized on the fly — no audio asset needed.
function playBeep() {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t0 = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
    osc.start(t0);
    osc.stop(t0 + 0.5);
  } catch {
    // Best-effort — a failed beep should never break the timer itself.
  }
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function computeDurationsMs(tasks: AgendaTaskRecord[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const t of tasks) {
    if (t.scheduledStart && t.scheduledEnd) {
      map[t.id] = Math.max(0, (hhmmToMinutes(t.scheduledEnd) - hhmmToMinutes(t.scheduledStart)) * 60_000);
    }
  }
  return map;
}

function fireAlert(events: { type: string }[]) {
  const shouldAlert = events.some(e => e.type === 'task-expired' || e.type === 'bonus-expired');
  if (!shouldAlert) return;
  if ('vibrate' in navigator) navigator.vibrate([80, 60, 80]);
  playBeep();
}

/**
 * Local-only (no Supabase sync — see AgendaGoSessionRecord in db.ts for
 * why) live-execution state for the Agenda's "modo Go". Takes `tasks` and
 * `toggleDone` from useAgendaState rather than duplicating task CRUD —
 * this hook only owns the run itself (current task, countdown, banked
 * bonus time), same layering as useRotinaStepDefs sitting next to
 * useRotinaState.
 */
export function useGoMode(
  user: User | null,
  tasks: AgendaTaskRecord[],
  // AUD-028: useAgendaState's own `tasks` starts as `[]` until its async
  // Dexie/Supabase load resolves — on a cold page load both hooks mount
  // together, so without this the catch-up-on-reload check below could run
  // against an empty task list, compute zero durations, and skip an entire
  // in-progress run straight to "confirm" as if every task had been
  // removed. Gates the catch-up (not the rest of the hook) until real data
  // is in.
  tasksLoading: boolean,
  toggleDone: (id: string) => Promise<void>,
) {
  const [session, setSession] = useState<AgendaGoSessionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  // Deliberately its own state, set (not cleared) by confirmFinished(true)
  // at the same moment the session itself gets nulled/deleted below — the
  // celebration needs to keep rendering for a bit AFTER the session is
  // already gone, so it can't just be derived from `session`.
  const [celebration, setCelebration] = useState<{ big: boolean } | null>(null);
  // Not derived from `session` at render time (Date.now() is impure and
  // can't be called during render) — kept as its own state, explicitly
  // recomputed alongside every setSession call below, plus once a second
  // from the tick interval so the displayed MM:SS actually counts down.
  const [remainingMsState, setRemainingMsState] = useState(0);
  const todayKey = getTodayKey();

  const applySession = useCallback((next: AgendaGoSessionRecord | null) => {
    setSession(next);
    setRemainingMsState(next ? remainingMs(next, Date.now()) : 0);
  }, []);

  const persist = useCallback(async (next: AgendaGoSessionRecord | null) => {
    if (!user) return;
    try {
      if (next) {
        await db.agendaGoSessions.put(next);
      } else {
        await db.agendaGoSessions.delete([todayKey, user.id]);
      }
    } catch (err) {
      logError('Failed to persist Go session', err);
    }
  }, [user, todayKey]);

  // ─── Load (and immediately catch up) today's session on mount/user change ──
  useEffect(() => {
    if (!user) {
      (async () => {
        applySession(null);
        setLoading(false);
      })();
      return;
    }
    // Stay in `loading` until useAgendaState's own task list is real — see
    // the tasksLoading param comment above for the race this avoids.
    if (tasksLoading) return;
    let cancelled = false;
    (async () => {
      try {
        const row = await db.agendaGoSessions.get([todayKey, user.id]);
        if (cancelled) return;
        if (row) {
          // Catch up immediately (don't wait for the first 1s tick) — the
          // app may have been closed well past this session's deadline.
          const result = tickGoSession(row, computeDurationsMs(tasks), Date.now());
          const caughtUp = result.patch ? ({ ...row, ...result.patch } as AgendaGoSessionRecord) : row;
          applySession(caughtUp);
          if (result.patch) await persist(caughtUp);
        } else {
          applySession(null);
        }
      } catch (err) {
        logError('Failed to load Go session', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on user/day/tasksLoading change, not on every `tasks` reference change
  }, [user, todayKey, tasksLoading, applySession]);

  // ─── Ticking: visual countdown every second, real transitions checked the same cadence ──
  useEffect(() => {
    if (!session || session.phase === 'confirm' || session.paused) return;
    const id = setInterval(() => {
      const now = Date.now();
      const result = tickGoSession(session, computeDurationsMs(tasks), now);
      if (result.patch) {
        const next = { ...session, ...result.patch } as AgendaGoSessionRecord;
        applySession(next);
        persist(next);
        fireAlert(result.events);
      } else {
        setRemainingMsState(remainingMs(session, now));
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [session, tasks, persist, applySession]);

  const startGo = useCallback(async () => {
    if (!user) return;
    const eligible = tasks
      .filter(t => t.scheduledStart && t.scheduledEnd && !t.done)
      .slice()
      .sort((a, b) => (a.scheduledStart || '').localeCompare(b.scheduledStart || ''));
    if (eligible.length === 0) return;
    ensureAudioContext(); // user-gesture unlock for the beeps fired later, unattended
    const next = createGoSession(todayKey, user.id, eligible.map(t => t.id), computeDurationsMs(tasks), Date.now());
    applySession(next);
    await persist(next);
  }, [user, todayKey, tasks, persist, applySession]);

  const pause = useCallback(async () => {
    if (!session) return;
    const next = { ...session, ...pauseGoSession(session, Date.now()) };
    applySession(next);
    await persist(next);
  }, [session, persist, applySession]);

  const resume = useCallback(async () => {
    if (!session) return;
    const next = { ...session, ...resumeGoSession(session, Date.now()) };
    applySession(next);
    await persist(next);
  }, [session, persist, applySession]);

  const finishCurrentEarly = useCallback(async () => {
    if (!session) return;
    const { patch, finishedTaskId } = engineFinishEarly(session, computeDurationsMs(tasks), Date.now());
    if (finishedTaskId) await toggleDone(finishedTaskId);
    const next = { ...session, ...patch } as AgendaGoSessionRecord;
    applySession(next);
    await persist(next);
  }, [session, tasks, persist, toggleDone, applySession]);

  const endBonusNow = useCallback(async () => {
    if (!session) return;
    const next = { ...session, ...engineEndBonusNow(session, Date.now()) };
    applySession(next);
    await persist(next);
  }, [session, persist, applySession]);

  // `yes`: every task in the run that only ever got auto-expired (never
  // explicitly finished via finishCurrentEarly) is marked done too — Go
  // mode's own record of "you said you finished" becomes the source of
  // truth for the underlying task list at that point.
  const confirmFinished = useCallback(async (yes: boolean) => {
    if (!session) return;
    if (yes) {
      for (const id of session.taskOrder) {
        const task = tasks.find(t => t.id === id);
        if (task && !task.done) await toggleDone(id);
      }
      // Bigger celebration when the bonus phase was ended manually with
      // time still on the clock — finished everything with room to spare.
      setCelebration({ big: !!session.bonusEndedEarly });
    }
    applySession(null);
    await persist(null);
  }, [session, tasks, persist, toggleDone, applySession]);

  const dismissCelebration = useCallback(() => setCelebration(null), []);

  const exitGo = useCallback(async () => {
    applySession(null);
    await persist(null);
  }, [persist, applySession]);

  const currentTask = session && session.phase === 'task'
    ? tasks.find(t => t.id === session.taskOrder[session.currentIndex])
    : undefined;

  return {
    session,
    loading,
    remainingMs: remainingMsState,
    currentTask,
    startGo,
    pause,
    resume,
    finishCurrentEarly,
    endBonusNow,
    confirmFinished,
    exitGo,
    celebration,
    dismissCelebration,
  };
}
