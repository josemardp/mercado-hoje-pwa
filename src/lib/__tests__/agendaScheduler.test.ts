import { describe, it, expect } from 'vitest';
import { generateSchedule, formatDurationLabel, type SchedulableTask } from '../agendaScheduler';

function task(partial: Partial<SchedulableTask> & Pick<SchedulableTask, 'id' | 'order' | 'estimatedMinutes'>): SchedulableTask {
  return { fixed: false, done: false, ...partial };
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

  it('reports a shortfall instead of pretending an impossible schedule fits', () => {
    const tasks = [
      task({ id: '1', order: 1, estimatedMinutes: 60 }),
      task({ id: '2', order: 2, estimatedMinutes: 90, fixed: true, fixedStart: '18:00' }),
    ];
    const result = generateSchedule(tasks, '17:00', '19:00');
    expect(result.shortfallMinutes).toBeGreaterThan(0);
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

// ─── AUD-002 (Crítico): o motor pode gerar sobreposição real e reportar
// shortfall=0 mesmo quando uma tarefa flexível avança sobre um compromisso
// fixo no meio da janela. Cenário exato da auditoria: janela 09:00–12:00,
// tarefa flexível de 120min, fixo às 10:00 por 30min.
// Este teste documenta o comportamento CORRETO esperado (sem sobreposição)
// e é esperado falhar até a Sprint 3 reescrever o motor por gaps livres.
describe('AUD-002 — não deve haver sobreposição com compromisso fixo no meio da janela', () => {
  it.fails('nenhum par de tarefas geradas deve se sobrepor', () => {
    const tasks = [
      task({ id: 'flex', order: 1, estimatedMinutes: 120 }),
      task({ id: 'fixo', order: 2, estimatedMinutes: 30, fixed: true, fixedStart: '10:00' }),
    ];
    const result = generateSchedule(tasks, '09:00', '12:00');
    const toMin = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    };
    const intervals = result.tasks.map(t => [toMin(t.scheduledStart), toMin(t.scheduledEnd)] as const);
    for (let i = 0; i < intervals.length; i++) {
      for (let j = i + 1; j < intervals.length; j++) {
        const [aStart, aEnd] = intervals[i];
        const [bStart, bEnd] = intervals[j];
        const overlaps = aStart < bEnd && bStart < aEnd;
        expect(overlaps).toBe(false);
      }
    }
  });
});

// ─── AUD-012 (Médio): a UI aceita 5min mas o motor nunca comprime abaixo de
// 10min — uma tarefa de 5min pode "crescer" pra 10 durante a compressão e
// gerar falta de tempo artificial. Documentado aqui como todo (a correção
// de piso consistente é escopo da Sprint 3).
describe('AUD-012 — piso de compressão inconsistente com o mínimo da UI', () => {
  it.todo('uma tarefa de 5min não deveria crescer pra 10min durante a compressão');
});
