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
  { id: 'tomar-puran', order: 3, title: 'Tomar Puran', emoji: '💊', period: 'morning' },
  { id: 'tomar-venlafaxina', order: 4, title: 'Tomar Venlafaxina', emoji: '💊', period: 'morning' },
  { id: 'tomar-losartana', order: 5, title: 'Tomar Losartana', emoji: '💊', period: 'morning' },
  { id: 'orar-manha', order: 6, title: 'Orar', emoji: '🙏', period: 'morning' },
  { id: 'roupa-paisano', order: 7, title: 'Roupa paisano', emoji: '👕', period: 'morning' },
  { id: 'banho-barba', order: 8, title: 'Banho e barba', emoji: '🚿', period: 'morning' },
  { id: 'arrumar-farda', order: 9, title: 'Arrumar farda', emoji: '🎽', period: 'morning' },
  { id: 'fazer-cafe', order: 10, title: 'Fazer café', emoji: '☕', period: 'morning' },
  { id: 'ir-ao-pc', order: 11, title: 'Ir ao PC', emoji: '💻', period: 'morning' },
  { id: 'comprar-vinho', order: 12, title: 'Comprar vinho', emoji: '🍷', period: 'morning' },
  // Noite: remédio e oração antes de dormir.
  { id: 'tomar-lamitor', order: 13, title: 'Tomar Lamitor', emoji: '💊', period: 'night' },
  { id: 'orar-noite', order: 14, title: 'Orar', emoji: '🙏', period: 'night' },
];

export function getRotinaStepById(id: string): RotinaStep | undefined {
  return ROTINA_STEPS.find(s => s.id === id);
}
