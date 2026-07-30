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

  // ─── AUD-001 (Crítico): reset não tem tombstone. Um dispositivo B com
  // cópia local antiga, ao reconectar depois de um reset em A, não deveria
  // ressuscitar o item — mas o merge de união não tem como saber que a
  // ausência no remoto significa "apagado por reset" em vez de "nunca
  // sincronizado". Documentado como esperado-falhar até a Sprint 1 criar
  // tombstone/cutoff de reset.
  it.fails('AUD-001: um item marcado antes de um reset não deve ressurgir quando o remoto voltar vazio', () => {
    const staleLocal = [dayItem({ itemId: 'a', updatedAt: 100, checked: true })];
    // Remote vazio simula o estado pós-reset (sem tombstone hoje).
    const remoteAfterReset: DayItemRecord[] = [];
    const merged = mergeDayItemsWithLWW(staleLocal, remoteAfterReset);
    expect(merged).toHaveLength(0);
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
