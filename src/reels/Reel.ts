import { BlurFilter, Container, Sprite, Texture } from 'pixi.js';
import type { SymbolId } from '../game/types';

export type ReelSpinOptions = {
  duration: number;
  maxSpeed: number;
  anticipation?: boolean;
};

const waitFrame = (): Promise<number> => new Promise(requestAnimationFrame);

export class Reel {
  readonly container = new Container();
  private readonly sprites: Sprite[] = [];
  private readonly symbolIds: SymbolId[] = [];
  private readonly blur = new BlurFilter({ strengthX: 0, strengthY: 0, quality: 2 });
  private stopRequested = false;
  private stripCursor = 0;

  constructor(
    readonly index: number,
    x: number,
    y: number,
    private readonly cellWidth: number,
    private readonly cellHeight: number,
    private readonly rowCount: number,
    private readonly textures: Map<SymbolId, Texture>,
    private readonly strip: SymbolId[],
    initialResult: SymbolId[],
    initialStop: number,
  ) {
    this.container.position.set(x, y);
    this.container.filters = [this.blur];
    for (let slot = -1; slot <= rowCount; slot += 1) {
      const id = slot < 0
        ? strip[this.normalize(initialStop - 1)]
        : slot < rowCount
          ? initialResult[slot]
          : strip[this.normalize(initialStop + rowCount)];
      const sprite = new Sprite(this.textures.get(id));
      this.fit(sprite, slot);
      this.symbolIds.push(id);
      this.sprites.push(sprite);
      this.container.addChild(sprite);
    }
    this.stripCursor = this.normalize(initialStop - 2);
  }

  getVisibleSprite(row: number): Sprite {
    return this.sprites[row + 1];
  }

  getVisibleSymbol(row: number): SymbolId {
    return this.symbolIds[row + 1];
  }

  async spin(finalResult: SymbolId[], stopIndex: number, options: ReelSpinOptions): Promise<void> {
    this.stopRequested = false;
    const started = performance.now();
    let previous = started;
    const totalHeight = (this.rowCount + 2) * this.cellHeight;
    const wrapAt = (this.rowCount + 1) * this.cellHeight;
    const landingDuration = options.anticipation ? 650 : 500;
    const cruiseDuration = Math.max(280, options.duration - landingDuration);

    while (true) {
      const now = await waitFrame();
      const elapsed = now - started;
      const delta = Math.min(32, now - previous);
      previous = now;
      const acceleration = Math.min(1, elapsed / 150);
      const ramp = this.easeInCubic(acceleration);
      const speed = Math.max(0.08, options.maxSpeed * ramp);
      this.blur.strengthY = Math.min(18, speed * 2.8);

      for (let i = 0; i < this.sprites.length; i += 1) {
        const sprite = this.sprites[i];
        sprite.y += speed * delta;
        if (sprite.y >= wrapAt) {
          sprite.y -= totalHeight;
          const next = this.nextStripSymbol();
          this.symbolIds[i] = next;
          sprite.texture = this.textures.get(next) ?? Texture.EMPTY;
        }
      }
      if (elapsed >= cruiseDuration || (this.stopRequested && elapsed >= 280)) break;
    }

    await this.land(finalResult, stopIndex, landingDuration);
  }

  requestStop(): void {
    this.stopRequested = true;
  }

  private async land(finalResult: SymbolId[], stopIndex: number, duration: number): Promise<void> {
    const outgoing = [...this.sprites];
    const outgoingStartY = outgoing.map((sprite) => sprite.y);
    const topmostY = Math.min(...outgoing.map((sprite) => sprite.y));
    const incoming = finalResult.map((id, row) => {
      const sprite = new Sprite(this.textures.get(id) ?? Texture.EMPTY);
      this.fit(sprite, row);
      sprite.y = topmostY - (this.rowCount - row) * this.cellHeight;
      this.container.addChild(sprite);
      return sprite;
    });
    const incomingStartY = incoming.map((sprite) => sprite.y);
    const travel = this.rowCount * this.cellHeight + 4 - topmostY + 12;
    const started = performance.now();
    while (true) {
      const now = await waitFrame();
      const activeDuration = this.stopRequested ? Math.min(duration, 320) : duration;
      const progress = Math.min(1, (now - started) / activeDuration);
      const distance = travel * this.easeOutQuint(progress);
      outgoing.forEach((sprite, index) => { sprite.y = outgoingStartY[index] + distance; });
      incoming.forEach((sprite, row) => { sprite.y = incomingStartY[row] + distance; });
      this.blur.strengthY = 14 * (1 - progress);
      if (progress >= 1) break;
    }

    for (const sprite of outgoing) {
      this.container.removeChild(sprite);
      sprite.destroy();
    }
    const topId = this.strip[this.normalize(stopIndex - 1)];
    const bottomId = this.strip[this.normalize(stopIndex + this.rowCount)];
    const top = new Sprite(this.textures.get(topId) ?? Texture.EMPTY);
    const bottom = new Sprite(this.textures.get(bottomId) ?? Texture.EMPTY);
    this.fit(top, -1, 12);
    this.fit(bottom, this.rowCount, 12);
    this.container.addChild(top, bottom);
    this.sprites.splice(0, this.sprites.length, top, ...incoming, bottom);
    this.symbolIds.splice(0, this.symbolIds.length, topId, ...finalResult, bottomId);
    this.stripCursor = this.normalize(stopIndex - 2);
    await this.settleFrom(12, this.stopRequested ? 140 : 210);
    this.blur.strengthY = 0;
  }

  private nextStripSymbol(): SymbolId {
    const symbol = this.strip[this.stripCursor];
    this.stripCursor = this.normalize(this.stripCursor - 1);
    return symbol;
  }

  private normalize(index: number): number {
    return (index % this.strip.length + this.strip.length) % this.strip.length;
  }

  private async settleFrom(offset: number, duration: number): Promise<void> {
    const started = performance.now();
    while (true) {
      const now = await waitFrame();
      const progress = Math.min(1, (now - started) / duration);
      const remaining = offset * (1 - this.easeOutBack(progress));
      for (let i = 0; i < this.sprites.length; i += 1) {
        this.sprites[i].y = (i - 1) * this.cellHeight + 4 + remaining;
      }
      if (progress >= 1) break;
    }
  }

  private fit(sprite: Sprite, row: number, offsetY = 0): void {
    sprite.width = this.cellWidth - 8;
    sprite.height = this.cellHeight - 8;
    sprite.position.set(4, row * this.cellHeight + 4 + offsetY);
  }

  private easeInCubic(value: number): number {
    return value * value * value;
  }

  private easeOutQuint(value: number): number {
    return 1 - Math.pow(1 - value, 5);
  }

  private easeOutBack(value: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
  }
}
