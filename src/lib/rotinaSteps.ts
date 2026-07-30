export type SkyPeriod = 'dawn' | 'morning' | 'afternoon' | 'dusk' | 'night';

export interface RotinaStep {
  id: string; // stable slug — becomes stepId in Dexie/Supabase, never rename once shipped
  order: number;
  title: string;
  emoji: string;
  period: SkyPeriod;
}

export const ROTINA_STEPS: RotinaStep[] = [
  { id: 'xixi', order: 1, title: 'Xixi', emoji: '🚽', period: 'morning' },
  { id: 'pesar-se', order: 2, title: 'Pesar-se', emoji: '⚖️', period: 'morning' },
  { id: 'remedio-1', order: 3, title: 'Remédio 1', emoji: '💊', period: 'morning' },
  { id: 'roupa-paisano', order: 4, title: 'Roupa paisano', emoji: '👕', period: 'morning' },
  { id: 'banho-barba', order: 5, title: 'Banho e barba', emoji: '🚿', period: 'morning' },
  { id: 'remedio-2', order: 6, title: 'Remédio 2', emoji: '💊', period: 'morning' },
  { id: 'arrumar-farda', order: 7, title: 'Arrumar farda', emoji: '🎽', period: 'morning' },
  { id: 'fazer-cafe', order: 8, title: 'Fazer café', emoji: '☕', period: 'morning' },
  { id: 'ir-ao-pc', order: 9, title: 'Ir ao PC', emoji: '💻', period: 'morning' },
  { id: 'comprar-vinho', order: 10, title: 'Comprar vinho', emoji: '🍷', period: 'morning' },
];

export function getRotinaStepById(id: string): RotinaStep | undefined {
  return ROTINA_STEPS.find(s => s.id === id);
}
