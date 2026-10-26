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
  escapeRadius: { flight: number; walk: number };
  // Ground speeds in widths/second; acceleration and braking in widths/second².
  groundSpeed: { min: number; normal: number; max: number; run: number; walk: number; acceleration: number; deceleration: number };
  actions: readonly Gesture[];
}
export const pigeon = {
  size: 40,
  feet: 58 * 40 / 64,
  clearance: { left: 10, right: 14, above: 6, below: 3 },
  idleDelay: 12000,
  walkDelay: 20000,
  flightDelay: 180000,
  // Screen-space interaction choices, not measured pigeon escape distances.
  escapeRadius: { flight: 14, walk: 320 },
  groundSpeed: { min: .25, normal: .5, max: 1.75, run: 1.25, walk: 1.1, acceleration: 4, deceleration: 6 },
  actions: ['look', 'peck', 'stretch', 'preen', 'ruffle'],
} as const;

export const entranceDelays = [100, 90000, 180000] as const;

export const perchMargin = 12;
