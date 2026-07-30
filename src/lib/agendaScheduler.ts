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
  tasks: ScheduledTask[]; // same order/length as input; empty when invalidWindow or fixedConflicts is non-empty
  shortfallMinutes: number; // minutes that didn't fit, including a fixed commitment running past the window
  // AUD-002/S3: the window itself is nonsensical (end <= start). Callers
  // must check this (and fixedConflicts) BEFORE looking at tasks/shortfall
  // and refuse to persist — there is no schedule to save.
  invalidWindow: boolean;
  // ids of anchored fixed tasks that overlap ANOTHER anchored fixed task.
  // Unlike a fixed commitment merely running past the window (which is just
  // shortfall — normal, expected, nothing to reject), two immovable
  // commitments colliding can never be reconciled by compression: there is
  // no valid schedule until the user resolves it, so nothing is computed.
  fixedConflicts: string[];
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
// scheduledStart/scheduledEnd for every undone task.
//
// AUD-002: the previous version computed one global compression scale for
// every flexible task, comparing the window's total slack against the total
// flexible workload — but that comparison has no idea WHERE in the window a
// fixed appointment falls. A flexible task placed "before" a mid-window
// appointment could look compressible by the global math while still
// running straight through that appointment's own time.
//
// This version builds the free intervals ("gaps") between fixed anchors
// first, then compresses each gap's flexible tasks against ONLY that gap's
// own capacity — so a task can never be allotted more room than genuinely
// exists between its neighboring fixed commitments. If a gap still doesn't
// fit even after every flexible task inside it is compressed to
// FLOOR_MINUTES, tasks are clipped (never below what actually fits) so two
// scheduled intervals can never overlap; the clipped amount is reported via
// shortfallMinutes instead.
export function generateSchedule(
  tasks: SchedulableTask[],
  windowStart: string,
  windowEnd: string,
): ScheduleResult {
  const windowStartMin = toMinutes(windowStart);
  const windowEndMin = toMinutes(windowEnd);

  if (windowEndMin <= windowStartMin) {
    return { tasks: [], shortfallMinutes: 0, invalidWindow: true, fixedConflicts: [] };
  }

  const done = tasks.filter(t => t.done);
  const undone = tasks.filter(t => !t.done).slice().sort((a, b) => a.order - b.order);

  const fixedAnchoredTasks = undone.filter(t => t.fixed && t.fixedStart);
  const sortedAnchors = fixedAnchoredTasks
    .slice()
    .sort((a, b) => toMinutes(a.fixedStart!) - toMinutes(b.fixedStart!))
    .map(t => ({
      task: t,
      start: toMinutes(t.fixedStart!),
      end: toMinutes(t.fixedStart!) + Math.max(0, t.estimatedMinutes),
    }));

  // Two immovable commitments colliding can never be reconciled by
  // compression — reject up front rather than silently overlapping them (or
  // silently picking a "winner"). Running past the window end, by contrast,
  // is ordinary and handled below as shortfall.
  const fixedConflicts = new Set<string>();
  for (let i = 1; i < sortedAnchors.length; i++) {
    if (sortedAnchors[i].start < sortedAnchors[i - 1].end) {
      fixedConflicts.add(sortedAnchors[i].task.id);
      fixedConflicts.add(sortedAnchors[i - 1].task.id);
    }
  }
  if (fixedConflicts.size > 0) {
    return { tasks: [], shortfallMinutes: 0, invalidWindow: false, fixedConflicts: [...fixedConflicts] };
  }

  // Every other undone task (flexible, or fixed-without-a-time) belongs to
  // the gap between whichever anchors preceded it in the ORIGINAL order —
  // not by anchor time — so "Planejar (flex), Reunião 18h (fixo), Comprar
  // (flex), Consulta 10h (fixo)" keeps Planejar before both appointments and
  // Comprar between them, regardless of Consulta's 10h sorting earlier than
  // Reunião's 18h.
  let anchorsSeenSoFar = 0;
  const gapIndexByTaskId = new Map<string, number>();
  for (const task of undone) {
    if (task.fixed && task.fixedStart) {
      anchorsSeenSoFar++;
    } else {
      gapIndexByTaskId.set(task.id, anchorsSeenSoFar);
    }
  }

  const others = undone.filter(t => !(t.fixed && t.fixedStart));
  const gapTasks: SchedulableTask[][] = Array.from({ length: sortedAnchors.length + 1 }, () => []);
  for (const task of others) {
    gapTasks[gapIndexByTaskId.get(task.id)!].push(task);
  }

  const placed: ScheduledTask[] = [];
  let shortfallMinutes = 0;

  for (let gapIndex = 0; gapIndex <= sortedAnchors.length; gapIndex++) {
    const gapStart = gapIndex === 0 ? windowStartMin : sortedAnchors[gapIndex - 1].end;
    const gapEnd = gapIndex === sortedAnchors.length ? windowEndMin : sortedAnchors[gapIndex].start;
    const gapCapacity = Math.max(0, gapEnd - gapStart);

    const tasksInGap = gapTasks[gapIndex];
    // Fixed-but-unanchored tasks ("fixo" with no time set) are treated as
    // soft-fixed here: their duration is respected as-is and never scaled
    // down for proportional compression, same as a real appointment — but
    // if the gap truly runs out of room even after compressing every
    // flexible task to the floor, they can still be clipped by the walk
    // below as a last resort, so "no overlap ever" always holds. The fuller
    // UX for this edge case (a fixed task with no time) is Sprint 4's job.
    const flexibleInGap = tasksInGap.filter(t => !t.fixed);
    const flexibleSum = flexibleInGap.reduce((sum, t) => sum + Math.max(0, t.estimatedMinutes), 0);
    const fixedFloatingSum = tasksInGap
      .filter(t => t.fixed)
      .reduce((sum, t) => sum + Math.max(0, t.estimatedMinutes), 0);
    const availableForFlexible = gapCapacity - fixedFloatingSum;

    const scale =
      flexibleSum === 0 || availableForFlexible >= flexibleSum
        ? 1
        : Math.max(0, availableForFlexible / flexibleSum);

    let cursor = gapStart;
    for (const task of tasksInGap) {
      const desired = task.fixed
        ? Math.max(0, task.estimatedMinutes)
        : (scale >= 1 ? task.estimatedMinutes : Math.max(FLOOR_MINUTES, Math.round(task.estimatedMinutes * scale)));

      const roomLeft = Math.max(0, gapEnd - cursor);
      const allotted = Math.min(desired, roomLeft);
      shortfallMinutes += desired - allotted;

      const start = cursor;
      const end = cursor + allotted;
      placed.push({
        ...task,
        scheduledStart: toHHMM(start),
        scheduledEnd: toHHMM(end),
        allottedMinutes: allotted,
      });
      cursor = end;
    }

    const anchor = sortedAnchors[gapIndex];
    if (anchor) {
      placed.push({
        ...anchor.task,
        scheduledStart: toHHMM(anchor.start),
        scheduledEnd: toHHMM(anchor.end),
        allottedMinutes: anchor.end - anchor.start,
      });
    }
  }

  // A fixed commitment running outside the window it was asked to plan
  // against (starting early or running late) is real, useful information —
  // not an error — so it counts toward shortfall just like an unaccommodated
  // flexible task would, even though nothing here "clips" the anchor itself.
  for (const anchor of sortedAnchors) {
    shortfallMinutes += Math.max(0, anchor.end - windowEndMin) + Math.max(0, windowStartMin - anchor.start);
  }

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

  return { tasks: resultTasks, shortfallMinutes, invalidWindow: false, fixedConflicts: [] };
}
