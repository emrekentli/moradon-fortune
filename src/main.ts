import {
  Application,
  Assets,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  Texture,
} from 'pixi.js';
import {
  BETS,
  CELL_H,
  CELL_W,
  COLS,
  DESIGN_H,
  DESIGN_W,
  PAYOUT_FACTOR,
  REEL_X,
  REEL_Y,
  ROWS,
  SYMBOLS,
} from './game/config';
import { GamePhase, type SpinMatrix, type SymbolId, type WinResult } from './game/types';
import { AudioManager } from './audio/AudioManager';
import { assetManifest } from './assets/manifest';
import { AnvilBonus } from './bonus/AnvilBonus';
import { cloneScenario, DEBUG_SCENARIOS } from './debug/Scenarios';
import { ParticleSystem } from './effects/ParticleSystem';
import { SlotEngine } from './math/SlotEngine';
import { CryptoRandom, SeededRandom } from './math/Random';
import { WinPresenter } from './presentation/WinPresenter';
import { ReelManager } from './reels/ReelManager';
import { GameStateMachine } from './state/GameStateMachine';
import './style.css';

let slotEngine = new SlotEngine();
const gameState = new GameStateMachine();
const audioManager = new AudioManager();
let introActive = false;

const app = new Application();
await app.init({
  resizeTo: window,
  antialias: true,
  autoDensity: true,
  resolution: Math.min(window.devicePixelRatio || 1, 2),
  backgroundAlpha: 0,
});
document.querySelector('#game')?.appendChild(app.canvas);
app.ticker.maxFPS = 60;
app.ticker.minFPS = 30;

const world = new Container();
app.stage.addChild(world);

await Assets.init({ manifest: assetManifest });
const [coreAssets, bonusAssets] = await Promise.all([
  Assets.loadBundle('core'),
  Assets.loadBundle('bonus'),
]) as [Record<string, Texture>, Record<string, Texture>];
const backgroundTexture = coreAssets.moradon;
const atlasTexture = coreAssets.symbols;
const anvilBackgroundTexture = bonusAssets['magic-anvil'];

const createSquareFrames = (texture: Texture): Texture[] => Array.from({ length: 9 }, (_, index) => {
  const size = texture.width / 3;
  return new Texture({
    source: texture.source,
    frame: new Rectangle((index % 3) * size, Math.floor(index / 3) * size, size, size),
  });
});
const wildFrames = createSquareFrames(coreAssets['wild-animation']);
const symbolAnimationFrames: Partial<Record<SymbolId, Texture[]>> = {
  hp: createSquareFrames(coreAssets['hp-animation']),
  mp: createSquareFrames(coreAssets['mp-animation']),
  scroll: createSquareFrames(coreAssets['scroll-animation']),
  wild: wildFrames,
  raptor: createSquareFrames(coreAssets['raptor-animation']),
  shard: createSquareFrames(coreAssets['shard-animation']),
  bow: createSquareFrames(coreAssets['bow-animation']),
  coin: createSquareFrames(coreAssets['coin-animation']),
  scatter: createSquareFrames(coreAssets['scatter-animation']),
};

const atlasCellW = atlasTexture.width / 3;
const atlasCellH = atlasTexture.height / 3;
const symbolTextures = new Map<SymbolId, Texture>();
for (const symbol of SYMBOLS) {
  const col = symbol.atlasIndex % 3;
  const row = Math.floor(symbol.atlasIndex / 3);
  symbolTextures.set(symbol.id, new Texture({
    source: atlasTexture.source,
    frame: new Rectangle(col * atlasCellW, row * atlasCellH, atlasCellW, atlasCellH),
  }));
}

const bg = new Sprite(backgroundTexture);
bg.width = DESIGN_W;
bg.height = DESIGN_H;
world.addChild(bg);

const shade = new Graphics()
  .rect(0, 0, DESIGN_W, DESIGN_H)
  .fill({ color: 0x05030a, alpha: 0.18 });
world.addChild(shade);

const topShade = new Graphics()
  .rect(0, 0, DESIGN_W, 110)
  .fill({ color: 0x06050b, alpha: 0.82 });
world.addChild(topShade);

