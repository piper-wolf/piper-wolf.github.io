import type { Gesture } from './actions';
// SVGs implement the named parts used by actions.ts; palettes share this anatomy.
export interface BirdDefinition {
  size: number;
  feet: number;
  clearance: { left: number; right: number; above: number; below: number };
  // Maximum wait in milliseconds; every delay is sampled from zero.
  idleDelay: number;
  walkDelay: number;
  flightDelay: number;
  escapeRadius: { flight: number; run: number; walk: number };
  actions: readonly Gesture[];
}
export const pigeon = {
  size: 40,
  feet: 58 * 40 / 64,
  clearance: { left: 10, right: 14, above: 6, below: 3 },
  idleDelay: 12000,
  walkDelay: 20000,
  flightDelay: 60000,
  // Screen-space interaction choices, not measured pigeon escape distances.
  // Walking and running react at twice their original radii; flight stays at 28px.
  escapeRadius: { flight: 28, run: 140, walk: 240 },
  actions: ['look', 'peck', 'stretch'],
} as const;

export const entranceDelays = [100, 10000, 40000, 180000] as const;

export const perchMargin = 12;
