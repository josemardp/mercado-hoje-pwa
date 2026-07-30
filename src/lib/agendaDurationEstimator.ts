// Local, offline duration guesser for Agenda tasks - same spirit as
// classifyCategory.ts's local PT-BR dictionary (no network/AI call). This is
// a rough starting point, always meant to be edited by the user before
// generating a schedule, not a precise predictor (it has no way to know a
// pharmacy has a long queue or a shop is far away).

const FLOOR_MINUTES = 10;
const SHOPPING_MINUTES_BASE = 12;
const SHOPPING_MINUTES_PER_ITEM = 8;
const SHOPPING_MINUTES_CAP = 60;
const DESKWORK_MINUTES = 60; // planejamento, reuniao, redacao
const ERRAND_MINUTES = 30; // recado simples fora de casa
const DEFAULT_MINUTES = 30;

const SHOPPING_KEYWORDS = ['comprar', 'compras', 'mercado', 'farmacia', 'loja'];
const DESKWORK_KEYWORDS = [
  'planejar', 'planejamento', 'operacao', 'reuniao', 'relatorio',
  'redigir', 'elaborar', 'estudar', 'revisar', 'analisar', 'organizar',
];
const ERRAND_KEYWORDS = [
  'levar', 'buscar', 'pegar', 'pagar', 'ir ao', 'ir a ', 'deixar',
  'passar no', 'passar na', 'entregar', 'retirar', 'consertar',
];

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function splitEnumeration(title: string): string[] {
  return title.split(/,| e | ou /i).map(s => s.trim()).filter(Boolean);
}

export function estimateDurationMinutes(title: string): number {
  const n = normalize(title);
  const items = splitEnumeration(title);

  if (SHOPPING_KEYWORDS.some(k => n.includes(k)) || items.length > 1) {
    return Math.min(
      SHOPPING_MINUTES_CAP,
      SHOPPING_MINUTES_BASE + SHOPPING_MINUTES_PER_ITEM * Math.max(items.length, 1),
    );
  }
  if (DESKWORK_KEYWORDS.some(k => n.includes(k))) return DESKWORK_MINUTES;
  if (ERRAND_KEYWORDS.some(k => n.includes(k))) return ERRAND_MINUTES;
  return DEFAULT_MINUTES;
}

export { FLOOR_MINUTES };