function makeText(text: string, size: number, color = 0xf7e5ad, weight: '600' | '700' | '800' = '700'): Text {
  return new Text({
    text,
    style: {
      fontFamily: 'Montserrat, Arial',
      fontSize: size,
      fontWeight: weight,
      fill: color,
      align: 'center',
      dropShadow: { color: 0x000000, alpha: 0.8, blur: 3, distance: 2 },
    },
  });
}

const title = new Text({
  text: 'MORADON FORTUNE',
  style: {
    fontFamily: 'Cinzel, Georgia',
    fontSize: 39,
    fontWeight: '800',
    fill: 0xffdf7a,
    stroke: { color: 0x3a1705, width: 5 },
    dropShadow: { color: 0x000000, alpha: 0.9, blur: 8, distance: 3 },
    letterSpacing: 3,
  },
});
title.anchor.set(0.5);
title.position.set(DESIGN_W / 2, 45);
world.addChild(title);

const subtitle = makeText('EĞİTİM DEMOSU • GERÇEK PARA İÇERMEZ', 12, 0xd0c5ad, '600');
subtitle.anchor.set(0.5);
subtitle.position.set(DESIGN_W / 2, 78);
world.addChild(subtitle);

const cabinetShadow = new Graphics()
  .roundRect(REEL_X - 22, REEL_Y - 22, CELL_W * COLS + 44, CELL_H * ROWS + 44, 24)
  .fill({ color: 0x000000, alpha: 0.55 });
cabinetShadow.filters = [];
world.addChild(cabinetShadow);

const cabinet = new Graphics()
  .roundRect(REEL_X - 15, REEL_Y - 15, CELL_W * COLS + 30, CELL_H * ROWS + 30, 18)
  .fill({ color: 0x0c1019, alpha: 0.95 })
  .stroke({ color: 0xd9a93b, width: 4 })
  .roundRect(REEL_X - 8, REEL_Y - 8, CELL_W * COLS + 16, CELL_H * ROWS + 16, 12)
  .stroke({ color: 0x6b4920, width: 2 });
world.addChild(cabinet);

const reelMask = new Graphics()
  .rect(REEL_X, REEL_Y, CELL_W * COLS, CELL_H * ROWS)
  .fill(0xffffff);
world.addChild(reelMask);

const initialOutcome = slotEngine.spinWithStops();
const reelManager = new ReelManager(
  symbolTextures,
  initialOutcome.matrix,
  initialOutcome.stops,
  {
    onReelStop: (index) => {
      audioManager.play('reel-stop', index);
      if (index === 0 && gameState.state === GamePhase.Spinning) {
        gameState.transition(GamePhase.Stopping);
      }
    },
    onAnticipation: (active) => {
      statusText.text = active ? 'Kristal enerjisi yükseliyor…' : 'Makaralar duruyor…';
      if (active) audioManager.play('anticipation');
      else audioManager.stopAnticipation();
    },
  },
);
const reelsContainer = reelManager.container;
reelsContainer.mask = reelMask;
world.addChild(reelsContainer);

const gridLines = new Graphics();
for (let col = 1; col < COLS; col += 1) {
  gridLines.moveTo(REEL_X + col * CELL_W, REEL_Y).lineTo(REEL_X + col * CELL_W, REEL_Y + ROWS * CELL_H);
}
for (let row = 1; row < ROWS; row += 1) {
  gridLines.moveTo(REEL_X, REEL_Y + row * CELL_H).lineTo(REEL_X + COLS * CELL_W, REEL_Y + row * CELL_H);
}
gridLines.stroke({ color: 0xd6a745, alpha: 0.35, width: 2 });
world.addChild(gridLines);

const hud = new Graphics()
  .roundRect(142, 595, 1043, 102, 22)
  .fill({ color: 0x070910, alpha: 0.94 })
  .stroke({ color: 0x9b702b, width: 3 });
world.addChild(hud);

let balance = 1000;
let betIndex = 1;
let lastWin = 0;
let previousSpinWin = 0;
let freeSpins = 0;
let freeSpinMultiplier = 1;
let forcedResult: SpinMatrix | null = null;
let autoSpins = 0;
let turbo = false;
let quickSpin = false;
let selectedAutoSpins = 25;
const spinHistory: Array<{ bet: number; win: number; free: boolean }> = [];
const desktopStatCaptions: Text[] = [];

