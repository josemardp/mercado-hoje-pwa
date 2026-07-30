import { describe, it, expect, vi, afterEach } from 'vitest';
import { supabase } from '../db';
import { syncRotinaStepToSupabase } from '../rotinaDb';
import { syncAgendaTaskToSupabase } from '../agendaDb';

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── AUD-004 (Alto): as RPCs condicionais retornam `applied` (boolean) além
// de `error`. O cliente hoje só olha `error` — quando a escrita é
// legitimamente rejeitada por ser mais antiga (`applied === false`, sem
// erro), a função ainda assim reporta sucesso, e nada reconcilia o estado
// local. Documentado como esperado-falhar até a Sprint 2 tratar o booleano.
describe('AUD-004 — escrita rejeitada por LWW (applied=false) deve ser tratada como não sincronizada', () => {
  it.fails('Rotina: syncRotinaStepToSupabase deve retornar false quando a RPC rejeita por ser mais antiga', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: false, error: null } as never);
    const ok = await syncRotinaStepToSupabase({
      dayKey: '2026-07-30', stepId: 'xixi', done: true, updatedAt: 100, userId: 'user-1',
    });
    expect(ok).toBe(false);
  });

  it.fails('Agenda: syncAgendaTaskToSupabase deve retornar false quando a RPC rejeita por ser mais antiga', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: false, error: null } as never);
    const ok = await syncAgendaTaskToSupabase({
      id: 't1', dayKey: '2026-07-30', title: 'Tarefa', estimatedMinutes: 30,
      fixed: false, order: 0, done: false, deleted: false, updatedAt: 100, userId: 'user-1',
    });
    expect(ok).toBe(false);
  });
});

// ─── AUD-003 (Alto): marcar um item online dispara tanto o incremento
// atômico de use_count quanto uma entrada de fila 'mark' com valor absoluto
// — se a fila processar antes do incremento atômico responder, o contador
// pode ser somado duas vezes. Reproduzir isso exige orquestrar a ordem de
// duas chamadas de rede concorrentes contra o mock do Supabase; registrado
// como todo até a Sprint 2 decidir a estratégia única (idempotente).
describe.todo('AUD-003 — use_count não deve poder ser incrementado duas vezes para a mesma marcação online');
