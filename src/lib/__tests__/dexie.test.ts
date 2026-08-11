import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { db, getLocalResetCutoff, setLocalResetCutoff, selectCarryOverItems } from '../db';

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

  // ─── Regra do carry-over de Compras: só volta pro dia seguinte o que foi
  // explicitamente ADIADO. Item comprado fica nos concluídos do dia da
  // compra e não pode reaparecer como pendente (bug relatado), e item que
  // ficou só pendente, sem adiar, também não é arrastado. A query varre
  // todo dayKey < hoje (não só o mais recente), pra cobrir vários dias sem
  // abrir o app, e selectCarryOverItems resolve a linha mais recente de
  // cada item antes de decidir.
  it('só itens adiados voltam no dia seguinte; comprados e pendentes-sem-adiar não', async () => {
    const userId = 'user-carryover';
    const today = '2026-08-01';
    await db.dayItems.bulkAdd([
      // pendente, nunca adiado — não volta
      { dayKey: '2026-07-30', itemId: 'arroz', checked: false, postponed: false, inToday: true, updatedAt: 100, userId },
      // comprado — não volta
      { dayKey: '2026-07-30', itemId: 'feijao', checked: true, postponed: false, inToday: true, updatedAt: 100, userId },
      // adiado — volta
      { dayKey: '2026-07-31', itemId: 'leite', checked: false, postponed: true, inToday: false, updatedAt: 200, userId },
      // adiado em 07-29 e comprado em 07-31, cada dia na sua própria linha
      // (nada atualiza a antiga): a linha velha "adiado / não comprado"
      // ainda existe no banco e não pode ressuscitar o item.
      { dayKey: '2026-07-29', itemId: 'acucar', checked: false, postponed: true, inToday: false, updatedAt: 50, userId },
      { dayKey: '2026-07-31', itemId: 'acucar', checked: true, postponed: false, inToday: true, updatedAt: 400, userId },
      // adiado em 07-29, voltou como pendente em 07-31 e ficou sem comprar:
      // a linha mais recente não está adiada, então não volta de novo.
      { dayKey: '2026-07-29', itemId: 'cafe', checked: false, postponed: true, inToday: false, updatedAt: 60, userId },
      { dayKey: '2026-07-31', itemId: 'cafe', checked: false, postponed: false, inToday: true, updatedAt: 300, userId },
    ]);

    const staleItems = await db.dayItems
      .where('dayKey')
      .below(today)
      .and(item => item.userId === userId)
      .toArray();

    const toCarry = selectCarryOverItems(staleItems);

    expect(toCarry.map(item => item.itemId)).toEqual(['leite']);
    expect(toCarry[0].dayKey).toBe('2026-07-31');

    await db.dayItems.where('userId').equals(userId).delete();
  });

  // Linha remota desatualizada não ressuscita item já comprado: a compra
  // foi marcada neste aparelho (linha local mais nova) mas o sync ainda não
  // subiu, então o Supabase continua devolvendo a linha antiga "adiado".
  it('carry-over com linhas local+remota misturadas: a mais recente do item vence', () => {
    const userId = 'user-carryover-lww';
    const remota = { dayKey: '2026-07-31', itemId: 'leite', checked: false, postponed: true, inToday: false, updatedAt: 200, userId };
    const local = { dayKey: '2026-07-31', itemId: 'leite', checked: true, postponed: true, inToday: true, updatedAt: 500, userId };

    expect(selectCarryOverItems([remota])).toHaveLength(1);
    expect(selectCarryOverItems([local, remota])).toEqual([]);
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
