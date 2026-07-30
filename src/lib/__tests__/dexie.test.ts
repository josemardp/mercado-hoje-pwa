import { describe, it, expect } from 'vitest';
import { db, getLocalResetCutoff, setLocalResetCutoff } from '../db';

describe('Dexie schema (fake-indexeddb)', () => {
  it('opens the database and exposes every table across the version chain (2→3→4→5→6)', async () => {
    await db.open();
    expect(db.isOpen()).toBe(true);
    expect(db.tables.map(t => t.name).sort()).toEqual([
      'agendaSyncQueue',
      'agendaTasks',
      'dayItems',
      'items',
      'resetCutoffs',
      'rotinaStepState',
      'rotinaSyncQueue',
      'syncQueue',
    ]);
  });

  it('round-trips a grocery item through the local store', async () => {
    await db.items.put({
      id: 'test-item-1',
      name: 'Teste',
      category: 'outros',
      useCount: 0,
      userId: 'user-1',
    });
    const found = await db.items.get('test-item-1');
    expect(found?.name).toBe('Teste');
    await db.items.delete('test-item-1');
  });

  it('round-trips an agenda task keyed only by id', async () => {
    await db.agendaTasks.put({
      id: 'task-1',
      dayKey: '2026-07-30',
      title: 'Tarefa de teste',
      estimatedMinutes: 30,
      fixed: false,
      order: 0,
      done: false,
      deleted: false,
      updatedAt: Date.now(),
      userId: 'user-1',
    });
    const found = await db.agendaTasks.get('task-1');
    expect(found?.title).toBe('Tarefa de teste');
    await db.agendaTasks.delete('task-1');
  });

  // ─── AUD-009 (Alto, resolvido na Sprint 2): a chave composta da Rotina
  // agora é [dayKey+stepId+userId] — duas contas no mesmo navegador não
  // colidem mais na mesma linha local pro mesmo passo/dia.
  it('AUD-009: duas contas diferentes têm linhas locais separadas para o mesmo passo/dia da Rotina', async () => {
    await db.rotinaStepState.put({
      dayKey: '2026-07-30', stepId: 'xixi', done: true, updatedAt: 100, userId: 'user-a',
    });
    await db.rotinaStepState.put({
      dayKey: '2026-07-30', stepId: 'xixi', done: false, updatedAt: 200, userId: 'user-b',
    });
    const rowsForToday = await db.rotinaStepState.where('dayKey').equals('2026-07-30').toArray();
    expect(rowsForToday.filter(r => r.stepId === 'xixi')).toHaveLength(2);
    await db.rotinaStepState.where('dayKey').equals('2026-07-30').delete();
  });

  // ─── S1-05/S1-06 (Sprint 1, AUD-001): cutoff local nunca deve andar pra
  // trás — uma resposta atrasada de rede (ex.: uma chamada de get_reset_cutoff
  // que demorou e chega depois de um reset mais recente) não pode reabrir uma
  // janela já fechada por um cutoff mais novo.
  it('setLocalResetCutoff never moves the cutoff backwards', async () => {
    await setLocalResetCutoff('user-1', '2026-07-30', 'compras', 200);
    await setLocalResetCutoff('user-1', '2026-07-30', 'compras', 100);
    expect(await getLocalResetCutoff('user-1', '2026-07-30', 'compras')).toBe(200);
    await db.resetCutoffs.delete(['user-1', '2026-07-30', 'compras']);
  });

  it('setLocalResetCutoff advances the cutoff when the new value is newer', async () => {
    await setLocalResetCutoff('user-1', '2026-07-30', 'rotina', 100);
    await setLocalResetCutoff('user-1', '2026-07-30', 'rotina', 200);
    expect(await getLocalResetCutoff('user-1', '2026-07-30', 'rotina')).toBe(200);
    await db.resetCutoffs.delete(['user-1', '2026-07-30', 'rotina']);
  });
});
