export type GameSound = 'click' | 'spin' | 'reel-stop' | 'anticipation' | 'win' | 'big-win' | 'scatter' | 'anvil-hit';

export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private anticipationNodes: OscillatorNode[] = [];
  private ambientNodes: OscillatorNode[] = [];
  private enabled = true;

  constructor() {
    window.addEventListener('pointerdown', () => void this.unlock(), { once: true });
  }

  set muted(value: boolean) {
    this.enabled = !value;
    if (this.master) this.master.gain.value = value ? 0 : 0.42;
  }

  get muted(): boolean {
    return !this.enabled;
  }

  toggleMute(): boolean {
    this.muted = this.enabled;
    return this.muted;
  }

  async unlock(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.enabled ? 0.42 : 0;
      this.master.connect(this.context.destination);
      this.startAmbient();
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }


  private startAmbient(): void {
    if (!this.context || !this.master || this.ambientNodes.length > 0) return;
    const ambience = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    ambience.gain.value = 0.025;
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.8;
    ambience.connect(filter);
    filter.connect(this.master);

    for (const [frequency, detune] of [[55, -7], [82.5, 6], [110, -3]] as const) {
      const oscillator = this.context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = detune;
      oscillator.connect(ambience);
      oscillator.start();
      this.ambientNodes.push(oscillator);
    }
  }

  play(sound: GameSound, variant = 0): void {
    if (!this.context || !this.master || !this.enabled) return;
    switch (sound) {
      case 'click':
        this.tone(310, 0.055, 'triangle', 0.09, 0, 220);
        break;
      case 'spin':
        this.noiseSweep(0.36, 0.11);
        this.tone(95, 0.32, 'sawtooth', 0.04, 0, 52);
        break;
      case 'reel-stop':
        this.metalImpact(-0.72 + variant * 0.36, variant);
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((note, index) => this.tone(note, 0.2, 'triangle', 0.055, index * 0.07, note, index % 2 ? 0.28 : -0.28));
        break;
      case 'big-win':
        [262, 330, 392, 523, 659, 784].forEach((note, index) => this.tone(note, 0.42, 'sawtooth', 0.04, index * 0.09));
        break;
      case 'scatter':
        this.tone(220 + variant * 80, 0.38, 'sine', 0.07, 0, 760 + variant * 100);
        break;
      case 'anticipation':
        this.startAnticipation();
        break;
      case 'anvil-hit':
        this.noiseSweep(0.22, 0.16, 0);
        [68, 136, 272, 544].forEach((note, index) => this.tone(note, 0.42 - index * 0.055, index < 2 ? 'square' : 'triangle', 0.09 / (index + 1), index * 0.008, note * 0.62));
        break;
    }
  }

  stopAnticipation(): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const oscillator of this.anticipationNodes) {
      try {
        oscillator.frequency.exponentialRampToValueAtTime(40, now + 0.12);
        oscillator.stop(now + 0.14);
      } catch {
        oscillator.stop();
      }
    }
    this.anticipationNodes = [];
  }

  private startAnticipation(): void {
    if (!this.context || !this.master || this.anticipationNodes.length > 0) return;
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    gain.gain.setValueAtTime(0.015, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 1.1);
    gain.connect(this.master);
    for (const frequency of [82, 123]) {
      const oscillator = this.context.createOscillator();
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.7, now + 1.3);
      oscillator.connect(gain);
      oscillator.start(now);
      this.anticipationNodes.push(oscillator);
    }
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
    endFrequency = frequency,
    pan = 0,
  ): void {
    if (!this.context || !this.master) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    gain.connect(panner);
    panner.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private noiseSweep(duration: number, volume: number, pan = 0): void {
    if (!this.context || !this.master) return;
    const length = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner();
    filter.type = 'bandpass';
    filter.frequency.value = 620;
    filter.Q.value = 0.7;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    panner.pan.value = pan;
    gain.connect(panner);
    panner.connect(this.master);
    source.start();
  }

  private metalImpact(pan: number, variant: number): void {
    this.noiseSweep(0.09, 0.07, pan);
    this.tone(128 + variant * 11, 0.12, 'square', 0.052, 0, 62, pan);
    this.tone(510 + variant * 27, 0.18, 'triangle', 0.028, 0.008, 210, pan);
    this.tone(54, 0.16, 'sine', 0.075, 0.012, 38, pan);
  }
}
