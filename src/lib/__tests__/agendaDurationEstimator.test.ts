import { describe, it, expect } from 'vitest';
import { estimateDurationMinutes } from '../agendaDurationEstimator';

describe('estimateDurationMinutes', () => {
  it('scales shopping/errand lists by number of enumerated items', () => {
    const oneItem = estimateDurationMinutes('Comprar pão');
    const fourItems = estimateDurationMinutes('Comprar bucha, tinta branco gelo, gancho para rede e torneira do quintal');
    expect(fourItems).toBeGreaterThan(oneItem);
  });

  it('gives deskwork/planning tasks a longer default', () => {
    expect(estimateDurationMinutes('Planejar Operação Baixo Ruído')).toBe(60);
  });

  it('gives simple errands a mid-range default', () => {
    expect(estimateDurationMinutes('Levar o carro à funilaria')).toBe(30);
  });

  it('falls back to a sane default for unrecognized titles', () => {
    expect(estimateDurationMinutes('xyzzy plugh')).toBe(30);
  });

  it('never returns a duration below the floor', () => {
    expect(estimateDurationMinutes('a')).toBeGreaterThanOrEqual(10);
  });
});
