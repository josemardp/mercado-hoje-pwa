import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { db, getLocalResetCutoff, setLocalResetCutoff } from '../db';

describe('Dexie schema (fake-indexeddb)', () => {
  it('opens the database and exposes every table across the version chain (2→3→4→5→6→7→8→9→10)', async () => {
    await db.open();
    expect(db.isOpen()).toBe(true);
    expect(db.tables.map(t => t.name).sort()).toEqual([
      'agendaGoSessions',
      'agendaSyncQueue',
      'agendaTasks',
      'dayItems',
      'items',
      'resetCutoffs',
      'rotinaStepDefSyncQueue',
      'rotinaStepDefs',
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

  // ─── Regressão: itens da lista de Compras que não foram comprados nem
  // marcados como "adiados" sumiam na virada do dia — useDayState só
  // carregava itens do dayKey de hoje e só arrastava pro dia seguinte quem
  // tinha postponed=true, então um item só "na lista" (nem comprado, nem
  // adiado) ficava preso pra sempre no dayKey de ontem. Este teste cobre a
  // query que a correção usa: varrer todo dayKey < hoje (não só o mais
  // recente) e trazer tudo que não foi comprado, deduplicando por item.
  it('itens não comprados de qualquer dia anterior (adiados ou não) são candidatos a carry-over; comprados não', async () => {
    const userId = 'user-carryover';
    const today = '2026-08-01';
    await db.dayItems.bulkAdd([
      { dayKey: '2026-07-30', itemId: 'arroz', checked: false, postponed: false, inToday: true, updatedAt: 100, userId },
      { dayKey: '2026-07-30', itemId: 'feijao', checked: true, postponed: false, inToday: true, updatedAt: 100, userId },
      { dayKey: '2026-07-31', itemId: 'leite', checked: false, postponed: true, inToday: false, updatedAt: 200, userId },
      { dayKey: '2026-07-31', itemId: 'arroz', checked: false, postponed: false, inToday: true, updatedAt: 300, userId },
    ]);

    const staleItems = await db.dayItems
      .where('dayKey')
      .below(today)
      .and(item => item.userId === userId)
      .toArray();

    const notBought = new Map<string, (typeof staleItems)[number]>();
    for (const item of staleItems) {
      if (item.checked) continue;
      const existing = notBought.get(item.itemId);
      if (!existing || item.updatedAt > existing.updatedAt) {
        notBought.set(item.itemId, item);
      }
    }

    expect([...notBought.keys()].sort()).toEqual(['arroz', 'leite']);
    // 'arroz' appears in two stale days — the more recent (07-31) row wins.
    expect(notBought.get('arroz')?.dayKey).toBe('2026-07-31');
    // 'feijao' was bought (checked=true), so it must never come back.
    expect(notBought.has('feijao')).toBe(false);

    await db.dayItems.where('userId').equals(userId).delete();
  });

  // ─── Regressão preventiva estilo AUD-009: rotinaStepDefs guarda as
  // DEFINIÇÕES dos passos da Rotina (título/emoji/período/ordem), editáveis
  // pelo usuário. Os ids de seed são slugs fixos compartilhados ('xixi',
  // 'pesar-se', ...), não uuid — exatamente a mesma situação que já causou
  // colisão entre duas contas no mesmo navegador em rotinaStepStateByUser
  // (chave trocada de [dayKey+stepId] pra [dayKey+stepId+userId]). Esta
  // tabela nasceu direto com chave composta [id+userId] pra nunca repetir
  // esse bug — este teste confirma que duas contas no mesmo navegador nunca
  // colidem na mesma linha local pro mesmo passo.
  it('AUD-009-like: duas contas diferentes têm linhas locais separadas para o mesmo passo (mesmo id) da Rotina', async () => {
    await db.rotinaStepDefs.put({
      id: 'xixi', title: 'Xixi', emoji: '🚽', period: 'morning', order: 1, deleted: false, updatedAt: 100, userId: 'user-a',
    });
    await db.rotinaStepDefs.put({
      id: 'xixi', title: 'Ir ao banheiro', emoji: '🚽', period: 'morning', order: 1, deleted: false, updatedAt: 200, userId: 'user-b',
    });
    const rowsForXixi = await db.rotinaStepDefs.where('id').equals('xixi').toArray();
    expect(rowsForXixi).toHaveLength(2);
    expect(rowsForXixi.find(r => r.userId === 'user-a')?.title).toBe('Xixi');
    expect(rowsForXixi.find(r => r.userId === 'user-b')?.title).toBe('Ir ao banheiro');
    await db.rotinaStepDefs.where('id').equals('xixi').delete();
  });
});
