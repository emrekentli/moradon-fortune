import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { ParticleSystem } from '../effects/ParticleSystem';
import type { RandomSource } from '../math/Random';
import { trinaChargesForScatters, upgradeChance } from './AnvilMath';

export type AnvilResult = {
  level: number;
  freeSpins: number;
  multiplier: number;
};

export type AnvilBonusOptions = {
  background: Texture;
  weapon: Texture;
  trina: Texture;
  particles: ParticleSystem;
  random: RandomSource;
  playSound: (sound: 'click' | 'win' | 'big-win' | 'scatter' | 'anvil-hit', variant?: number) => void;
};

const wait = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));
const nextFrame = (): Promise<number> => new Promise(requestAnimationFrame);

export class AnvilBonus {
  readonly container = new Container();
  private readonly weapon: Sprite;
  private readonly levelText: Text;
  private readonly chanceText: Text;
  private readonly statusText: Text;
  private readonly chanceFill: Graphics;
  private readonly trinaBadge: Container;
  private readonly trinaText: Text;
  private readonly actionPlate: Graphics;
  private readonly actionLabel: Text;
  private readonly energyGlow: Graphics;
  private level = 1;
  private trinaCharges = 0;
  private trinaSelected = false;
  private busy = false;
  private finished = false;
  private burned = false;
  private resolveResult: ((result: AnvilResult) => void) | null = null;

  constructor(private readonly options: AnvilBonusOptions) {
    this.container.visible = false;

    const background = new Sprite(options.background);
    background.width = 1280;
    background.height = 720;
    const vignette = new Graphics()
      .rect(0, 0, 1280, 720)
      .fill({ color: 0x05020a, alpha: 0.22 });

    const title = this.text('MAGIC ANVIL', 42, 0xf7d86d, '800');
    title.anchor.set(0.5);
    title.position.set(640, 48);
    const subtitle = this.text('İTEMİNİ YÜKSELT • FREE SPIN ÇARPANINI ARTIR', 14, 0xd6ccb4, '700');
    subtitle.anchor.set(0.5);
    subtitle.position.set(640, 82);

    this.energyGlow = new Graphics()
      .circle(0, 0, 118)
      .fill({ color: 0x61ff5f, alpha: 0.11 })
      .circle(0, 0, 88)
      .stroke({ color: 0xa5ff83, width: 4, alpha: 0.5 });
    this.energyGlow.position.set(640, 357);

    const itemCard = new Graphics()
      .roundRect(493, 126, 294, 294, 18)
      .fill({ color: 0x080a10, alpha: 0.87 })
      .stroke({ color: 0xd4a53c, width: 4 });

    this.weapon = new Sprite(options.weapon);
    this.weapon.anchor.set(0.5);
    this.weapon.position.set(640, 270);
    this.weapon.width = 265;
    this.weapon.height = 265;

    this.levelText = this.text('+1', 52, 0xffea88, '800');
    this.levelText.anchor.set(0.5);
    this.levelText.position.set(640, 424);

    this.statusText = this.text('Magic Anvil enerjini bekliyor.', 20, 0xf3e4bd, '700');
    this.statusText.anchor.set(0.5);
    this.statusText.position.set(640, 480);

    const chanceBack = new Graphics()
      .roundRect(420, 510, 440, 18, 9)
      .fill({ color: 0x090b10, alpha: 0.9 })
      .stroke({ color: 0x8e743a, width: 2 });
    this.chanceFill = new Graphics();

    this.chanceText = this.text('', 14, 0xcfc3a7, '700');
    this.chanceText.anchor.set(0.5);
    this.chanceText.position.set(640, 550);

    this.trinaBadge = new Container();
    const trinaPanel = new Graphics()
      .roundRect(84, 475, 220, 118, 16)
      .fill({ color: 0x160d25, alpha: 0.9 })
      .stroke({ color: 0xb875ff, width: 3 });
    const trinaSprite = new Sprite(options.trina);
    trinaSprite.anchor.set(0.5);
    trinaSprite.position.set(138, 534);
    trinaSprite.width = 92;
    trinaSprite.height = 92;
    this.trinaText = this.text('TRİNA x1\nKULLAN', 16, 0xe5bdff, '800');
    this.trinaText.anchor.set(0.5);
    this.trinaText.position.set(230, 532);
    this.trinaBadge.addChild(trinaPanel, trinaSprite, this.trinaText);
    this.trinaBadge.eventMode = 'static';
    this.trinaBadge.cursor = 'pointer';
    this.trinaBadge.on('pointertap', () => this.toggleTrina());

    const action = new Container();
    action.position.set(500, 595);
    this.actionPlate = new Graphics();
    this.actionLabel = this.text('YÜKSELT', 24, 0xfff1be, '800');
    this.actionLabel.anchor.set(0.5);
    this.actionLabel.position.set(140, 40);
    action.addChild(this.actionPlate, this.actionLabel);
    action.eventMode = 'static';
    action.cursor = 'pointer';
    action.on('pointertap', () => void this.onAction());
    action.on('pointerdown', () => action.scale.set(0.97));
    action.on('pointerup', () => action.scale.set(1));
    action.on('pointerupoutside', () => action.scale.set(1));

    this.container.addChild(
      background,
      vignette,
      title,
      subtitle,
      this.energyGlow,
      itemCard,
      this.weapon,
      this.levelText,
      this.statusText,
      chanceBack,
      this.chanceFill,
      this.chanceText,
      this.trinaBadge,
      action,
    );
    this.drawActionButton(0x176d31);
  }

