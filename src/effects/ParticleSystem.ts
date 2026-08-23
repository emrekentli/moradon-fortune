import { Container, Graphics, type Ticker } from 'pixi.js';

type Particle = {
  view: Graphics;
  vx: number;
  vy: number;
  gravity: number;
  life: number;
  maxLife: number;
  rotationSpeed: number;
};

export class ParticleSystem {
  readonly container = new Container();
  private particles: Particle[] = [];

  constructor(ticker: Ticker) {
    ticker.add((time) => this.update(time.deltaTime));
  }

  burst(x: number, y: number, color: number, amount = 18): void {
    for (let i = 0; i < amount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 6;
      const size = 2 + Math.random() * 5;
      const view = new Graphics()
        .star(0, 0, Math.random() > 0.45 ? 4 : 6, size, size * 0.35)
        .fill({ color, alpha: 0.9 });
      view.position.set(x, y);
      this.container.addChild(view);
      this.particles.push({
        view,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        gravity: 0.13 + Math.random() * 0.08,
        life: 38 + Math.random() * 30,
        maxLife: 68,
        rotationSpeed: (Math.random() - 0.5) * 0.25,
      });
    }
  }

  coinRain(amount = 48): void {
    for (let index = 0; index < amount; index += 1) {
      const size = 5 + Math.random() * 5;
      const view = new Graphics()
        .ellipse(0, 0, size, size * 0.55)
        .fill({ color: index % 3 === 0 ? 0xfff0a0 : 0xe9aa24 })
        .stroke({ color: 0x7a4108, width: 1.5 });
      view.position.set(80 + Math.random() * 1120, -40 - Math.random() * 360);
      this.container.addChild(view);
      this.particles.push({
        view,
        vx: (Math.random() - 0.5) * 2.2,
        vy: 4 + Math.random() * 4,
        gravity: 0.035 + Math.random() * 0.035,
        life: 125 + Math.random() * 55,
        maxLife: 180,
        rotationSpeed: (Math.random() - 0.5) * 0.34,
      });
    }
  }

  private update(delta: number): void {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.life -= delta;
      particle.vy += particle.gravity * delta;
      particle.view.x += particle.vx * delta;
      particle.view.y += particle.vy * delta;
      particle.view.rotation += particle.rotationSpeed * delta;
      particle.view.alpha = Math.max(0, particle.life / particle.maxLife);
      particle.view.scale.set(0.6 + particle.life / particle.maxLife * 0.7);
      if (particle.life <= 0) {
        particle.view.destroy();
        this.particles.splice(index, 1);
      }
    }
  }
}
