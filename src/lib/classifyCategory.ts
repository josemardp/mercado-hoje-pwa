// Classificação local (sem rede, sem IA) do que o usuário digita na lista
// de Compras: devolve a categoria E o emoji do produto.
//
// Duas decisões de desenho que resolvem os problemas da versão anterior:
//
// 1. Categoria e emoji saem da MESMA entrada do dicionário. Antes o emoji
//    vinha de uma tabela por categoria, então todo item de mercearia era
//    🛒, todo item de casa era 🧻 e todo desconhecido era 📦 — nenhum
//    produto tinha cara própria na lista.
//
// 2. O casamento é por PALAVRA INTEIRA e a expressão mais específica
//    vence. Antes era `nome.includes(palavra)`, que classificava
//    "salsicha" como bebida (contém "cha"), "luva" como fruta (contém
//    "uva"), "aromatizante" como fruta (contém "roma") e "creme de leite"
//    como produto de limpeza (contém "creme").
//
// Este arquivo é o MOTOR. O dado (produtos, marcas, emojis) vive em
// productDictionary.ts, que cresce sem obrigar a reler a lógica.

import { PRODUCTS, HINTS, CATEGORY_FALLBACK, type CategoryKey, type ProductEntry } from './productDictionary';

export type { CategoryKey };

export interface ClassificationResult {
  category: string;
  emoji: string;
  emojiName: string;
}

// ─────────────────────────────────────────────────────────────────────
// Normalização
// ─────────────────────────────────────────────────────────────────────

// Palavras que não ajudam a identificar o produto e atrapalham o
// casamento por expressão ("creme de leite" vs "creme leite").
const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'com', 'sem', 'para', 'pra', 'pro',
  'a', 'o', 'as', 'os', 'um', 'uma', 'em', 'no', 'na', 'ao', 'tipo', 'sabor',
]);

