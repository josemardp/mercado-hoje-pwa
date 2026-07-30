import { FLOOR_MINUTES } from './agendaDurationEstimator';

export interface SchedulableTask {
  id: string;
  order: number;
  estimatedMinutes: number; // immutable baseline — the engine never writes back here
  fixed: boolean;
  fixedStart?: string; // "HH:MM"
  done: boolean;
  scheduledStart?: string; // previous value — passed through untouched if done
  scheduledEnd?: string;
}

export interface ScheduledTask extends SchedulableTask {
  scheduledStart: string;
  scheduledEnd: string;
  allottedMinutes: number; // actual minutes after compression (may be < estimatedMinutes)
}

export interface ScheduleResult {
  tasks: ScheduledTask[]; // same order/length as input; done tasks pass through unchanged
  shortfallMinutes: number; // 0 if everything fit
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function toHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatDurationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${String(h).padStart(2, '0')}h00`;
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`;
}

// Pure function: given today's undone/done tasks and a time window, computes
// scheduledStart/scheduledEnd for every undone task. Flexible tasks are
// compressed (never below FLOOR_MINUTES) as much as needed to fit; fixed
// tasks are never compressed. If it still doesn't fit even at the floor,
// shortfallMinutes reports how much is missing instead of pretending success.
export function generateSchedule(
  tasks: SchedulableTask[],
  windowStart: string,
  windowEnd: string,
): ScheduleResult {
  const windowStartMin = toMinutes(windowStart);
  const windowEndMin = toMinutes(windowEnd);
  const windowMinutes = Math.max(0, windowEndMin - windowStartMin);

  const done = tasks.filter(t => t.done);
  const undone = tasks.filter(t => !t.done).slice().sort((a, b) => a.order - b.order);

  const fixedAnchored = undone.filter(t => t.fixed && t.fixedStart);
  const fixedFloating = undone.filter(t => t.fixed && !t.fixedStart);
  const flexible = undone.filter(t => !t.fixed);

  const totalFixedMinutes =
    fixedAnchored.reduce((sum, t) => sum + t.estimatedMinutes, 0) +
    fixedFloating.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  const totalFlexibleMinutes = flexible.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  const remainingForFlexible = windowMinutes - totalFixedMinutes;

  // First-pass proportional scale — a good-faith starting point, not the
  // final authority (it can't foresee idle gaps before a mid-window
  // appointment; the placement walk below is what actually decides).
  const scale =
    remainingForFlexible >= totalFlexibleMinutes || totalFlexibleMinutes === 0
      ? 1
      : Math.max(0, remainingForFlexible / totalFlexibleMinutes);

  const allotmentFor = (task: SchedulableTask): number => {
    if (task.fixed) return task.estimatedMinutes;
    if (scale >= 1) return task.estimatedMinutes;
    return Math.max(FLOOR_MINUTES, Math.round(task.estimatedMinutes * scale));
  };

  // Anchors are placed chronologically no matter where you typed them in the
  // list — but a non-anchored task still needs to land in the "slot" you
  // intended (before/after a given appointment). That slot is captured by
  // how many anchors preceded it in your ORIGINAL order, not by anchor time:
  // e.g. "Planejar (flex), Reunião 18h (fixo), Comprar (flex), Consulta 10h
  // (fixo)" means Planejar goes before both appointments and Comprar goes
  // between them, regardless of Consulta's 10h sorting earlier than 18h.
  let anchorsSeenSoFar = 0;
  const gapIndexByTaskId = new Map<string, number>();
  for (const task of undone) {
    if (task.fixed && task.fixedStart) {
      anchorsSeenSoFar++;
    } else {
      gapIndexByTaskId.set(task.id, anchorsSeenSoFar);
    }
  }

  const sortedAnchors = fixedAnchored
    .slice()
    .sort((a, b) => toMinutes(a.fixedStart!) - toMinutes(b.fixedStart!));

  const others = undone.filter(t => !(t.fixed && t.fixedStart));
  const gaps: SchedulableTask[][] = Array.from({ length: sortedAnchors.length + 1 }, () => []);
  for (const task of others) {
    gaps[gapIndexByTaskId.get(task.id)!].push(task);
  }

  let cursor = windowStartMin;
  const placed: ScheduledTask[] = [];

  for (let gapIndex = 0; gapIndex <= sortedAnchors.length; gapIndex++) {
    for (const task of gaps[gapIndex]) {
      const duration = allotmentFor(task);
      const start = cursor;
      const end = cursor + duration;
      placed.push({
        ...task,
        scheduledStart: toHHMM(start),
        scheduledEnd: toHHMM(end),
        allottedMinutes: duration,
      });
      cursor = end;
    }

    const anchor = sortedAnchors[gapIndex];
    if (anchor) {
      const anchorStart = toMinutes(anchor.fixedStart!);
      const anchorEnd = anchorStart + anchor.estimatedMinutes;
      placed.push({
        ...anchor,
        scheduledStart: toHHMM(anchorStart),
        scheduledEnd: toHHMM(anchorEnd),
        allottedMinutes: anchor.estimatedMinutes,
      });
      cursor = Math.max(cursor, anchorEnd);
    }
  }

  const shortfallMinutes = Math.max(0, cursor - windowEndMin);

  // Return in original relative order: done tasks keep their historical
  // position among themselves, undone tasks reflect the fresh placement —
  // simplest correct approach is to merge back by original `order`.
  const byId = new Map<string, ScheduledTask>();
  for (const t of done) {
    byId.set(t.id, {
      ...t,
      scheduledStart: t.scheduledStart ?? windowStart,
      scheduledEnd: t.scheduledEnd ?? windowStart,
      allottedMinutes: t.estimatedMinutes,
    });
  }
  for (const t of placed) byId.set(t.id, t);

  const resultTasks = tasks
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(t => byId.get(t.id)!);

  return { tasks: resultTasks, shortfallMinutes };
}
