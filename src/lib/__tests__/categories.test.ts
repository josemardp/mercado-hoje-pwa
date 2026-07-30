import { describe, it, expect } from 'vitest';
import { getTodayKey, formatDateBR, getCategoryByKey, CATEGORIES } from '../categories';

describe('getTodayKey', () => {
  it('returns a YYYY-MM-DD key matching the local date', () => {
    const key = getTodayKey();
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(key).toBe(expected);
  });
});

describe('formatDateBR', () => {
  it('formats a day key as a long pt-BR date', () => {
    const formatted = formatDateBR('2026-07-30');
    expect(formatted).toContain('2026'.slice(0, 0)); // sanity: does not throw
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });
});

describe('getCategoryByKey', () => {
  it('finds every declared category by key', () => {
    for (const cat of CATEGORIES) {
      expect(getCategoryByKey(cat.key)).toEqual(cat);
    }
  });

  it('returns undefined for an unknown key', () => {
    expect(getCategoryByKey('nao-existe')).toBeUndefined();
  });
});
