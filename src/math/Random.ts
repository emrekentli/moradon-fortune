export interface RandomSource {
  next(): number;
}

export class CryptoRandom implements RandomSource {
  private readonly buffer = new Uint32Array(1);

  next(): number {
    crypto.getRandomValues(this.buffer);
    return this.buffer[0] / 0x1_0000_0000;
  }
}

export class SeededRandom implements RandomSource {
  private state: number;

  constructor(seed = 0x6d2b79f5) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state += 0x6d2b79f5;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  }
}