function addStat(label: string, x: number): Text {
  const caption = makeText(label, 12, 0xb9a77e, '600');
  caption.anchor.set(0.5);
  caption.position.set(x, 618);
  world.addChild(caption);
  desktopStatCaptions.push(caption);
  const value = makeText('0', 24, 0xffe28b, '800');
  value.anchor.set(0.5);
  value.position.set(x, 651);
  world.addChild(value);
  return value;
}

const balanceText = addStat('BAKİYE', 220);
const betText = addStat('BAHİS', 390);
const winText = addStat('KAZANÇ', 540);

const lastWinPanel = new Graphics()
  .roundRect(12, 595, 116, 102, 18)
  .fill({ color: 0x090a12, alpha: 0.96 })
  .stroke({ color: 0x9b702b, width: 2 });
const lastWinCaption = makeText('SON ÇEVRİM', 9, 0xa99a78, '700');
lastWinCaption.anchor.set(0.5);
lastWinCaption.position.set(70, 620);
const lastSpinWinText = makeText('0.00', 19, 0xffdf7c, '800');
lastSpinWinText.anchor.set(0.5);
lastSpinWinText.position.set(70, 654);
world.addChild(lastWinPanel, lastWinCaption, lastSpinWinText);

const particleSystem = new ParticleSystem(app.ticker);
world.addChild(particleSystem.container);
const winPresenter = new WinPresenter(reelManager, particleSystem, {
  symbolFrames: symbolAnimationFrames,
  isTurbo: () => quickSpin,
  onBigWin: () => void shakeWorld(),
  onCount: (value) => {
    winText.text = value.toFixed(2);
  },
});
world.addChild(winPresenter.container);

function button(x: number, y: number, width: number, height: number, label: string, color: number, onTap: () => void): Container {
  const container = new Container();
  container.position.set(x, y);
  const plate = new Graphics()
    .roundRect(0, 0, width, height, height / 2)
    .fill({ color, alpha: 0.96 })
    .stroke({ color: 0xffd86a, width: 3 });
  const text = makeText(label, Math.min(22, height * 0.38), 0xfff3c7, '800');
  text.anchor.set(0.5);
  text.position.set(width / 2, height / 2);
  container.addChild(plate, text);
  container.eventMode = 'static';
  container.cursor = 'pointer';
  container.on('pointertap', () => {
    audioManager.play('click');
    onTap();
  });
  container.on('pointerdown', () => container.scale.set(0.96));
  container.on('pointerup', () => container.scale.set(1));
  container.on('pointerupoutside', () => container.scale.set(1));
  return container;
}

const betDown = button(646, 620, 54, 54, '−', 0x332746, () => changeBet(-1));
const betUp = button(712, 620, 54, 54, '+', 0x332746, () => changeBet(1));
world.addChild(betDown, betUp);

const spinButton = button(810, 609, 190, 72, 'SPIN', 0x9f281d, () => void spin());
world.addChild(spinButton);
const spinLabel = spinButton.children[1] as Text;

const infoButton = button(1035, 620, 54, 54, 'i', 0x263d5b, toggleInfo);
world.addChild(infoButton);

const muteButton = button(1100, 620, 54, 54, '♪', 0x263d5b, () => {
  const muted = audioManager.toggleMute();
  (muteButton.children[1] as Text).text = muted ? '×' : '♪';
  (document.querySelector('#mobile-mute') as HTMLButtonElement).textContent = muted ? '×' : '♪';
});
world.addChild(muteButton);

const autoButton = button(1100, 530, 70, 42, 'AUTO', 0x3b2754, toggleAuto);
const buyButton = button(20, 205, 165, 86, 'MAGIC ANVIL\nSATIN AL', 0x6f2b1d, openBuyDialog);
world.addChild(autoButton, buyButton);

const statusText = makeText('Moradon seni bekliyor.', 14, 0xffe1a1, '600');
statusText.anchor.set(0.5);
statusText.position.set(DESIGN_W / 2, 122);
world.addChild(statusText);

const infoOverlay = new Container();
infoOverlay.visible = false;
const infoShade = new Graphics().rect(0, 0, DESIGN_W, DESIGN_H).fill({ color: 0x020207, alpha: 0.8 });
infoShade.eventMode = 'static';
infoShade.on('pointertap', toggleInfo);
const infoPanel = new Graphics()
  .roundRect(260, 105, 760, 510, 22)
  .fill({ color: 0x10131d, alpha: 0.98 })
  .stroke({ color: 0xd9a93b, width: 3 });
