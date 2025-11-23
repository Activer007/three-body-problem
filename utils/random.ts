export type SeededRandom = () => number;

/**
 * Mulberry32 deterministic PRNG (fast + good enough for visuals)
 */
export function createSeededRandom(seed: number): SeededRandom {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomRange(rand: SeededRandom, min: number, max: number): number {
  return min + (max - min) * rand();
}

export function pickRandom<T>(rand: SeededRandom, items: T[]): T {
  if (items.length === 0) {
    throw new Error('Cannot pick from an empty array');
  }
  const idx = Math.floor(rand() * items.length);
  return items[idx];
}
