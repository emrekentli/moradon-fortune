import { Container, Sprite, Texture } from 'pixi.js';
import { CELL_H, CELL_W, COLS, REEL_STRIPS, REEL_X, REEL_Y } from '../game/config';
import type { SpinMatrix, SymbolId } from '../game/types';
import { Reel } from './Reel';

export type ReelManagerEvents = {
  onReelStop?: (index: number) => void;
  onAnticipation?: (active: boolean) => void;
};

export class ReelManager {
  readonly container = new Container();
  private readonly reels: Reel[] = [];
  private turbo = false;
  private quick = false;

  constructor(
    textures: Map<SymbolId, Texture>,
    initial: SpinMatrix,
    initialStops: number[],
    private readonly events: ReelManagerEvents = {},
  ) {
    for (let col = 0; col < COLS; col += 1) {
      const reel = new Reel(
        col,
        REEL_X + col * CELL_W,
        REEL_Y,
        CELL_W,
        CELL_H,
        initial[col].length,
        textures,
        REEL_STRIPS[col],
        initial[col],
        initialStops[col],
      );
      this.reels.push(reel);
      this.container.addChild(reel.container);
    }
  }

  getSprite(col: number, row: number): Sprite {
    return this.reels[col].getVisibleSprite(row);
  }

  getSymbol(col: number, row: number): SymbolId {
    return this.reels[col].getVisibleSymbol(row);
  }

  quickStop(): void {
    for (const reel of this.reels) reel.requestStop();
    this.events.onAnticipation?.(false);
  }

  setTurbo(active: boolean): void {
    this.turbo = active;
  }

  setQuick(active: boolean): void {
    this.quick = active;
  }

  async spin(result: SpinMatrix, stops: number[]): Promise<void> {
    const scatterBeforeLast = result
      .slice(0, COLS - 1)
      .flat()
      .filter((id) => id === 'scatter').length;
    const anticipation = scatterBeforeLast >= 2;

    const promises = this.reels.map(async (reel, index) => {
      const isLast = index === COLS - 1;
      const useAnticipation = anticipation && isLast && !this.turbo;
      if (useAnticipation) this.events.onAnticipation?.(true);
      await reel.spin(result[index], stops[index], {
        duration: this.turbo
          ? 360 + index * 45
          : this.quick
            ? 560 + index * 85 + (useAnticipation ? 360 : 0)
          : 720 + index * 155 + (useAnticipation ? 760 : 0),
        maxSpeed: this.turbo ? 3.6 : this.quick ? 2.7 : useAnticipation ? 1.35 : 2.35,
        landingDuration: this.turbo ? 220 : this.quick ? 340 : undefined,
        settleDuration: this.turbo ? 90 : this.quick ? 140 : undefined,
        anticipation: useAnticipation,
      });
      this.events.onReelStop?.(index);
      if (useAnticipation) this.events.onAnticipation?.(false);
    });
    await Promise.all(promises);
  }
}
