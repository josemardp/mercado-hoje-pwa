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

  let cursor = windowStartMin;
  const placed: ScheduledTask[] = [];

  for (const task of undone) {
    if (task.fixed && task.fixedStart) {
      const anchorStart = toMinutes(task.fixedStart);
      const anchorEnd = anchorStart + task.estimatedMinutes;
      placed.push({
        ...task,
        scheduledStart: toHHMM(anchorStart),
        scheduledEnd: toHHMM(anchorEnd),
        allottedMinutes: task.estimatedMinutes,
      });
      cursor = Math.max(cursor, anchorEnd);
    } else {
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
