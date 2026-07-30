import { describe, it, expect } from 'vitest';
import { classifyItem } from '../classifyCategory';

describe('classifyItem', () => {
  it('classifies a fruit', async () => {
    const result = await classifyItem('Banana');
    expect(result.category).toBe('frutas');
  });

  it('classifies a household item', async () => {
    const result = await classifyItem('Papel higiênico');
    expect(result.category).toBe('casa');
  });

  it('classifies a beverage', async () => {
    const result = await classifyItem('Cerveja');
    expect(result.category).toBe('bebidas');
  });

  it('classifies a grocery staple', async () => {
    const result = await classifyItem('Arroz');
    expect(result.category).toBe('mercearia');
  });

  it('falls back to "outros" for unrecognized words', async () => {
    const result = await classifyItem('xyzzyplugh');
    expect(result.category).toBe('outros');
  });

  it('is accent-insensitive', async () => {
    const result = await classifyItem('acucar');
    expect(result.category).toBe('mercearia');
  });
});
