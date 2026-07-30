import type { RotinaStep, SkyPeriod } from './rotinaSteps';

export interface SkyPreset {
  key: SkyPeriod;
  gradientFrom: string;
  gradientTo: string;
  celestialIcon: string;
  arcColor: string;
  showStars: boolean;
}

const SKY_PRESETS: Record<SkyPeriod, SkyPreset> = {
  dawn: { key: 'dawn', gradientFrom: '#2b2140', gradientTo: '#ff9a76', celestialIcon: '🌅', arcColor: '#ffb37a', showStars: false },
  morning: { key: 'morning', gradientFrom: '#7fc7ff', gradientTo: '#fff3c4', celestialIcon: '☀️', arcColor: '#ffd76a', showStars: false },
  afternoon: { key: 'afternoon', gradientFrom: '#3aa0ff', gradientTo: '#ffe27a', celestialIcon: '☀️', arcColor: '#ffcf4d', showStars: false },
  dusk: { key: 'dusk', gradientFrom: '#2c2a5a', gradientTo: '#ff7e6b', celestialIcon: '🌇', arcColor: '#ff9d6b', showStars: false },
  night: { key: 'night', gradientFrom: '#05061a', gradientTo: '#1b2247', celestialIcon: '🌙', arcColor: '#8fa3ff', showStars: true },
};

// Primary signal: the focused step's own tagged period (a "sleep" step is
// always a night sky, regardless of the wall clock).
export function getSkyPresetForStep(step: RotinaStep): SkyPreset {
  return SKY_PRESETS[step.period];
}

// Secondary/ambient signal: used only when there's no step in focus
// (celebration screen, all done for the day).
export function getAmbientSkyPreset(date: Date = new Date()): SkyPreset {
  const h = date.getHours();
  if (h < 5) return SKY_PRESETS.night;
  if (h < 9) return SKY_PRESETS.dawn;
  if (h < 12) return SKY_PRESETS.morning;
  if (h < 17) return SKY_PRESETS.afternoon;
  if (h < 19) return SKY_PRESETS.dusk;
  return SKY_PRESETS.night;
}
