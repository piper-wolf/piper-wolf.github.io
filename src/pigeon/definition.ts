import type { Gesture } from './actions';
// SVGs implement the named parts used by actions.ts; palettes share this anatomy.
export interface BirdDefinition {
  size: number;
  feet: number;
  clearance: { left: number; right: number; above: number; below: number };
  idleDelay: readonly [number, number];
  walkDelay: readonly [number, number];
  flightDelay: readonly [number, number];
  actions: readonly Gesture[];
}
export const pigeon = {
  size: 40,
  feet: 58 * 40 / 64,
  clearance: { left: 10, right: 14, above: 6, below: 3 },
  idleDelay: [6000, 8000],
  walkDelay: [10000, 8000],
  flightDelay: [30000, 30000],
  actions: ['look', 'peck', 'stretch'],
} as const;

const companion: BirdDefinition = { ...pigeon, actions: ['stretch', 'look', 'peck'], idleDelay: [8000, 8000], walkDelay: [12000, 8000] };
export const definitions: Record<string, BirdDefinition> = {
  city: pigeon, red: companion, white: companion, dark: companion,
};
export const companionAppearances = ['red', 'white', 'dark'] as const;
export const maxBirds = 3;

export const perchMargin = 12;
