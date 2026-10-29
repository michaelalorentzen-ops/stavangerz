// All tilfeldighet i spillet går gjennom state.rng, så samme state + samme
// ordre gir samme resultat. Aldri bruk Math.random() i motoren.

export interface Seeded {
  rng: number;
}

/** mulberry32: neste tall i [0, 1), oppdaterer s.rng */
export function rand(s: Seeded): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function pick<T>(s: Seeded, arr: readonly T[]): T {
  return arr[Math.floor(rand(s) * arr.length)];
}

/** Stokastisk avrunding: 2.3 blir 3 med 30 % sjanse. */
export function sround(s: Seeded, v: number): number {
  const f = Math.floor(v);
  return f + (rand(s) < v - f ? 1 : 0);
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);
