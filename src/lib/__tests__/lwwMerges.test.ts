import { describe, it, expect } from 'vitest';
import { mergeDayItemsWithLWW, type DayItemRecord } from '../db';
import { mergeRotinaStateWithLWW } from '../rotinaDb';
import type { RotinaStepStateRecord } from '../db';
import { mergeAgendaTasksWithLWW } from '../agendaDb';
import type { AgendaTaskRecord } from '../db';

const USER = 'user-1';

function dayItem(partial: Partial<DayItemRecord> & Pick<DayItemRecord, 'itemId' | 'updatedAt'>): DayItemRecord {
  return {
    dayKey: '2026-07-30',
    checked: false,
    postponed: false,
    inToday: true,
    userId: USER,
    ...partial,
  };
}

describe('mergeDayItemsWithLWW', () => {
  it('keeps the item that was not present locally', () => {
    const merged = mergeDayItemsWithLWW([], [dayItem({ itemId: 'a', updatedAt: 100 })]);
    expect(merged).toHaveLength(1);
  });

  it('picks the newer of two conflicting rows for the same item', () => {
    const local = [dayItem({ itemId: 'a', updatedAt: 100, checked: false })];
    const remote = [dayItem({ itemId: 'a', updatedAt: 200, checked: true })];
    const merged = mergeDayItemsWithLWW(local, remote);
    expect(merged.find(i => i.itemId === 'a')?.checked).toBe(true);
  });

  it('keeps the local row when it is newer than the remote one', () => {
    const local = [dayItem({ itemId: 'a', updatedAt: 200, checked: true })];
    const remote = [dayItem({ itemId: 'a', updatedAt: 100, checked: false })];
    const merged = mergeDayItemsWithLWW(local, remote);
    expect(merged.find(i => i.itemId === 'a')?.checked).toBe(true);
  });

  // ─── AUD-001 (Crítico, resolvido na Sprint 1): reset agora tem um cutoff
  // server-side por user_id+day_key+domínio (ver resetDayDomain em db.ts e a
  // migration 20260801_add_reset_cutoffs.sql). O merge recebe esse cutoff
  // como terceiro argumento e descarta qualquer sobrevivente mais antigo que
  // ele — mesmo quando o remoto não tem mais linha nenhuma pra comparar.
  it('AUD-001: um item marcado antes de um reset não ressurge quando o remoto volta vazio, dado o cutoff do reset', () => {
    const staleLocal = [dayItem({ itemId: 'a', updatedAt: 100, checked: true })];
    // Remote vazio simula o estado pós-reset (a linha já foi apagada).
    const remoteAfterReset: DayItemRecord[] = [];
    const resetCutoff = 150; // reset aconteceu depois da escrita antiga (ts=100)
    const merged = mergeDayItemsWithLWW(staleLocal, remoteAfterReset, resetCutoff);
    expect(merged).toHaveLength(0);
  });

  it('AUD-001: um item escrito depois do cutoff do reset sobrevive mesmo com o remoto vazio', () => {
    const localAfterReset = [dayItem({ itemId: 'a', updatedAt: 200, checked: true })];
    const merged = mergeDayItemsWithLWW(localAfterReset, [], 150);
    expect(merged).toHaveLength(1);
  });
});

function rotinaState(partial: Partial<RotinaStepStateRecord> & Pick<RotinaStepStateRecord, 'stepId' | 'updatedAt'>): RotinaStepStateRecord {
  return { dayKey: '2026-07-30', done: false, userId: USER, ...partial };
}

describe('mergeRotinaStateWithLWW', () => {
  it('picks the newer of two conflicting rows for the same step', () => {
    const local = [rotinaState({ stepId: 'xixi', updatedAt: 100, done: false })];
    const remote = [rotinaState({ stepId: 'xixi', updatedAt: 200, done: true })];
    const merged = mergeRotinaStateWithLWW(local, remote);
    expect(merged.find(s => s.stepId === 'xixi')?.done).toBe(true);
  });

  // ─── AUD-001 (Crítico, resolvido na Sprint 1): mesmo cutoff de reset
  // aplicado à Rotina — ver os testes equivalentes em mergeDayItemsWithLWW acima.
  it('AUD-001: um passo marcado antes de um reset não ressurge quando o remoto volta vazio, dado o cutoff do reset', () => {
    const staleLocal = [rotinaState({ stepId: 'xixi', updatedAt: 100, done: true })];
    const merged = mergeRotinaStateWithLWW(staleLocal, [], 150);
    expect(merged).toHaveLength(0);
  });

  it('AUD-001: um passo marcado depois do cutoff do reset sobrevive mesmo com o remoto vazio', () => {
    const localAfterReset = [rotinaState({ stepId: 'xixi', updatedAt: 200, done: true })];
    const merged = mergeRotinaStateWithLWW(localAfterReset, [], 150);
    expect(merged).toHaveLength(1);
  });
});

function agendaTask(partial: Partial<AgendaTaskRecord> & Pick<AgendaTaskRecord, 'id' | 'updatedAt'>): AgendaTaskRecord {
  return {
    dayKey: '2026-07-30',
    title: 'Tarefa',
    estimatedMinutes: 30,
    fixed: false,
    order: 0,
    done: false,
    deleted: false,
    userId: USER,
    ...partial,
  };
}

describe('mergeAgendaTasksWithLWW', () => {
  it('keeps the newer edit when it conflicts with an older soft-delete', () => {
    const localDeleted = [agendaTask({ id: 't1', updatedAt: 100, deleted: true })];
    const remoteEdited = [agendaTask({ id: 't1', updatedAt: 200, deleted: false, title: 'Editado' })];
    const merged = mergeAgendaTasksWithLWW(localDeleted, remoteEdited);
    const winner = merged.find(t => t.id === 't1');
    expect(winner?.deleted).toBe(false);
    expect(winner?.title).toBe('Editado');
  });

  it('keeps a newer soft-delete over an older edit (tombstones behave correctly, unlike Compras/Rotina)', () => {
    const localEdited = [agendaTask({ id: 't1', updatedAt: 100, deleted: false })];
    const remoteDeleted = [agendaTask({ id: 't1', updatedAt: 200, deleted: true })];
    const merged = mergeAgendaTasksWithLWW(localEdited, remoteDeleted);
    expect(merged.find(t => t.id === 't1')?.deleted).toBe(true);
  });
});