const infoTitle = makeText('MORADON FORTUNE', 31, 0xffdb75, '800');
infoTitle.anchor.set(0.5);
infoTitle.position.set(640, 150);
const infoBody = makeText(
  '',
  14,
  0xeadcb6,
  '600',
);
infoBody.anchor.set(0.5, 0);
infoBody.position.set(640, 198);
infoOverlay.addChild(infoShade, infoPanel, infoTitle, infoBody);
world.addChild(infoOverlay);

const anvilBonus = new AnvilBonus({
  background: anvilBackgroundTexture,
  weapon: symbolTextures.get('raptor') ?? Texture.EMPTY,
  trina: wildFrames[0] ?? Texture.EMPTY,
  particles: particleSystem,
  random: new CryptoRandom(),
  playSound: (sound, variant) => audioManager.play(sound, variant),
});
world.addChild(anvilBonus.container);
world.addChild(particleSystem.container);

const autoDialog = document.querySelector<HTMLElement>('#auto-dialog');
const buyDialog = document.querySelector<HTMLElement>('#buy-dialog');
const autoTurboInput = document.querySelector<HTMLInputElement>('#auto-turbo');
const autoQuickInput = document.querySelector<HTMLInputElement>('#auto-quick');
const startAutoButton = document.querySelector<HTMLButtonElement>('#start-auto');
const buyPriceText = document.querySelector<HTMLElement>('#buy-price');

function dialogVisible(): boolean {
  return Boolean((autoDialog && !autoDialog.hidden) || (buyDialog && !buyDialog.hidden));
}

function closeGameDialogs(): void {
  if (autoDialog) autoDialog.hidden = true;
  if (buyDialog) buyDialog.hidden = true;
}

function openAutoDialog(): void {
  if (!gameState.interactive || freeSpins > 0 || infoOverlay.visible || !autoDialog) return;
  if (autoTurboInput) autoTurboInput.checked = turbo;
  if (autoQuickInput) autoQuickInput.checked = quickSpin;
  autoDialog.hidden = false;
}

function openBuyDialog(): void {
  if (!gameState.interactive || freeSpins > 0 || infoOverlay.visible || !buyDialog) return;
  if (buyPriceText) buyPriceText.textContent = `${(BETS[betIndex] * 50).toFixed(2)} Noah`;
  buyDialog.hidden = false;
}

function applySpinSpeedSettings(): void {
  reelManager.setTurbo(turbo);
  reelManager.setQuick(quickSpin);
}

function startConfiguredAuto(): void {
  if (!gameState.interactive || freeSpins > 0) return;
  turbo = autoTurboInput?.checked ?? false;
  quickSpin = autoQuickInput?.checked ?? false;
  applySpinSpeedSettings();
  autoSpins = selectedAutoSpins;
  closeGameDialogs();
  statusText.text = `${selectedAutoSpins} otomatik dönüş başlatıldı.`;
  updateHud();
  void spin();
}

async function buyBonus(): Promise<void> {
  if (!gameState.interactive || freeSpins > 0) return;
  const cost = BETS[betIndex] * 50;
  if (balance < cost) {
    statusText.text = 'Bonus satın almak için demo bakiyesi yetersiz.';
    const mobileStatus = document.querySelector('#mobile-status');
    if (mobileStatus) mobileStatus.textContent = statusText.text;
    return;
  }

  autoSpins = 0;
  balance -= cost;
  closeGameDialogs();
  gameState.transition(GamePhase.BonusIntro);
  statusText.text = 'Satın alınan Magic Anvil hazırlanıyor…';
  updateHud();
  const bonus = await anvilBonus.open(3);
  freeSpins += bonus.freeSpins;
  freeSpinMultiplier = bonus.multiplier;
  statusText.text = `+${bonus.level} item • ${bonus.freeSpins} Free Spin • ${bonus.multiplier.toFixed(2)}x çarpan`;
  gameState.transition(GamePhase.Idle);
  updateHud();
  if (freeSpins > 0) {
    await wait(quickSpin ? 120 : 450);
    void spin();
  }
}

