// Rotina steps are now user-editable at runtime (see useRotinaStepDefs.ts /
// rotinaStepDefsDb.ts, backed by the mh_rotina_steps table) — this array is
// no longer the rendered list, RotinaTab.tsx reads from that hook instead.
// It survives as the literal SEED data: seedDefaultRotinaSteps() copies it
// verbatim (same ids/titles/emojis/order) into a user's first-ever step
// list, so already-recorded completion history (keyed against these exact
// ids) keeps lining up after the switch to the editable table.
export type SkyPeriod = 'dawn' | 'morning' | 'afternoon' | 'dusk' | 'night';

export interface RotinaStep {
  id: string; // stable slug — becomes stepId in Dexie/Supabase, never rename once shipped
  order: number;
  title: string;
  emoji: string;
  period: SkyPeriod;
}

export const ROTINA_STEPS: RotinaStep[] = [
  // Ao acordar: xixi, pesar, remédios da manhã e oração, todos em sequência
  // antes de vestir/arrumar.
  { id: 'xixi', order: 1, title: 'Xixi', emoji: '🚽', period: 'morning' },
  { id: 'pesar-se', order: 2, title: 'Pesar-se', emoji: '⚖️', period: 'morning' },
  { id: 'remedio-1', order: 3, title: 'Remédio 1', emoji: '💊', period: 'morning' },
  { id: 'remedio-2', order: 4, title: 'Remédio 2', emoji: '💊', period: 'morning' },
  { id: 'remedio-3', order: 5, title: 'Remédio 3', emoji: '💊', period: 'morning' },
  { id: 'pausa-manha', order: 6, title: 'Pausa', emoji: '🧘', period: 'morning' },
  { id: 'roupa-paisano', order: 7, title: 'Roupa paisano', emoji: '👕', period: 'morning' },
  { id: 'banho-barba', order: 8, title: 'Banho e barba', emoji: '🚿', period: 'morning' },
  { id: 'arrumar-farda', order: 9, title: 'Arrumar farda', emoji: '🎽', period: 'morning' },
  { id: 'fazer-cafe', order: 10, title: 'Fazer café', emoji: '☕', period: 'morning' },
  { id: 'ir-ao-pc', order: 11, title: 'Ir ao PC', emoji: '💻', period: 'morning' },
  { id: 'comprar-vinho', order: 12, title: 'Comprar vinho', emoji: '🍷', period: 'morning' },
  // Noite: remédio e oração antes de dormir.
  { id: 'remedio-noite', order: 13, title: 'Remédio da noite', emoji: '💊', period: 'night' },
  { id: 'pausa-noite', order: 14, title: 'Pausa', emoji: '🧘', period: 'night' },
];
