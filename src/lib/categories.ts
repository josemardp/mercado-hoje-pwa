export interface Category {
  key: string;
  name: string;
  emoji: string;
  color: string;
  bgColor: string;
}

// Colors reference CSS custom properties (defined in index.css :root and
// overridden under prefers-color-scheme: dark) instead of literal hex, so
// category accents stay WCAG-AA-safe and legible in both themes.
export const CATEGORIES: Category[] = [
  // Chave continua 'frutas' (é o que está gravado no banco e nas linhas do
  // dia); só o rótulo mudou, porque a categoria sempre recebeu também
  // verdura, legume e tempero fresco — ver classifyCategory.ts.
  { key: 'frutas', name: 'Hortifrúti', emoji: '🥬', color: 'var(--cat-frutas)', bgColor: 'var(--cat-frutas-bg)' },
  { key: 'bebidas', name: 'Bebidas', emoji: '🥤', color: 'var(--cat-bebidas)', bgColor: 'var(--cat-bebidas-bg)' },
  { key: 'mercearia', name: 'Mercearia', emoji: '🛒', color: 'var(--cat-mercearia)', bgColor: 'var(--cat-mercearia-bg)' },
  { key: 'casa', name: 'Casa & Higiene', emoji: '🧻', color: 'var(--cat-casa)', bgColor: 'var(--cat-casa-bg)' },
  { key: 'outros', name: 'Outros', emoji: '🎈', color: 'var(--cat-outros)', bgColor: 'var(--cat-outros-bg)' },
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