document.querySelectorAll<HTMLElement>('[data-close-dialog]').forEach((control) => {
  control.addEventListener('click', closeGameDialogs);
});
document.querySelectorAll<HTMLButtonElement>('[data-spin-count]').forEach((control) => {
  control.addEventListener('click', () => {
    selectedAutoSpins = Number(control.dataset.spinCount ?? 25);
    document.querySelectorAll('[data-spin-count]').forEach((button) => button.classList.remove('selected'));
    control.classList.add('selected');
    if (startAutoButton) startAutoButton.textContent = `OTOMATİK OYUNU BAŞLAT (${selectedAutoSpins})`;
  });
});
startAutoButton?.addEventListener('click', startConfiguredAuto);
document.querySelector('#confirm-buy')?.addEventListener('click', () => void buyBonus());

function toggleInfo(): void {
  if (!gameState.interactive || dialogVisible()) return;
  refreshInfo();
  infoOverlay.visible = !infoOverlay.visible;
}

function refreshInfo(): void {
  const paytable = SYMBOLS.map((symbol) => {
    const values = [3, 4, 5].map((count) => ((symbol.payout[count] ?? 0) * PAYOUT_FACTOR).toFixed(2));
    return `${symbol.name.padEnd(18)} ${values.join('x / ')}x`;
  }).join('\n');
  const history = spinHistory.length > 0
    ? spinHistory.slice(-5).reverse().map((entry, index) =>
      `${index + 1}. ${entry.free ? 'FREE' : `${entry.bet.toFixed(0)} Noah`}  →  ${entry.win.toFixed(2)} Noah`,
    ).join('\n')
    : 'Henüz dönüş yapılmadı.';
  infoBody.text = `20 ÖDEME ÇİZGİSİ • SOLDAN SAĞA 3+\nTrina WILD yerine geçer • 3+ kristal Magic Anvil açar\n\nSEMBOL                 3 / 4 / 5\n${paytable}\n\nSON 5 OYUN\n${history}\n\nSpace: Spin • A: Auto • M: Ses • Kapatmak için dokun.`;
}

function toggleAuto(): void {
  if (autoSpins > 0) {
    autoSpins = 0;
    statusText.text = 'Otomatik dönüş durduruldu.';
  } else if (gameState.interactive && freeSpins === 0) {
    openAutoDialog();
  }
  updateHud();
}

function changeBet(direction: number): void {
  if (!gameState.interactive || freeSpins > 0 || dialogVisible()) return;
  betIndex = Math.max(0, Math.min(BETS.length - 1, betIndex + direction));
  updateHud();
}

