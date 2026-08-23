import { Container, Graphics, Text, type Texture } from 'pixi.js';
import { CELL_H, CELL_W, COLS, REEL_X, REEL_Y, ROWS } from '../game/config';
import type { WinResult } from '../game/types';
import type { SymbolId } from '../game/types';
import type { ReelManager } from '../reels/ReelManager';
import type { ParticleSystem } from '../effects/ParticleSystem';

export type WinPresenterOptions = {
  onCount?: (value: number) => void;
  symbolFrames?: Partial<Record<SymbolId, Texture[]>>;
  isTurbo?: () => boolean;
  onBigWin?: () => void;
};

const wait = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));

export class WinPresenter {
  readonly container = new Container();
  private readonly lineLayer = new Graphics();
  private readonly frameLayer = new Container();
  private readonly celebrationLayer = new Container();
  private skipRequested = false;

  constructor(
    private readonly reels: ReelManager,
    private readonly particles: ParticleSystem,
    private readonly options: WinPresenterOptions = {},
  ) {
    this.container.addChild(this.lineLayer, this.frameLayer, this.celebrationLayer);
  }

  reset(): void {
    this.skipRequested = false;
    this.lineLayer.clear();
    this.frameLayer.removeChildren().forEach((child) => child.destroy());
    this.celebrationLayer.removeChildren().forEach((child) => child.destroy());
    for (let col = 0; col < COLS; col += 1) {
      for (let row = 0; row < ROWS; row += 1) {
        const sprite = this.reels.getSprite(col, row);
        sprite.tint = 0xffffff;
        sprite.alpha = 1;
      }
    }
  }

  requestSkip(): void {
    this.skipRequested = true;
  }

  async show(win: WinResult): Promise<void> {
    if (win.amount <= 0) return;
    this.dimNonWinning(win.positions);
    this.drawLines(win);
    this.drawFrames(win);
    if (this.options.isTurbo?.()) {
      this.options.onCount?.(win.amount);
      await this.pause(260);
      return;
    }
    await Promise.all([
      this.countUp(win.amount),
      this.pulseFrames(win),
      this.animateSymbols(win),
      this.animateProceduralSymbols(win),
    ]);
    if (this.skipRequested) return;
    if (win.multiplier >= 10) await this.showBigWin(win);
    if (win.wins.length > 1) await this.cycleWinningLines(win);
  }

  private async animateSymbols(win: WinResult): Promise<void> {
    const animationMap = this.options.symbolFrames;
    if (!animationMap) return;
    const targets = [...win.positions]
      .map((key) => key.split(':').map(Number) as [number, number])
      .map(([col, row]) => ({
        sprite: this.reels.getSprite(col, row),
        frames: animationMap[this.reels.getSymbol(col, row)],
      }))
      .filter((target): target is { sprite: ReturnType<ReelManager['getSprite']>; frames: Texture[] } =>
        Boolean(target.frames?.length),
      );
    if (targets.length === 0) return;
    const originalTextures = targets.map(({ sprite }) => sprite.texture);
    const frameCount = Math.max(...targets.map(({ frames }) => frames.length));
    for (let index = 0; index < frameCount; index += 1) {
      for (const { sprite, frames } of targets) sprite.texture = frames[Math.min(index, frames.length - 1)];
      await this.pause(95);
      if (this.skipRequested) break;
    }
    targets.forEach(({ sprite }, index) => { sprite.texture = originalTextures[index]; });
  }

  private async animateProceduralSymbols(win: WinResult): Promise<void> {
    const targets = [...win.positions]
      .map((key) => key.split(':').map(Number) as [number, number])
      .map(([col, row]) => ({
        id: this.reels.getSymbol(col, row),
        sprite: this.reels.getSprite(col, row),
      }))
      .filter(({ id }) => !this.options.symbolFrames?.[id]?.length)
      .map((target) => ({
        ...target,
        x: target.sprite.x,
        y: target.sprite.y,
        width: target.sprite.width,
        height: target.sprite.height,
      }));
    if (targets.length === 0) return;
    const started = performance.now();
    while (!this.skipRequested && performance.now() - started < 760) {
      const phase = (performance.now() - started) / 760 * Math.PI * 4;
      for (const target of targets) {
        const pulse = 1 + Math.sin(phase) * (target.id === 'scatter' ? 0.075 : 0.035);
        const flip = target.id === 'coin' ? 0.32 + Math.abs(Math.cos(phase)) * 0.68 : pulse;
        target.sprite.width = target.width * flip;
        target.sprite.height = target.height * pulse;
        target.sprite.x = target.x + (target.width - target.sprite.width) / 2
          + (target.id === 'shard' ? Math.sin(phase * 3) * 3 : 0);
        target.sprite.y = target.y + (target.height - target.sprite.height) / 2
          - (target.id === 'hp' || target.id === 'mp' ? Math.abs(Math.sin(phase)) * 4 : 0);
      }
      await wait(16);
    }
    for (const target of targets) {
      target.sprite.position.set(target.x, target.y);
      target.sprite.width = target.width;
      target.sprite.height = target.height;
    }
  }

