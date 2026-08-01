// S6-09 (AUD-025): lets the owner pull their own data out of Supabase at
// any time, independent of any retention policy this app might apply later.
// Reads straight from Supabase (not Dexie) because Dexie only ever holds
// today's working set per domain — the full history across all days only
// exists server-side.
import { supabase } from './db';

export interface ExportedUserData {
  exportedAt: string;
  userId: string;
  items: unknown[];
  dayItems: unknown[];
  rotinaState: unknown[];
  rotinaSteps: unknown[];
  agendaTasks: unknown[];
}

export async function fetchUserDataForExport(userId: string): Promise<ExportedUserData> {
  const [items, dayItems, rotinaState, rotinaSteps, agendaTasks] = await Promise.all([
    supabase.from('mh_items').select('*'),
    supabase.from('mh_day_items').select('*'),
    supabase.from('mh_rotina_state').select('*'),
    supabase.from('mh_rotina_steps').select('*'),
    supabase.from('mh_agenda_tasks').select('*'),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    userId,
    items: items.data ?? [],
    dayItems: dayItems.data ?? [],
    rotinaState: rotinaState.data ?? [],
    rotinaSteps: rotinaSteps.data ?? [],
    agendaTasks: agendaTasks.data ?? [],
  };
}

export function downloadJSON(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