  async open(scatterCount: number): Promise<AnvilResult> {
    this.level = 1;
    this.trinaCharges = trinaChargesForScatters(scatterCount);
    this.trinaSelected = false;
    this.busy = false;
    this.finished = false;
    this.burned = false;
    this.container.alpha = 0;
    this.container.visible = true;
    this.weapon.rotation = 0;
    this.weapon.tint = 0xffffff;
    this.statusText.text = 'Trina’yı seçersen sonraki denemenin şansı %15 artar.';
    this.trinaBadge.visible = true;
    this.actionLabel.text = 'YÜKSELT';
    this.drawActionButton(0x176d31);
    this.updateLabels();
    await this.fade(0, 1, 380);
    return new Promise<AnvilResult>((resolve) => {
      this.resolveResult = resolve;
    });
  }

  async openDebug(targetLevel: number): Promise<AnvilResult> {
    this.level = Math.max(1, Math.min(8, Math.round(targetLevel)));
    this.trinaCharges = 3;
    this.trinaSelected = false;
    this.busy = false;
    this.finished = this.level >= 8;
    this.burned = false;
    this.container.alpha = 0;
    this.container.visible = true;
    this.weapon.rotation = 0;
    this.weapon.tint = 0xffffff;
    this.statusText.text = this.finished
      ? 'DEBUG ÖNİZLEME: Maksimum +8 seviyesine ulaşıldı.'
      : `DEBUG ÖNİZLEME: +${this.level} item, sıradaki hedef +${this.level + 1}.`;
    this.trinaBadge.visible = true;
    this.actionLabel.text = this.finished ? 'BONUSU AL' : 'YÜKSELT';
    this.drawActionButton(this.finished ? 0x8a5a12 : 0x176d31);
    this.updateLabels();
    await this.fade(0, 1, 240);
    return new Promise<AnvilResult>((resolve) => {
      this.resolveResult = resolve;
    });
  }

  private async onAction(): Promise<void> {
    if (this.busy) return;
    this.options.playSound('click');
    if (this.finished) {
      await this.close();
      return;
    }

    this.busy = true;
    this.drawActionButton(0x4b4b4b);
    const usedTrina = this.trinaSelected && this.trinaCharges > 0;
    const chance = upgradeChance(this.level + 1, usedTrina);
    if (usedTrina) this.trinaCharges -= 1;
    this.trinaSelected = false;
    this.statusText.text = `+${this.level + 1} deneniyor…`;
    await this.chargeEnergy();
    this.options.playSound('anvil-hit');
    const success = this.options.random.next() < chance;

    if (success) {
      this.level += 1;
      this.weapon.tint = 0xd8ffd0;
      this.options.particles.burst(640, 345, 0x78ff65, 42);
      this.options.playSound(this.level >= 5 ? 'big-win' : 'win');
      this.statusText.text = `UPGRADE BAŞARILI! Item +${this.level}`;
    } else {
      this.burned = true;
      this.weapon.tint = 0xff6655;
      this.options.particles.burst(640, 345, 0xff3b28, 46);
      this.statusText.text = usedTrina
        ? `Trina şansı artırdı ama item +${this.level} basarken yandı!`
        : `UPGRADE BAŞARISIZ! Item +${this.level} basarken yandı.`;
    }

    await wait(650);
    this.weapon.tint = 0xffffff;
    this.updateLabels();
    if (this.burned || this.level >= 8) {
      this.finished = true;
      this.actionLabel.text = 'BONUSU AL';
      this.drawActionButton(0x8a5a12);
      this.statusText.text = this.burned
        ? `ITEM YANDI • Ulaşılan +${this.level} seviyesi • ${this.multiplier.toFixed(2)}x çarpan`
        : `MAKSİMUM +8 • ${this.multiplier.toFixed(2)}x Free Spin çarpanı`;
    } else {
      this.drawActionButton(0x176d31);
    }
    this.busy = false;
  }

