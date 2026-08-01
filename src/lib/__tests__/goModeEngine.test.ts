import { describe, it, expect } from 'vitest';
import {
  createGoSession, tickGoSession, finishCurrentTaskEarly,
  pauseGoSession, resumeGoSession, endBonusNow, remainingMs, formatCountdown,
} from '../goModeEngine';
import type { AgendaGoSessionRecord } from '../db';

const DAY = '2026-08-01';
const USER = 'user-1';
const T0 = 1_000_000; // arbitrary epoch ms anchor

describe('createGoSession', () => {
  it('starts on the first task with phaseEndsAt set to its full duration', () => {
    const session = createGoSession(DAY, USER, ['a', 'b'], { a: 60_000, b: 30_000 }, T0);
    expect(session.phase).toBe('task');
    expect(session.currentIndex).toBe(0);
    expect(session.paused).toBe(false);
    expect(session.phaseEndsAt).toBe(T0 + 60_000);
    expect(session.bankedExtraMs).toBe(0);
  });
});

describe('tickGoSession', () => {
  it('is a no-op before the current task expires', () => {
    const session = createGoSession(DAY, USER, ['a', 'b'], { a: 60_000, b: 30_000 }, T0);
    const result = tickGoSession(session, { a: 60_000, b: 30_000 }, T0 + 30_000);
    expect(result.patch).toBeNull();
    expect(result.events).toEqual([]);
  });

  it('advances to the next task and emits task-expired when the deadline passes', () => {
    const session = createGoSession(DAY, USER, ['a', 'b'], { a: 60_000, b: 30_000 }, T0);
    const now = T0 + 60_000;
    const result = tickGoSession(session, { a: 60_000, b: 30_000 }, now);
    expect(result.events).toEqual([{ type: 'task-expired', taskId: 'a' }]);
    expect(result.patch).toMatchObject({ phase: 'task', currentIndex: 1, phaseEndsAt: now + 30_000 });
  });

  it('skips straight to confirm after the last task when nothing was banked', () => {
    const session = createGoSession(DAY, USER, ['a'], { a: 60_000 }, T0);
    const result = tickGoSession(session, { a: 60_000 }, T0 + 60_000);
    expect(result.events).toEqual([{ type: 'task-expired', taskId: 'a' }]);
    expect(result.patch).toMatchObject({ phase: 'confirm', currentIndex: 1 });
  });

  it('enters the bonus phase after the last task when time was banked earlier', () => {
    let session = createGoSession(DAY, USER, ['a', 'b'], { a: 60_000, b: 30_000 }, T0);
    // "Concluir agora" on task a with 20s left, banking 20s.
    const early = finishCurrentTaskEarly(session, { a: 60_000, b: 30_000 }, T0 + 40_000);
    session = { ...session, ...early.patch };
    expect(session.bankedExtraMs).toBe(20_000);

    const now = session.phaseEndsAt! + 1; // let task b run out too
    const result = tickGoSession(session, { a: 60_000, b: 30_000 }, now);
    expect(result.events).toEqual([{ type: 'task-expired', taskId: 'b' }]);
    expect(result.patch).toMatchObject({ phase: 'bonus', phaseEndsAt: now + 20_000, bankedExtraMs: 20_000 });
  });

  it('reopening long after a task expired only skips that one task, not the rest of the run', () => {
    // Deadlines are duration-anchored (now + duration at the moment a task
    // becomes active), not tied to the original wall-clock schedule — so a
    // long absence only ever costs the ONE task that was running when you
    // left. The next task starts fresh from "now" with its full duration,
    // rather than every remaining task instantly cascading into expiry too.
    const session = createGoSession(DAY, USER, ['a', 'b', 'c'], { a: 60_000, b: 60_000, c: 60_000 }, T0);
    const now = T0 + 5 * 60_000; // reopened 5 minutes later, well past task a's 1 minute
    const result = tickGoSession(session, { a: 60_000, b: 60_000, c: 60_000 }, now);
    expect(result.events).toEqual([{ type: 'task-expired', taskId: 'a' }]);
    expect(result.patch).toMatchObject({ phase: 'task', currentIndex: 1, phaseEndsAt: now + 60_000 });
  });

  it('does nothing while paused, even past the deadline', () => {
    let session = createGoSession(DAY, USER, ['a'], { a: 60_000 }, T0);
    session = { ...session, ...pauseGoSession(session, T0 + 10_000) };
    const result = tickGoSession(session, { a: 60_000 }, T0 + 999_000);
    expect(result.patch).toBeNull();
  });

  it('expires the bonus phase into confirm', () => {
    const bonusSession: AgendaGoSessionRecord = {
      dayKey: DAY, userId: USER, phase: 'bonus', taskOrder: ['a'], currentIndex: 1,
      paused: false, phaseEndsAt: T0 + 15_000, bankedExtraMs: 15_000, bonusEndedEarly: false,
      startedAt: T0, updatedAt: T0,
    };
    const result = tickGoSession(bonusSession, {}, T0 + 15_000);
    expect(result.events).toEqual([{ type: 'bonus-expired' }]);
    expect(result.patch).toMatchObject({ phase: 'confirm' });
  });

  it('skips a task id no longer present in durationsMs (removed mid-run) without stalling', () => {
    const session = createGoSession(DAY, USER, ['a', 'b', 'c'], { a: 60_000, b: 60_000, c: 60_000 }, T0);
    // 'b' vanished from the live task list (e.g. removed elsewhere).
    const result = tickGoSession(session, { a: 60_000, c: 60_000 }, T0 + 60_000);
    expect(result.patch).toMatchObject({ phase: 'task', currentIndex: 2 });
  });
});

