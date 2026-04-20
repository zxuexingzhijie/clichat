export function createSeededRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rollD20(rng?: () => number): number {
  const r = rng ?? Math.random;
  return Math.floor(r() * 20) + 1;
}

export function rollPercentage(rng?: () => number): number {
  const r = rng ?? Math.random;
  return Math.floor(r() * 100) + 1;
}