  private async chargeEnergy(): Promise<void> {
    const started = performance.now();
    const duration = 760;
    while (true) {
      const now = await nextFrame();
      const progress = Math.min(1, (now - started) / duration);
      const pulse = 1 + Math.sin(progress * Math.PI * 7) * 0.08 + progress * 0.22;
      this.energyGlow.scale.set(pulse);
      this.energyGlow.alpha = 0.45 + progress * 0.55;
      this.weapon.rotation = Math.sin(progress * Math.PI * 9) * 0.025;
      if (progress >= 1) break;
    }
    this.energyGlow.scale.set(1);
    this.energyGlow.alpha = 1;
    this.weapon.rotation = 0;
  }

  private async close(): Promise<void> {
    const result = {
      level: this.level,
      freeSpins: 6 + this.level,
      multiplier: this.multiplier,
    };
    await this.fade(1, 0, 320);
    this.container.visible = false;
    this.resolveResult?.(result);
    this.resolveResult = null;
  }

  private updateLabels(): void {
    this.levelText.text = `+${this.level}`;
    const chance = upgradeChance(this.level + 1, this.trinaSelected && this.trinaCharges > 0);
    this.chanceText.text = this.burned
      ? `ITEM YANDI  •  KAZANILAN ÇARPAN: ${this.multiplier.toFixed(2)}x`
      : this.level >= 8
        ? 'MAKSİMUM SEVİYEYE ULAŞILDI'
        : `SONRAKİ UPGRADE ŞANSI: %${Math.round(chance * 100)}`;
    this.trinaText.text = this.trinaCharges > 0
      ? `TRİNA x${this.trinaCharges}\n${this.trinaSelected ? 'AKTİF • +%15' : 'KULLAN'}`
      : 'TRİNA BİTTİ';
    this.trinaBadge.alpha = this.trinaCharges > 0 ? (this.trinaSelected ? 1 : 0.82) : 0.38;
    this.chanceFill.clear()
      .roundRect(424, 514, 432 * chance, 10, 5)
      .fill({ color: chance >= 0.6 ? 0x58d861 : chance >= 0.35 ? 0xe5b843 : 0xd34b3f });
  }

  private toggleTrina(): void {
    if (this.busy || this.finished || this.trinaCharges <= 0) return;
    this.options.playSound('click');
    this.trinaSelected = !this.trinaSelected;
    this.statusText.text = this.trinaSelected
      ? 'Trina aktif: sonraki upgrade şansı %15 yükseldi.'
      : 'Trina seçimi iptal edildi.';
    this.updateLabels();
  }

  private get multiplier(): number {
    return 1 + Math.max(0, this.level - 1) * 0.5;
  }

  private drawActionButton(color: number): void {
    this.actionPlate.clear()
      .roundRect(0, 0, 280, 80, 40)
      .fill({ color, alpha: 0.97 })
      .stroke({ color: 0xffdf75, width: 4 });
  }

  private async fade(from: number, to: number, duration: number): Promise<void> {
    const started = performance.now();
    while (true) {
      const now = await nextFrame();
      const progress = Math.min(1, (now - started) / duration);
      this.container.alpha = from + (to - from) * (1 - Math.pow(1 - progress, 3));
      if (progress >= 1) break;
    }
  }

  private text(value: string, size: number, color: number, weight: '700' | '800'): Text {
    return new Text({
      text: value,
      style: {
        fontFamily: 'Montserrat, Arial',
        fontSize: size,
        fontWeight: weight,
        fill: color,
        align: 'center',
        dropShadow: { color: 0x000000, alpha: 0.9, blur: 5, distance: 3 },
      },
    });
  }
}