  private async cycleWinningLines(win: WinResult): Promise<void> {
    for (const line of win.wins.slice(0, 6)) {
      const positions = new Set(line.positions.map(({ col, row }) => `${col}:${row}`));
      this.lineLayer.clear();
      this.frameLayer.removeChildren().forEach((child) => child.destroy());
      this.dimNonWinning(positions);
      this.drawLines({ ...win, wins: [line], positions });
      this.drawFrames({ ...win, wins: [line], positions });

      const label = new Text({
        text: `ÇİZGİ ${line.lineIndex + 1}  •  ${line.count}x  •  ${line.multiplier.toFixed(2)}x`,
        style: {
          fontFamily: 'Montserrat, Arial',
          fontSize: 18,
          fontWeight: '800',
          fill: 0xffe28a,
          stroke: { color: 0x351400, width: 4 },
        },
      });
      label.anchor.set(0.5);
      label.position.set(640, 575);
      this.celebrationLayer.addChild(label);
      await this.pause(520);
      label.destroy();
      if (this.skipRequested) break;
    }

    this.lineLayer.clear();
    this.frameLayer.removeChildren().forEach((child) => child.destroy());
    this.dimNonWinning(win.positions);
    this.drawLines(win);
    this.drawFrames(win);
  }

  private dimNonWinning(winning: Set<string>): void {
    for (let col = 0; col < COLS; col += 1) {
      for (let row = 0; row < ROWS; row += 1) {
        const sprite = this.reels.getSprite(col, row);
        const active = winning.has(`${col}:${row}`);
        sprite.alpha = active ? 1 : 0.34;
        sprite.tint = active ? 0xffffd0 : 0x707784;
      }
    }
  }

  private drawLines(win: WinResult): void {
    const colors = [0xffd85c, 0x66ddff, 0xff6f91, 0x9dff79, 0xd59cff];
    for (const line of win.wins) {
      if (line.positions.length === 0) continue;
      const color = colors[line.lineIndex % colors.length];
      const first = line.positions[0];
      this.lineLayer.moveTo(
        REEL_X + first.col * CELL_W + CELL_W / 2,
        REEL_Y + first.row * CELL_H + CELL_H / 2,
      );
      for (const position of line.positions.slice(1)) {
        this.lineLayer.lineTo(
          REEL_X + position.col * CELL_W + CELL_W / 2,
          REEL_Y + position.row * CELL_H + CELL_H / 2,
        );
      }
      this.lineLayer.stroke({ color, width: 5, alpha: 0.88 });
    }
  }

  private drawFrames(win: WinResult): void {
    const colors: Record<SymbolId, number> = {
      hp: 0xff625c,
      mp: 0x5db8ff,
      scroll: 0xb978ff,
      raptor: 0xffad47,
      shard: 0xff4f66,
      bow: 0x50d9ff,
      wild: 0xdc73ff,
      coin: 0xffd447,
      scatter: 0x6ff5ff,
    };
    for (const key of win.positions) {
      const [col, row] = key.split(':').map(Number);
      const x = REEL_X + col * CELL_W;
      const y = REEL_Y + row * CELL_H;
      const frame = new Graphics()
        .roundRect(x + 5, y + 5, CELL_W - 10, CELL_H - 10, 11)
        .stroke({ color: 0xffed84, width: 6 });
      this.frameLayer.addChild(frame);
      this.particles.burst(x + CELL_W / 2, y + CELL_H / 2, colors[this.reels.getSymbol(col, row)], 11);
    }
  }

  private async countUp(amount: number): Promise<void> {
    const duration = Math.min(1900, 620 + amount * 7);
    const started = performance.now();
    while (true) {
      const progress = Math.min(1, (performance.now() - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.options.onCount?.(amount * eased);
      if (progress >= 1 || this.skipRequested) break;
      await wait(16);
    }
    this.options.onCount?.(amount);
  }

  private async pulseFrames(win: WinResult): Promise<void> {
    for (let pulse = 0; pulse < 6; pulse += 1) {
      this.frameLayer.alpha = pulse % 2 === 0 ? 1 : 0.32;
      this.lineLayer.alpha = pulse % 2 === 0 ? 0.95 : 0.3;
      for (const key of win.positions) {
        const [col, row] = key.split(':').map(Number);
        this.reels.getSprite(col, row).tint = pulse % 2 === 0 ? 0xffffff : 0xffe58a;
      }
      await this.pause(125);
      if (this.skipRequested) break;
    }
    this.frameLayer.alpha = 1;
    this.lineLayer.alpha = 0.9;
  }

  private async showBigWin(win: WinResult): Promise<void> {
    const shade = new Graphics()
      .rect(0, 0, 1280, 720)
      .fill({ color: 0x08020e, alpha: 0.68 });
    const label = new Text({
      text: win.multiplier >= 25 ? 'MEGA UPGRADE!' : 'BÜYÜK KAZANÇ!',
      style: {
        fontFamily: 'Cinzel, Georgia',
        fontSize: 62,
        fontWeight: '800',
        fill: 0xffdf70,
        stroke: { color: 0x4a1605, width: 7 },
        dropShadow: { color: 0x000000, alpha: 0.9, blur: 12, distance: 5 },
      },
    });
    label.anchor.set(0.5);
    label.position.set(640, 330);
    this.celebrationLayer.addChild(shade, label);
    this.options.onBigWin?.();
    this.particles.coinRain(58);
    this.particles.burst(640, 350, 0xffd85c, 70);
    await this.pause(1250);
    this.celebrationLayer.removeChildren().forEach((child) => child.destroy());
  }

  private async pause(ms: number): Promise<void> {
    const started = performance.now();
    while (!this.skipRequested && performance.now() - started < ms) await wait(16);
  }
}
