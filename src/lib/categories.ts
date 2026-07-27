export interface Category {
  key: string;
  name: string;
  emoji: string;
  color: string;
  bgColor: string;
}

export const CATEGORIES: Category[] = [
  { key: 'frutas', name: 'Frutas', emoji: '🍇', color: '#2F9E44', bgColor: '#E7F5EA' },
  { key: 'bebidas', name: 'Bebidas', emoji: '🥤', color: '#1E88A8', bgColor: '#E4F2F6' },
  { key: 'mercearia', name: 'Mercearia', emoji: '🛒', color: '#C98A2C', bgColor: '#FBF0DC' },
  { key: 'casa', name: 'Casa & Higiene', emoji: '🧻', color: '#7C5CBF', bgColor: '#F1ECFA' },
  { key: 'outros', name: 'Outros', emoji: '🎈', color: '#D6488A', bgColor: '#FBEAF1' },
];

export function getCategoryByKey(key: string): Category | undefined {
  return CATEGORIES.find(c => c.key === key);
}

export function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateBR(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
