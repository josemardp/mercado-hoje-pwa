import { describe, it, expect } from 'vitest';
import { generateSchedule, formatDurationLabel, type SchedulableTask } from '../agendaScheduler';
import { FLOOR_MINUTES } from '../agendaDurationEstimator';

function task(partial: Partial<SchedulableTask> & Pick<SchedulableTask, 'id' | 'order' | 'estimatedMinutes'>): SchedulableTask {
  return { fixed: false, done: false, ...partial };
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function toHHMM(totalMinutes: number): string {
  const wrapped = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

function assertNoOverlaps(intervals: readonly (readonly [number, number])[]) {
  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      const [aStart, aEnd] = intervals[i];
      const [bStart, bEnd] = intervals[j];
      expect(aStart < bEnd && bStart < aEnd).toBe(false);
    }
  }
}

describe('generateSchedule — happy path', () => {
  it('places sequential flexible tasks back-to-back with no compression when they fit', () => {
    const tasks = [
      task({ id: '1', order: 1, estimatedMinutes: 60 }),
      task({ id: '2', order: 2, estimatedMinutes: 30 }),
      task({ id: '3', order: 3, estimatedMinutes: 30 }),
      task({ id: '4', order: 4, estimatedMinutes: 60 }),
    ];
    const result = generateSchedule(tasks, '17:00', '20:00');
    expect(result.shortfallMinutes).toBe(0);
    expect(result.tasks.map(t => [t.scheduledStart, t.scheduledEnd])).toEqual([
      ['17:00', '18:00'],
      ['18:00', '18:30'],
      ['18:30', '19:00'],
      ['19:00', '20:00'],
    ]);
  });

  it('compresses flexible tasks proportionally when the window is tight', () => {
    const tasks = [
      task({ id: '1', order: 1, estimatedMinutes: 60 }),
      task({ id: '2', order: 2, estimatedMinutes: 30 }),
      task({ id: '3', order: 3, estimatedMinutes: 30 }),
      task({ id: '4', order: 4, estimatedMinutes: 60 }),
    ];
    const result = generateSchedule(tasks, '17:00', '19:30');
    expect(result.shortfallMinutes).toBe(0);
    expect(result.tasks.map(t => t.allottedMinutes)).toEqual([50, 25, 25, 50]);
  });

  it('counts a fixed commitment running past the window end as shortfall, not as a conflict', () => {
    const tasks = [
      task({ id: '1', order: 1, estimatedMinutes: 60 }),
      task({ id: '2', order: 2, estimatedMinutes: 90, fixed: true, fixedStart: '18:00' }),
    ];
    const result = generateSchedule(tasks, '17:00', '19:00');
    expect(result.fixedConflicts).toEqual([]);
    // Planejar (60min) fits exactly in the 17:00–18:00 gap; only the
    // appointment itself running 30min past the 19:00 window end is missing.
    expect(result.shortfallMinutes).toBe(30);
    const byId = Object.fromEntries(result.tasks.map(t => [t.id, t]));
    expect(byId['1'].scheduledStart).toBe('17:00');
    expect(byId['1'].scheduledEnd).toBe('18:00');
    expect(byId['2'].scheduledStart).toBe('18:00');
    expect(byId['2'].scheduledEnd).toBe('19:30');
  });

  it('honors a fixed appointment placed chronologically before another one typed earlier in the list', () => {
    const tasks = [
      task({ id: 'A', order: 1, estimatedMinutes: 30 }),
      task({ id: 'B', order: 2, estimatedMinutes: 60, fixed: true, fixedStart: '18:00' }),
      task({ id: 'C', order: 3, estimatedMinutes: 20 }),
      task({ id: 'D', order: 4, estimatedMinutes: 30, fixed: true, fixedStart: '10:00' }),
      task({ id: 'E', order: 5, estimatedMinutes: 20 }),
    ];
    const result = generateSchedule(tasks, '09:00', '20:00');
    const byId = Object.fromEntries(result.tasks.map(t => [t.id, t]));
    expect(byId.D.scheduledStart).toBe('10:00');
    expect(byId.B.scheduledStart).toBe('18:00');
    expect(result.shortfallMinutes).toBe(0);
  });

  it('leaves done tasks untouched on regeneration', () => {
    const tasks = [
      task({ id: '1', order: 1, estimatedMinutes: 60, done: true, scheduledStart: '09:00', scheduledEnd: '10:00' }),
      task({ id: '2', order: 2, estimatedMinutes: 30 }),
    ];
    const result = generateSchedule(tasks, '14:00', '16:00');
    const byId = Object.fromEntries(result.tasks.map(t => [t.id, t]));
    expect(byId['1'].scheduledStart).toBe('09:00');
    expect(byId['1'].scheduledEnd).toBe('10:00');
  });
});

describe('formatDurationLabel', () => {
  it('formats minutes-only durations', () => {
    expect(formatDurationLabel(30)).toBe('30min');
  });
  it('formats whole-hour durations', () => {
    expect(formatDurationLabel(60)).toBe('01h00');
  });
  it('formats mixed hour+minute durations', () => {
    expect(formatDurationLabel(90)).toBe('01h30');
  });
});

