import { describe, it, expect } from 'vitest';
import { PRODUCTS, HINTS, CATEGORY_FALLBACK, type CategoryKey } from '../productDictionary';
import { classifyItemSync } from '../classifyCategory';

// O dicionário vai crescer pra milhares de termos, escritos à mão em
// várias sessões. Estes testes são a rede de segurança dessa expansão:
// pegam o erro que passa despercebido na revisão visual (termo repetido
// em duas categorias, acento esquecido, entrada sem emoji) e que só
// apareceria como classificação errada no celular.

const VALID_CATEGORIES: CategoryKey[] = ['frutas', 'bebidas', 'mercearia', 'casa', 'outros'];

function normalize(term: string): string {
  return term.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

describe('dicionário de produtos — integridade', () => {
  it('toda entrada tem emoji, rótulo, categoria válida e ao menos um termo', () => {
    for (const entry of PRODUCTS) {
      expect(entry.emoji, `entrada "${entry.label}" sem emoji`).toBeTruthy();
      expect(entry.label, 'entrada sem rótulo').toBeTruthy();
      expect(VALID_CATEGORIES, `categoria inválida em "${entry.label}"`).toContain(entry.category);
      expect(entry.terms.length, `entrada "${entry.label}" sem termos`).toBeGreaterThan(0);
    }
  });

  it('nenhum termo aparece em duas entradas', () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const entry of PRODUCTS) {
      for (const term of entry.terms) {
        const key = normalize(term);
        const owner = seen.get(key);
        if (owner) {
          duplicates.push(`"${term}" está em "${owner}" e em "${entry.label}"`);
        } else {
          seen.set(key, entry.label);
        }
      }
    }
    expect(duplicates).toEqual([]);
  });

  it('termos são escritos sem acento e em minúscula', () => {
    const malformed: string[] = [];
    for (const entry of PRODUCTS) {
      for (const term of entry.terms) {
        if (term !== normalize(term)) malformed.push(`${entry.label}: "${term}"`);
      }
    }
    expect(malformed).toEqual([]);
  });

  it('nenhum termo é palavra de ligação ou unidade sozinha', () => {
    // Um termo assim casaria com quase tudo e sequestraria a classificação.
    const forbidden = new Set(['de', 'da', 'do', 'com', 'sem', 'kg', 'g', 'ml', 'l', 'un', 'caixa', 'pacote', 'lata']);
    const offenders = PRODUCTS.flatMap(e => e.terms.filter(t => forbidden.has(normalize(t))).map(t => `${e.label}: ${t}`));
    expect(offenders).toEqual([]);
  });

  it('todo termo cadastrado é encontrado pelo motor', () => {
    // Fecha o ciclo dado ↔ motor: um termo que a normalização engole
    // (só unidade, só número, só palavra de ligação) nunca classificaria
    // nada, e ficaria no arquivo dando falsa sensação de cobertura.
    const unreachable: string[] = [];
    for (const entry of PRODUCTS) {
      for (const term of entry.terms) {
        const result = classifyItemSync(term);
        if (result.emoji !== entry.emoji || result.category !== entry.category) {
          unreachable.push(`"${term}" (${entry.label}) caiu em ${result.category} ${result.emoji}`);
        }
      }
    }
    expect(unreachable).toEqual([]);
  });

  it('pistas genéricas não repetem termo de produto', () => {
    const productTerms = new Set(PRODUCTS.flatMap(e => e.terms.map(normalize)));
    const conflicts = HINTS.flatMap(h => h.terms.filter(t => productTerms.has(normalize(t))));
    expect(conflicts).toEqual([]);
  });

  it('há emoji genérico declarado para toda categoria', () => {
    for (const cat of VALID_CATEGORIES) {
      expect(CATEGORY_FALLBACK[cat]?.emoji).toBeTruthy();
    }
  });
});

describe('dicionário de produtos — cobertura', () => {
  it('reconhece as frutas brasileiras que antes caíam em "Outros"', () => {
    for (const fruta of ['Atemoia', 'Pinha', 'Jaca', 'Umbu', 'Pequi', 'Sapoti', 'Cupuaçu', 'Seriguela', 'Jenipapo', 'Graviola']) {
      const r = classifyItemSync(fruta);
      expect(r.category, `${fruta} caiu em ${r.category}`).toBe('frutas');
      expect(r.emoji, `${fruta} ficou com emoji genérico`).not.toBe('📦');
    }
  });

  it('reconhece utilidades que não são comida', () => {
    expect(classifyItemSync('Pinça').emoji).toBe('✂️');
    expect(classifyItemSync('Cortador de unha').emoji).toBe('✂️');
    expect(classifyItemSync('Guarda-chuva').emoji).toBe('☂️');
  });
});
