/** mulberry32 — state is a single uint32 so it can live inside GameState. */
export function nextRandom(state: number): [value: number, next: number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

export function randomInt(state: number, maxExclusive: number): [value: number, next: number] {
  const [v, next] = nextRandom(state);
  return [Math.floor(v * maxExclusive), next];
}
