import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { db, getLocalResetCutoff, setLocalResetCutoff } from '../db';

describe('Dexie schema (fake-indexeddb)', () => {
  it('opens the database and exposes every table across the version chain (2→3→4→5→6→7)', async () => {
    await db.open();
    expect(db.isOpen()).toBe(true);
    expect(db.tables.map(t => t.name).sort()).toEqual([
      'agendaSyncQueue',
      'agendaTasks',
      'dayItems',
      'items',
      'resetCutoffs',
      'rotinaStepStateByUser',
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
    await db.rotinaStepStateByUser.put({
      dayKey: '2026-07-30', stepId: 'xixi', done: true, updatedAt: 100, userId: 'user-a',
    });
    await db.rotinaStepStateByUser.put({
      dayKey: '2026-07-30', stepId: 'xixi', done: false, updatedAt: 200, userId: 'user-b',
    });
    const rowsForToday = await db.rotinaStepStateByUser.where('dayKey').equals('2026-07-30').toArray();
    expect(rowsForToday.filter(r => r.stepId === 'xixi')).toHaveLength(2);
    await db.rotinaStepStateByUser.where('dayKey').equals('2026-07-30').delete();
  });

  // ─── Regressão do bug de produção (30/07/2026): a Sprint 2 tentou trocar
  // a chave primária de rotinaStepState numa única versão do Dexie —
  // IndexedDB não permite isso ("Not yet support for changing primary
  // key"), e a versão quebrava pra qualquer pessoa que já tivesse o banco
  // local instalado na v3/v5, travando o app pra sempre com "Erro ao
  // carregar os dados". Reproduz o cenário real: um banco JÁ EXISTENTE na
  // v3 (schema pré-Sprint-2), depois reaberto com a definição atual
  // completa (v2→v7) — precisa migrar sem lançar exceção.
  it('abre sem erro um banco que já existia na v3 (pré-userId) e migra os dados pra rotinaStepStateByUser', async () => {
    const dbName = 'MercadoHoje_regressao_v3_para_v7';

    const oldDb = new Dexie(dbName);
    oldDb.version(2).stores({
      items: 'id, name, category, lastUsed, useCount, userId',
      dayItems: '[dayKey+itemId], dayKey, itemId, checked, postponed, inToday, updatedAt, userId',
      syncQueue: '++id, type, dayKey, timestamp',
    });
    oldDb.version(3).stores({
      rotinaStepState: '[dayKey+stepId], dayKey, stepId, done, updatedAt, userId',
      rotinaSyncQueue: '++id, type, dayKey, timestamp',
    });
    await oldDb.open();
    await oldDb.table('rotinaStepState').put({
      dayKey: '2026-07-30', stepId: 'xixi', done: true, updatedAt: 100, userId: 'user-1',
    });
    oldDb.close();

    const upgradedDb = new Dexie(dbName);
    upgradedDb.version(2).stores({
      items: 'id, name, category, lastUsed, useCount, userId',
      dayItems: '[dayKey+itemId], dayKey, itemId, checked, postponed, inToday, updatedAt, userId',
      syncQueue: '++id, type, dayKey, timestamp',
    });
    upgradedDb.version(3).stores({
      rotinaStepState: '[dayKey+stepId], dayKey, stepId, done, updatedAt, userId',
      rotinaSyncQueue: '++id, type, dayKey, timestamp',
    });
    upgradedDb.version(4).stores({
      agendaTasks: 'id, dayKey, userId, order, done, deleted, updatedAt',
      agendaSyncQueue: '++id, type, taskId, timestamp',
    });
    upgradedDb.version(5).stores({
      resetCutoffs: '[userId+dayKey+domain]',
    });
    upgradedDb.version(6).stores({
      syncQueue: '++id, type, dayKey, timestamp, userId',
      rotinaStepStateByUser: '[dayKey+stepId+userId], dayKey, stepId, done, updatedAt, userId',
      rotinaSyncQueue: '++id, type, dayKey, timestamp, userId',
      agendaSyncQueue: '++id, type, taskId, timestamp, userId',
    }).upgrade(async tx => {
      const rows = await tx.table('rotinaStepState').toArray();
      await tx.table('rotinaStepStateByUser').bulkAdd(rows);
    });
    upgradedDb.version(7).stores({
      rotinaStepState: null,
    });

    await expect(upgradedDb.open()).resolves.toBeDefined();
    const migrated = await upgradedDb.table('rotinaStepStateByUser').get(['2026-07-30', 'xixi', 'user-1']);
    expect(migrated?.done).toBe(true);
    expect(upgradedDb.tables.map(t => t.name)).not.toContain('rotinaStepState');

    upgradedDb.close();
    await Dexie.delete(dbName);
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