// Embalagem e medida: "arroz 5kg tipo 1", "2 caixas de leite", "cerveja lata".
const UNITS = new Set([
  'kg', 'g', 'gr', 'grama', 'gramas', 'quilo', 'quilos', 'ml', 'l', 'lt',
  'litro', 'litros', 'un', 'und', 'unid', 'unidade', 'unidades', 'duzia',
  'pct', 'pacote', 'pacotes', 'cx', 'caixa', 'caixas', 'lata', 'latas',
  'garrafa', 'garrafas', 'saco', 'sacos', 'fardo', 'bandeja', 'pote', 'potes',
  'frasco', 'tubo', 'refil', 'sache', 'saches', 'rolo', 'rolos', 'dz',
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Plural pt-BR no que basta pra uma lista de compras: "bananas" → "banana",
// "limoes" → "limao", "papeis" → "papel", "ovos" → "ovo".
function singularize(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('oes')) return `${word.slice(0, -3)}ao`;
  if (word.endsWith('aes')) return `${word.slice(0, -3)}ao`;
  if (word.endsWith('ais')) return `${word.slice(0, -3)}al`;
  if (word.endsWith('eis')) return `${word.slice(0, -3)}el`;
  if (word.endsWith('ns')) return `${word.slice(0, -2)}m`;
  if (word.endsWith('res') || word.endsWith('zes') || word.endsWith('ses')) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

function cleanup(words: string[]): string[] {
  // "5kg", "500ml" grudados no número também são ruído.
  return words.map(w => w.replace(/^\d+(kg|g|ml|l|lt|un)$/, '')).filter(Boolean);
}

/**
 * Devolve DUAS leituras do nome, na ordem em que devem ser tentadas.
 *
 * A primeira preserva as palavras de embalagem, porque em vários produtos
 * elas fazem parte do nome ("saco plástico", "sachê para gato", "pote de
 * sorvete"). A segunda remove essas palavras, que é o que resolve
 * "6 latas de cerveja" ou "2 caixas de leite".
 *
 * Ordem importa: primeiro o nome inteiro, depois o nome sem embalagem.
 * O contrário faria "saco plástico" virar só "plástico".
 */
function readings(text: string): string[][] {
  const raw = normalize(text).split(' ').filter(Boolean);
  const withPackaging = cleanup(raw.filter(w => !STOPWORDS.has(w) && !/^\d+$/.test(w)));
  const withoutPackaging = cleanup(withPackaging.filter(w => !UNITS.has(w)));

  if (withoutPackaging.length === 0) return [withPackaging];
  if (withoutPackaging.length === withPackaging.length) return [withPackaging];
  return [withPackaging, withoutPackaging];
}

// ─────────────────────────────────────────────────────────────────────
// Índice e busca
// ─────────────────────────────────────────────────────────────────────

interface IndexedTerm { entry: ProductEntry; words: string[] }

// Termo normalizado (sem acento, sem palavra de ligação, no singular) →
// entrada. Montado uma vez, no primeiro uso.
const TERM_INDEX = new Map<string, IndexedTerm>();
const HINT_INDEX = new Map<string, { category: CategoryKey; emoji: string; label: string }>();
let MAX_TERM_WORDS = 1;

function indexKey(term: string): { key: string; words: string[] } {
  const words = normalize(term)
    .split(' ')
    .filter(w => w && !STOPWORDS.has(w))
    .map(singularize);
  return { key: words.join(' '), words };
}

function buildIndex(): void {
  if (TERM_INDEX.size > 0) return;
  for (const entry of PRODUCTS) {
    for (const term of entry.terms) {
      const { key, words } = indexKey(term);
      if (!key) continue;
      // Primeira entrada a registrar o termo vence: a ordem do dicionário
      // é a regra de desempate, então um termo repetido não muda de
      // categoria dependendo de onde foi lido.
      if (!TERM_INDEX.has(key)) TERM_INDEX.set(key, { entry, words });
      if (words.length > MAX_TERM_WORDS) MAX_TERM_WORDS = words.length;
    }
  }
  for (const hint of HINTS) {
    for (const term of hint.terms) {
      const { key } = indexKey(term);
      if (key && !HINT_INDEX.has(key)) HINT_INDEX.set(key, hint);
    }
  }
}

// Do trecho mais longo pro mais curto: "creme de leite" (3 palavras, vira
// "creme leite") é testado antes de "creme" sozinho, então a expressão
// mais específica sempre ganha.
//
// Dentro de um mesmo tamanho, produto ganha de marca: em "Camil feijão" a
// leitura da esquerda pra direita acharia "camil" (marca de arroz) antes
// de "feijão", e o item viraria arroz. A marca só decide quando é a única
// coisa reconhecida no nome ("Omo", "Nescau", "H2OH").
function findProduct(words: string[]): ProductEntry | null {
  const maxWindow = Math.min(MAX_TERM_WORDS, words.length);
  for (let size = maxWindow; size >= 1; size--) {
    let brandMatch: ProductEntry | null = null;
    for (let start = 0; start + size <= words.length; start++) {
      const hit = TERM_INDEX.get(words.slice(start, start + size).join(' '));
      if (!hit) continue;
      if (!hit.entry.brand) return hit.entry;
      brandMatch = brandMatch || hit.entry;
    }
    if (brandMatch) return brandMatch;
  }
  return null;
}

function classifyLocal(name: string): ClassificationResult {
  buildIndex();

  const allReadings = readings(name).map(words => words.map(singularize));

  for (const words of allReadings) {
    const entry = findProduct(words);
    if (entry) {
      return { category: entry.category, emoji: entry.emoji, emojiName: entry.label };
    }
  }

  for (const words of allReadings) {
    for (const word of words) {
      const hint = HINT_INDEX.get(word);
      if (hint) {
        return { category: hint.category, emoji: hint.emoji, emojiName: hint.label };
      }
    }
  }

  const fb = CATEGORY_FALLBACK.outros;
  return { category: 'outros', emoji: fb.emoji, emojiName: fb.label };
}

/**
 * Classifica um item pelo nome. Síncrona de propósito: é só busca em
 * memória, sem rede.
 */
export function classifyItemSync(itemName: string): ClassificationResult {
  return classifyLocal(itemName);
}

/**
 * `true` quando o nome bateu com algo de verdade no dicionário, e não
 * caiu no "Outros" por falta de correspondência. Quem faz correção
 * automática de itens antigos usa isso pra não mexer no que não conhece.
 */
export function isConfidentClassification(result: ClassificationResult): boolean {
  return result.category !== 'outros' || result.emoji !== CATEGORY_FALLBACK.outros.emoji;
}

/** Emoji genérico de uma categoria, pra quando o produto é desconhecido. */
export function fallbackEmojiForCategory(category: string): string {
  return (CATEGORY_FALLBACK[category as CategoryKey] || CATEGORY_FALLBACK.outros).emoji;
}

/** Todos os emojis genéricos — o que um item ganha quando não é reconhecido. */
export function isGenericEmoji(emoji: string | undefined): boolean {
  if (!emoji) return true;
  return Object.values(CATEGORY_FALLBACK).some(fb => fb.emoji === emoji);
}

/**
 * Reclassifica um item que já está no catálogo do usuário e devolve só o
 * que vale a pena corrigir — ou `null` quando não há nada a fazer.
 *
 * Existe porque a lista dele já tem itens gravados pela versão antiga,
 * todos com o emoji genérico da categoria (🛒/🧻/📦). Sem isso, só item
 * novo ganharia emoji próprio.
 *
 * Duas travas para nunca desfazer escolha do usuário:
 * - o emoji só é trocado quando o atual é um dos genéricos; emoji
 *   específico (inclusive os itens de exemplo da conta nova) fica como
 *   está;
 * - a categoria só muda quando o item está em "Outros", ou seja, quando
 *   o classificador antigo não reconheceu nada. Categoria que o usuário
 *   corrigiu à mão nunca é revista.
 */
export function upgradeItemClassification(item: { name: string; emoji?: string; category: string }): { emoji?: string; category?: string } | null {
  const result = classifyLocal(item.name);
  if (!isConfidentClassification(result)) return null;

  const upgrade: { emoji?: string; category?: string } = {};
  if (isGenericEmoji(item.emoji) && result.emoji !== item.emoji) {
    upgrade.emoji = result.emoji;
  }
  if (item.category === 'outros' && result.category !== 'outros') {
    upgrade.category = result.category;
  }

  return upgrade.emoji || upgrade.category ? upgrade : null;
}

// Mantida assíncrona porque App.tsx a consome com await desde a versão
// que chamava uma API externa; hoje resolve na hora.
export async function classifyItem(itemName: string): Promise<ClassificationResult> {
  return classifyLocal(itemName);
}
