import gsap from 'gsap';
import { Container, Sprite, Text } from 'pixi.js';
import { glowTexture, ringTexture } from './textures';

interface Particle {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  max: number;
  gravity: number;
  size0: number;
  size1: number;
  spin: number;
  /** 'bell' fades in then out (embers); 'out' fades out only (sparks). */
  fade: 'bell' | 'out';
  alpha: number;
}

/** Sparks, embers, rings, beams and floating text, all drawn with additive glow sprites. */
export class Fx {
  readonly layer = new Container();
  private particles: Particle[] = [];
  private emberClock = 0;

  /** Advance particles; `dt` in seconds. */
  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life += dt;
      if (p.life >= p.max) {
        p.s.destroy();
        this.particles.splice(i, 1);
        continue;
      }
      const t = p.life / p.max;
      p.vy += p.gravity * dt;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      p.s.rotation += p.spin * dt;
      p.s.scale.set(p.size0 + (p.size1 - p.size0) * t);
      p.s.alpha = p.alpha * (p.fade === 'bell' ? Math.sin(Math.PI * t) : 1 - t * t);
    }
  }

  private spawn(x: number, y: number, tint: number, o: Partial<Particle> & { vx: number; vy: number; max: number }) {
    const s = new Sprite(glowTexture());
    s.anchor.set(0.5);
    s.tint = tint;
    s.blendMode = 'add';
    s.position.set(x, y);
    this.layer.addChild(s);
    this.particles.push({
      s, life: 0, gravity: 0, size0: 0.3, size1: 0.05, spin: 0, fade: 'out', alpha: 1, ...o,
    });
  }

  burst(x: number, y: number, tint: number, count = 16, speed = 260, size = 0.45, life = 0.7, gravity = 380) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      this.spawn(x, y, tint, {
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.2, max: life * (0.6 + Math.random() * 0.7),
        gravity, size0: size * (0.6 + Math.random() * 0.8), size1: 0.02,
      });
    }
  }

  confetti(w: number, h: number, colors: number[]) {
    for (let i = 0; i < 90; i++) {
      this.spawn(Math.random() * w, -20 - Math.random() * 80, colors[i % colors.length]!, {
        vx: (Math.random() - 0.5) * 140, vy: 60 + Math.random() * 160, max: 2.8 + Math.random() * 1.6,
        gravity: 140, size0: 0.35 + Math.random() * 0.3, size1: 0.2, spin: (Math.random() - 0.5) * 8, fade: 'out',
      });
    }
    void h;
  }

  /** Slow rising embers; call every frame with the canvas size. */
  ambient(dt: number, w: number, h: number) {
    this.emberClock += dt;
    while (this.emberClock > 0.18) {
      this.emberClock -= 0.18;
      const warm = [0xffb347, 0xff7a3d, 0xc084fc][Math.floor(Math.random() * 3)]!;
      this.spawn(Math.random() * w, h + 10, warm, {
        vx: (Math.random() - 0.5) * 24, vy: -(20 + Math.random() * 40), max: 6 + Math.random() * 5,
        size0: 0.12 + Math.random() * 0.14, size1: 0.05, fade: 'bell', alpha: 0.7,
      });
    }
  }

  ring(x: number, y: number, tint: number, size: number) {
    const r = new Sprite(ringTexture());
    r.anchor.set(0.5);
    r.position.set(x, y);
    r.tint = tint;
    r.blendMode = 'add';
    r.scale.set(size / 256 * 0.4);
    this.layer.addChild(r);
    gsap.to(r.scale, { x: size / 256 * 1.5, y: size / 256 * 1.5, duration: 0.55, ease: 'power2.out' });
    gsap.to(r, { alpha: 0, duration: 0.55, ease: 'power1.in', onComplete: () => r.destroy() });
  }

  /** A quick glowing streak between two points (capture direction). */
  beam(x1: number, y1: number, x2: number, y2: number, tint: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const s = new Sprite(glowTexture());
    s.anchor.set(0.5);
    s.position.set((x1 + x2) / 2, (y1 + y2) / 2);
    s.rotation = Math.atan2(dy, dx);
    s.tint = tint;
    s.blendMode = 'add';
    s.scale.set(len / 128, 0.22);
    this.layer.addChild(s);
    gsap.to(s, { alpha: 0, duration: 0.45, ease: 'power2.in', onComplete: () => s.destroy() });
    gsap.to(s.scale, { y: 0.02, duration: 0.45 });
  }

  floatText(x: number, y: number, text: string, color: string, size = 34) {
    const t = new Text({
      text,
      style: { fontFamily: '"Cinzel", Georgia, serif', fontSize: size, fontWeight: '800', fill: color, stroke: { color: '#000000', width: 6 } },
    });
    t.anchor.set(0.5);
    t.position.set(x, y);
    t.scale.set(0.4);
    this.layer.addChild(t);
    gsap.to(t.scale, { x: 1, y: 1, duration: 0.25, ease: 'back.out(3)' });
    gsap.to(t, { y: y - 56, duration: 0.9, ease: 'power2.out' });
    gsap.to(t, { alpha: 0, duration: 0.35, delay: 0.55, onComplete: () => t.destroy() });
  }

  /** Quick positional shake of any display object (used on the whole table). */
  shake(target: { x: number; y: number }, magnitude = 6, duration = 0.32) {
    const ox = target.x;
    const oy = target.y;
    const tl = gsap.timeline({ onComplete: () => { target.x = ox; target.y = oy; } });
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const k = 1 - i / steps;
      tl.to(target, {
        x: ox + (Math.random() - 0.5) * 2 * magnitude * k,
        y: oy + (Math.random() - 0.5) * 2 * magnitude * k,
        duration: duration / steps,
        ease: 'none',
      });
    }
  }
}
