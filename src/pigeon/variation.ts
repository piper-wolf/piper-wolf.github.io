// Bounded samples at action creation, never per rendered frame. Inject a random
// source to replay a take in tests; production uses independent Math.random draws.
export function variation(random: () => number = Math.random) {
  const range = (min: number, max: number) => min + (max - min) * random();
  return {
    range,
    integer: (min: number, max: number) => Math.min(max, Math.floor(range(min, max + 1))),
  };
}
export type Variation = ReturnType<typeof variation>;
