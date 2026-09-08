// Simple, fast Mulberry32 PRNG for deterministic seed synchronization across clients
export class PRNG {
  private s: number;

  constructor(seed: number = 123456) {
    this.s = Math.floor(seed);
  }

  public setSeed(seed: number): void {
    this.s = Math.floor(seed);
  }

  // Returns pseudo-random float in [0, 1)
  public next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Range helper [min, max)
  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  // Integer range helper [min, max]
  public rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
}

export const prng = new PRNG();