function updateHud(): void {
  balanceText.text = balance.toFixed(2);
  betText.text = `${BETS[betIndex].toFixed(2)} Noah`;
  winText.text = lastWin.toFixed(2);
  lastSpinWinText.text = previousSpinWin.toFixed(2);
  spinLabel.text = gameState.state === GamePhase.Spinning || gameState.state === GamePhase.Stopping
    ? 'STOP'
    : gameState.state === GamePhase.Presenting
      ? 'DEVAM'
    : freeSpins > 0
      ? `FREE ${freeSpins} • ${freeSpinMultiplier.toFixed(2)}x`
      : 'SPIN';
  document.querySelector('#mobile-balance')!.textContent = balance.toFixed(2);
  document.querySelector('#mobile-bet')!.textContent = BETS[betIndex].toFixed(2);
  document.querySelector('#mobile-win')!.textContent = previousSpinWin.toFixed(2);
  document.querySelector('#mobile-spin')!.textContent = spinLabel.text;
  (autoButton.children[1] as Text).text = autoSpins > 0 ? `A:${autoSpins}` : 'AUTO';
  document.querySelector('#mobile-auto')!.textContent = autoSpins > 0 ? `A:${autoSpins}` : 'AUTO';
  if (buyPriceText) buyPriceText.textContent = `${(BETS[betIndex] * 50).toFixed(2)} Noah`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function shakeWorld(duration = 520, intensity = 9): Promise<void> {
  const originX = world.x;
  const originY = world.y;
  const started = performance.now();
  while (true) {
    const progress = Math.min(1, (performance.now() - started) / duration);
    const strength = intensity * (1 - progress);
    world.position.set(
      originX + (Math.random() - 0.5) * strength,
      originY + (Math.random() - 0.5) * strength,
    );
    if (progress >= 1) break;
    await new Promise(requestAnimationFrame);
  }
  world.position.set(originX, originY);
}

function resetSymbolPresentation(): void {
  winPresenter.reset();
}

async function showWins(win: WinResult): Promise<void> {
  await winPresenter.show(win);
}

async function spin(): Promise<void> {
  if (gameState.state === GamePhase.Spinning || gameState.state === GamePhase.Stopping) {
    reelManager.quickStop();
    statusText.text = 'Makaralar hızlı durduruluyor…';
    return;
  }
  if (gameState.state === GamePhase.Presenting) {
    winPresenter.requestSkip();
    statusText.text = 'Kazanç sunumu tamamlanıyor…';
    return;
  }
  if (!gameState.interactive || infoOverlay.visible || dialogVisible()) return;
  const bet = BETS[betIndex];
  const isFree = freeSpins > 0;
  if (!isFree && balance < bet) {
    autoSpins = 0;
    statusText.text = 'Yetersiz demo bakiyesi.';
    updateHud();
    return;
  }

  gameState.transition(GamePhase.Spinning);
  audioManager.play('spin');
  lastWin = 0;
  resetSymbolPresentation();
  if (isFree) freeSpins -= 1;
  else {
    balance -= bet;
    if (autoSpins > 0) autoSpins -= 1;
  }
  statusText.text = isFree ? 'Ücretsiz dönüş başladı…' : 'Makaralar dönüyor…';
  updateHud();

  const outcome = forcedResult
    ? { matrix: forcedResult, stops: slotEngine.findStops(forcedResult) }
    : slotEngine.spinWithStops();
  forcedResult = null;
  await reelManager.spin(outcome.matrix, outcome.stops);
  if ((gameState.state as GamePhase) === GamePhase.Spinning) gameState.transition(GamePhase.Stopping);
  gameState.transition(GamePhase.Presenting);
  let win = slotEngine.evaluate(outcome.matrix, bet);
  if (isFree && freeSpinMultiplier > 1) {
    win = {
      ...win,
      amount: Math.round(win.amount * freeSpinMultiplier * 100) / 100,
      multiplier: win.multiplier * freeSpinMultiplier,
    };
  }
  lastWin = win.amount;
  previousSpinWin = win.amount;
  balance += win.amount;
  spinHistory.push({ bet, win: win.amount, free: isFree });
  if (spinHistory.length > 20) spinHistory.shift();

  if (win.scatters >= 3) {
    audioManager.play('scatter', win.scatters);
    statusText.text = `MAGIC ANVIL BONUSU! ${win.scatters} kristal toplandı.`;
  } else if (win.amount > 0) {
    audioManager.play(win.multiplier >= 10 ? 'big-win' : 'win');
    statusText.text = `${win.lines} çizgi kazandı • ${win.amount.toFixed(2)} Noah`;
  } else {
    statusText.text = isFree && freeSpins > 0 ? `${freeSpins} ücretsiz dönüş kaldı.` : 'Bir sonraki upgrade daha şanslı olabilir.';
  }

  updateHud();
  if (win.positions.size > 0) await showWins(win);
  if (win.scatters >= 3) {
    gameState.transition(GamePhase.BonusIntro);
    const bonus = await anvilBonus.open(win.scatters);
    freeSpins += bonus.freeSpins;
    freeSpinMultiplier = bonus.multiplier;
    statusText.text = `+${bonus.level} item • ${bonus.freeSpins} Free Spin • ${bonus.multiplier.toFixed(2)}x çarpan`;
    updateHud();
  } else if (isFree && freeSpins === 0) {
    freeSpinMultiplier = 1;
    statusText.text = 'Free Spin turu tamamlandı.';
    updateHud();
  }
  gameState.transition(GamePhase.Idle);
  updateHud();
  if (freeSpins > 0) {
    await wait(quickSpin ? 150 : 450);
    void spin();
  } else if (autoSpins > 0) {
    await wait(quickSpin ? 130 : 420);
    void spin();
  }
}

gameState.onChange((phase) => {
  spinLabel.text = phase === GamePhase.Spinning || phase === GamePhase.Stopping
    ? 'STOP'
    : phase === GamePhase.Presenting
      ? 'DEVAM'
    : freeSpins > 0
      ? `FREE ${freeSpins} • ${freeSpinMultiplier.toFixed(2)}x`
      : 'SPIN';
  (document.querySelector('#mobile-spin') as HTMLButtonElement).textContent = spinLabel.text;
});

document.querySelector('#mobile-spin')?.addEventListener('click', () => void spin());
document.querySelector('#mobile-bet-down')?.addEventListener('click', () => changeBet(-1));
document.querySelector('#mobile-bet-up')?.addEventListener('click', () => changeBet(1));
document.querySelector('#mobile-auto')?.addEventListener('click', toggleAuto);
document.querySelector('#mobile-buy')?.addEventListener('click', openBuyDialog);
document.querySelector('#mobile-info')?.addEventListener('click', toggleInfo);
document.querySelector('#mobile-mute')?.addEventListener('click', () => {
  const muted = audioManager.toggleMute();
  (document.querySelector('#mobile-mute') as HTMLButtonElement).textContent = muted ? '×' : '♪';
  (muteButton.children[1] as Text).text = muted ? '×' : '♪';
});

let previousMobileStatus = '';
app.ticker.add(() => {
  if (statusText.text === previousMobileStatus) return;
  previousMobileStatus = statusText.text;
  const mobileStatus = document.querySelector('#mobile-status');
  if (mobileStatus) mobileStatus.textContent = statusText.text;
});

window.addEventListener('keydown', (event) => {
  if (introActive) {
    if (event.code === 'Enter' || event.code === 'Space') {
      event.preventDefault();
      void dismissIntro();
    }
    return;
  }
  if (dialogVisible()) {
    if (event.key === 'Escape') closeGameDialogs();
    return;
  }
  if ((event.target as HTMLElement).matches('input, button')) return;
  if (event.code === 'Space') {
    event.preventDefault();
    void spin();
  } else if (event.key === 'ArrowLeft') changeBet(-1);
  else if (event.key === 'ArrowRight') changeBet(1);
  else if (event.key.toLowerCase() === 'm') {
    const muted = audioManager.toggleMute();
    (muteButton.children[1] as Text).text = muted ? '×' : '♪';
    (document.querySelector('#mobile-mute') as HTMLButtonElement).textContent = muted ? '×' : '♪';
  } else if (event.key.toLowerCase() === 'i') toggleInfo();
  else if (event.key.toLowerCase() === 'a') toggleAuto();
});

function resize(): void {
  const portrait = app.screen.width < app.screen.height && app.screen.width <= 700;
  const desktopOnly = [
    bg,
    shade,
    topShade,
    title,
    subtitle,
    statusText,
    hud,
    balanceText,
    betText,
    winText,
    betDown,
    betUp,
    spinButton,
    infoButton,
    muteButton,
    autoButton,
    buyButton,
    lastWinPanel,
    lastWinCaption,
    lastSpinWinText,
    ...desktopStatCaptions,
  ];
  desktopOnly.forEach((element) => { element.visible = !portrait; });

  if (portrait) {
    const cabinetWidth = CELL_W * COLS + 44;
    const cabinetHeight = CELL_H * ROWS + 44;
    const scale = (app.screen.width - 16) / cabinetWidth;
    const boardTop = Math.max(92, Math.min(142, app.screen.height * 0.15));
    const boardLeft = REEL_X - 22;
    const boardY = REEL_Y - 22;
    world.scale.set(scale);
    world.position.set(
      (app.screen.width - cabinetWidth * scale) / 2 - boardLeft * scale,
      boardTop - boardY * scale,
    );
    document.documentElement.style.setProperty(
      '--mobile-board-bottom',
      `${Math.round(boardTop + cabinetHeight * scale)}px`,
    );
    return;
  }

  document.documentElement.style.removeProperty('--mobile-board-bottom');
  const scale = Math.min(app.screen.width / DESIGN_W, app.screen.height / DESIGN_H);
  bg.visible = !portrait;
  world.scale.set(scale);
  world.position.set(
    (app.screen.width - DESIGN_W * scale) / 2,
    (app.screen.height - DESIGN_H * scale) / 2,
  );
}

window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) app.stop();
  else app.start();
});
resize();
updateHud();
gameState.transition(GamePhase.Idle);

