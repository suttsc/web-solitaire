export type Rng = () => number;

/**
 * Small, fast, seedable PRNG (sfc32). The 32-bit seed is expanded into the
 * four words of state with splitmix32 so nearby seeds give unrelated streams.
 * Returns floats in [0, 1).
 */
export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const splitmix = (): number => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };

  let a = splitmix();
  let b = splitmix();
  let c = splitmix();
  let d = splitmix();

  return () => {
    const t = (((a + b) >>> 0) + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) >>> 0;
    return t / 4294967296;
  };
}

/** A random unsigned 32-bit seed from the platform CSPRNG. */
export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}