// ─── AUD-002 (Crítico, resolvido na Sprint 3): o motor antigo comprimia por
// uma escala global (janela inteira vs. soma de flexíveis), sem saber ONDE
// no meio da janela um compromisso fixo caía — uma tarefa flexível podia
// "achar" que cabia e avançar por cima do horário fixo. O motor novo
// constrói os intervalos livres entre âncoras fixas primeiro e comprime
// cada um só contra a capacidade real do seu próprio intervalo.
describe('AUD-002 — não há sobreposição com compromisso fixo no meio da janela', () => {
  it('cenário exato da auditoria: comprime a tarefa flexível pra caber antes do compromisso fixo', () => {
    const tasks = [
      task({ id: 'flex', order: 1, estimatedMinutes: 120 }),
      task({ id: 'fixo', order: 2, estimatedMinutes: 30, fixed: true, fixedStart: '10:00' }),
    ];
    const result = generateSchedule(tasks, '09:00', '12:00');
    expect(result.fixedConflicts).toEqual([]);
    expect(result.invalidWindow).toBe(false);

    const intervals = result.tasks.map(t => [toMin(t.scheduledStart), toMin(t.scheduledEnd)] as const);
    assertNoOverlaps(intervals);

    const byId = Object.fromEntries(result.tasks.map(t => [t.id, t]));
    expect(byId.flex.scheduledStart).toBe('09:00');
    expect(byId.flex.scheduledEnd).toBe('10:00'); // comprimida de 120 pra 60min, exatamente até o fixo
    expect(byId.fixo.scheduledStart).toBe('10:00');
    expect(byId.fixo.scheduledEnd).toBe('10:30');
    expect(result.shortfallMinutes).toBe(0); // coube tudo, só precisou comprimir
  });

  it('rejeita dois compromissos fixos que se sobrepõem entre si, em vez de escolher um vencedor silenciosamente', () => {
    const tasks = [
      task({ id: 'a', order: 1, estimatedMinutes: 60, fixed: true, fixedStart: '10:00' }),
      task({ id: 'b', order: 2, estimatedMinutes: 60, fixed: true, fixedStart: '10:30' }),
    ];
    const result = generateSchedule(tasks, '09:00', '13:00');
    expect(result.fixedConflicts.slice().sort()).toEqual(['a', 'b']);
    expect(result.tasks).toEqual([]);
  });

  it('flags uma janela inválida (fim <= início) em vez de produzir uma agenda vazia silenciosamente', () => {
    const tasks = [task({ id: '1', order: 1, estimatedMinutes: 30 })];
    const result = generateSchedule(tasks, '20:00', '18:00');
    expect(result.invalidWindow).toBe(true);
    expect(result.tasks).toEqual([]);
  });

  it('gera 1000 combinações aleatórias sem produzir sobreposição nem tarefa fora da janela quando shortfall = 0', () => {
    for (let i = 0; i < 1000; i++) {
      const numFlexible = 1 + Math.floor(Math.random() * 4);
      const numFixed = Math.floor(Math.random() * 3);
      const allTasks: SchedulableTask[] = [];
      let order = 0;

      for (let f = 0; f < numFlexible; f++) {
        allTasks.push(task({
          id: `f${f}`,
          order: order++,
          estimatedMinutes: FLOOR_MINUTES + Math.floor(Math.random() * 110),
        }));
      }
      for (let x = 0; x < numFixed; x++) {
        const startMin = 9 * 60 + Math.floor(Math.random() * 10 * 60);
        allTasks.push(task({
          id: `x${x}`,
          order: order++,
          estimatedMinutes: FLOOR_MINUTES + Math.floor(Math.random() * 90),
          fixed: true,
          fixedStart: toHHMM(startMin),
        }));
      }

      const result = generateSchedule(allTasks, '09:00', '21:00');
      if (result.invalidWindow || result.fixedConflicts.length > 0) continue; // conflitos entre fixos aleatórios são esperados às vezes — rejeitados corretamente, nada pra checar aqui

      expect(result.tasks.map(t => t.id).sort()).toEqual(allTasks.map(t => t.id).sort());

      const intervals = result.tasks.map(t => [toMin(t.scheduledStart), toMin(t.scheduledEnd)] as const);
      for (const [start, end] of intervals) {
        expect(end).toBeGreaterThanOrEqual(start);
      }
      assertNoOverlaps(intervals);

      if (result.shortfallMinutes === 0) {
        for (const [start, end] of intervals) {
          expect(start).toBeGreaterThanOrEqual(toMin('09:00'));
          expect(end).toBeLessThanOrEqual(toMin('21:00'));
        }
      }
    }
  });
});

// ─── AUD-012 (Médio, resolvido na Sprint 3): a UI aceitava 5min mas o motor
// nunca comprimia abaixo de 10min — uma tarefa de 5min podia "crescer" pra
// 10 durante a compressão e gerar falta de tempo artificial. Corrigido
// unificando o mínimo em FLOOR_MINUTES na UI (AgendaPlanner.tsx) e no
// domínio (useAgendaState.ts's updateTaskDuration) — pelo lado do motor,
// o invariante é que ele nunca INVENTA minutos: uma tarefa já no piso nunca
// é comprimida abaixo dele, mesmo sob pressão severa.
describe('AUD-012 — piso de compressão consistente com o mínimo do domínio', () => {
  it('nunca comprime uma tarefa abaixo de FLOOR_MINUTES, mesmo quando não cabe tudo', () => {
    const tasks = [
      task({ id: 'small', order: 1, estimatedMinutes: FLOOR_MINUTES }),
      task({ id: 'big', order: 2, estimatedMinutes: 100 }),
    ];
    const result = generateSchedule(tasks, '09:00', '10:00'); // janela de 60min
    const small = result.tasks.find(t => t.id === 'small')!;
    expect(small.allottedMinutes).toBe(FLOOR_MINUTES);
    expect(result.shortfallMinutes).toBeGreaterThan(0);
  });
});