const introScreen = document.querySelector<HTMLElement>('#intro-screen');
const enterGameButton = document.querySelector<HTMLButtonElement>('#enter-game');
const pageParams = new URLSearchParams(window.location.search);
const skipIntro = pageParams.get('skipIntro') === '1'
  || pageParams.has('scene')
  || pageParams.has('scenario')
  || pageParams.get('debug') === '1';

async function dismissIntro(): Promise<void> {
  if (!introActive || !introScreen) return;
  introActive = false;
  await audioManager.unlock();
  audioManager.play('click');
  introScreen.classList.add('leaving');
  await wait(760);
  introScreen.hidden = true;
  introScreen.classList.remove('visible', 'leaving');
}

enterGameButton?.addEventListener('click', () => void dismissIntro());
if (!skipIntro && introScreen) {
  introActive = true;
  introScreen.classList.add('visible');
  introScreen.hidden = false;
  requestAnimationFrame(() => document.querySelector('#loading')?.classList.add('hidden'));
  window.setTimeout(() => enterGameButton?.focus(), 850);
} else {
  document.querySelector('#loading')?.classList.add('hidden');
}

type DebugScenario = keyof typeof DEBUG_SCENARIOS;
const debugApi = {
  spin: () => spin(),
  force: (scenario: DebugScenario) => {
    forcedResult = cloneScenario(scenario);
    return spin();
  },
  anvil: async (level = 7) => {
    if (!gameState.interactive) return null;
    gameState.transition(GamePhase.BonusIntro);
    const result = await anvilBonus.openDebug(level);
    gameState.transition(GamePhase.Idle);
    updateHud();
    return result;
  },
  getState: () => gameState.state,
};
(window as Window & { moradonDebug?: typeof debugApi }).moradonDebug = debugApi;