describe('finishCurrentTaskEarly', () => {
  it('banks the remaining time and advances', () => {
    const session = createGoSession(DAY, USER, ['a', 'b'], { a: 60_000, b: 30_000 }, T0);
    const { patch, finishedTaskId } = finishCurrentTaskEarly(session, { a: 60_000, b: 30_000 }, T0 + 45_000);
    expect(finishedTaskId).toBe('a');
    expect(patch).toMatchObject({ phase: 'task', currentIndex: 1, bankedExtraMs: 15_000 });
  });

  it('is a no-op outside the task phase', () => {
    const bonusSession: AgendaGoSessionRecord = {
      dayKey: DAY, userId: USER, phase: 'bonus', taskOrder: ['a'], currentIndex: 1,
      paused: false, phaseEndsAt: T0 + 10_000, bankedExtraMs: 10_000, bonusEndedEarly: false,
      startedAt: T0, updatedAt: T0,
    };
    const { patch, finishedTaskId } = finishCurrentTaskEarly(bonusSession, {}, T0);
    expect(finishedTaskId).toBeNull();
    expect(patch).toEqual({});
  });
});

describe('pause/resume', () => {
  it('freezes remaining time on pause and restores it on resume, anchored to the new "now"', () => {
    let session = createGoSession(DAY, USER, ['a'], { a: 60_000 }, T0);
    session = { ...session, ...pauseGoSession(session, T0 + 20_000) };
    expect(session.paused).toBe(true);
    expect(session.pausedRemainingMs).toBe(40_000);
    expect(session.phaseEndsAt).toBeUndefined();

    session = { ...session, ...resumeGoSession(session, T0 + 100_000) };
    expect(session.paused).toBe(false);
    expect(session.phaseEndsAt).toBe(T0 + 100_000 + 40_000);
  });
});

describe('endBonusNow', () => {
  it('marks bonusEndedEarly true when time was still left', () => {
    const session: AgendaGoSessionRecord = {
      dayKey: DAY, userId: USER, phase: 'bonus', taskOrder: ['a'], currentIndex: 1,
      paused: false, phaseEndsAt: T0 + 30_000, bankedExtraMs: 30_000, bonusEndedEarly: false,
      startedAt: T0, updatedAt: T0,
    };
    const patch = endBonusNow(session, T0 + 10_000);
    expect(patch).toMatchObject({ phase: 'confirm', bonusEndedEarly: true });
  });

  it('marks bonusEndedEarly false when called right at (or after) the deadline', () => {
    const session: AgendaGoSessionRecord = {
      dayKey: DAY, userId: USER, phase: 'bonus', taskOrder: ['a'], currentIndex: 1,
      paused: false, phaseEndsAt: T0 + 30_000, bankedExtraMs: 30_000, bonusEndedEarly: false,
      startedAt: T0, updatedAt: T0,
    };
    const patch = endBonusNow(session, T0 + 30_000);
    expect(patch).toMatchObject({ phase: 'confirm', bonusEndedEarly: false });
  });
});

describe('remainingMs', () => {
  it('reads from phaseEndsAt when running', () => {
    const session = createGoSession(DAY, USER, ['a'], { a: 60_000 }, T0);
    expect(remainingMs(session, T0 + 25_000)).toBe(35_000);
  });

  it('reads from pausedRemainingMs when paused', () => {
    let session = createGoSession(DAY, USER, ['a'], { a: 60_000 }, T0);
    session = { ...session, ...pauseGoSession(session, T0 + 25_000) };
    expect(remainingMs(session, T0 + 999_000)).toBe(35_000);
  });

  it('is 0 once in confirm', () => {
    const session: AgendaGoSessionRecord = {
      dayKey: DAY, userId: USER, phase: 'confirm', taskOrder: ['a'], currentIndex: 1,
      paused: false, bankedExtraMs: 0, bonusEndedEarly: false, startedAt: T0, updatedAt: T0,
    };
    expect(remainingMs(session, T0)).toBe(0);
  });
});

describe('formatCountdown', () => {
  it('formats as MM:SS', () => {
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(59_000)).toBe('00:59');
    expect(formatCountdown(60_000)).toBe('01:00');
    expect(formatCountdown(3_661_000)).toBe('61:01');
  });

  it('clamps negative values to zero instead of showing a negative countdown', () => {
    expect(formatCountdown(-5_000)).toBe('00:00');
  });
});