if (new URLSearchParams(window.location.search).get('debug') === '1') {
  const panel = document.createElement('aside');
  panel.id = 'debug-panel';
  panel.innerHTML = `
    <strong>MORADON DEBUG</strong>
    <label>Seed <input type="number" value="20260824" /></label>
    <button data-action="seed">Seed uygula</button>
    <button data-scenario="loss">Loss</button>
    <button data-scenario="big-win">Big Win</button>
    <button data-scenario="anvil">Anvil</button>
    <button data-anvil-level="5">Anvil +5</button>
    <button data-anvil-level="7">Anvil +7</button>
    <button data-anvil-level="8">Anvil +8</button>
    <output>idle</output>
  `;
  document.body.appendChild(panel);
  const input = panel.querySelector('input');
  const output = panel.querySelector('output');
  panel.querySelector('[data-action="seed"]')?.addEventListener('click', () => {
    slotEngine = new SlotEngine(new SeededRandom(Number(input?.value ?? 20260824)));
    if (output) output.textContent = `seed: ${input?.value}`;
  });
  panel.querySelectorAll<HTMLButtonElement>('[data-scenario]').forEach((control) => {
    control.addEventListener('click', () => {
      const scenario = control.dataset.scenario as DebugScenario;
      forcedResult = cloneScenario(scenario);
      void spin();
    });
  });
  panel.querySelectorAll<HTMLButtonElement>('[data-anvil-level]').forEach((control) => {
    control.addEventListener('click', () => {
      void debugApi.anvil(Number(control.dataset.anvilLevel));
    });
  });
  gameState.onChange((phase) => { if (output) output.textContent = phase; });
}

const scenarioParam = new URLSearchParams(window.location.search).get('scenario');
if (scenarioParam && scenarioParam in DEBUG_SCENARIOS) {
  forcedResult = cloneScenario(scenarioParam as DebugScenario);
  window.setTimeout(() => void spin(), 350);
}

if (new URLSearchParams(window.location.search).get('scene') === 'anvil') {
  gameState.transition(GamePhase.BonusIntro);
  const debugLevel = Number(new URLSearchParams(window.location.search).get('level'));
  window.setTimeout(() => {
    if (Number.isFinite(debugLevel) && debugLevel >= 1) void anvilBonus.openDebug(debugLevel);
    else void anvilBonus.open(4);
  }, 180);
}
