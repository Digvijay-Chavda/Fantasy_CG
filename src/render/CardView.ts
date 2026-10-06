import gsap from 'gsap';
import { Container, Sprite } from 'pixi.js';
import type { CardDef, PlayerId } from '../game/engine';
import { OWNER_COLORS, backTexture, faceTexture, haloTexture, rarityGlow, shadowTexture } from './textures';

/** Where a card rests in its hand/board slot; hover and drag move it away from here. */
export interface Home {
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

/** One card on the table: shadow, glow halo and a face sprite that can flip over. */
export class CardView extends Container {
  readonly uid: number;
  def: CardDef | null = null;
  owner: PlayerId = 'player';
  faceDown = true;
  home: Home = { x: 0, y: 0, rotation: 0, scale: 1 };

  private readonly shadow = new Sprite(shadowTexture());
  private readonly halo = new Sprite(haloTexture());
  readonly face = new Sprite(backTexture());
  private haloPulse: gsap.core.Tween | null = null;

  constructor(uid: number) {
    super();
    this.uid = uid;
    for (const s of [this.shadow, this.halo, this.face]) s.anchor.set(0.5);
    this.halo.blendMode = 'add';
    this.halo.alpha = 0;
    this.shadow.alpha = 0.6;
    this.shadow.position.set(4, 10);
    this.addChild(this.shadow, this.halo, this.face);
    this.eventMode = 'static';
  }

  /** Show the front of a card. */
  show(def: CardDef, owner: PlayerId) {
    this.def = def;
    this.owner = owner;
    this.faceDown = false;
    this.face.texture = faceTexture(def, owner);
    this.face.scale.x = 1;
  }

  /** Show the back (enemy hand). */
  hide() {
    this.faceDown = true;
    this.face.texture = backTexture();
    this.face.scale.x = 1;
  }

  /** Re-fetch the face texture (real artwork finished loading). */
  refresh() {
    if (this.def && !this.faceDown) this.face.texture = faceTexture(this.def, this.owner);
  }

  /** Turn the card over to show `def` for `owner` (reveal) or to recolour a captured card. */
  flip(owner: PlayerId, def: CardDef | null = this.def, duration = 0.16): Promise<void> {
    return new Promise((resolve) => {
      gsap.to(this.face.scale, {
        x: 0,
        duration,
        ease: 'power2.in',
        onComplete: () => {
          if (def) this.show(def, owner);
          gsap.to(this.face.scale, { x: 1, duration, ease: 'power2.out', onComplete: resolve });
        },
      });
    });
  }

  /** Coloured glow behind the card. `pulse` makes it breathe until cleared. */
  setHalo(tint: number | null, alpha = 0.9, pulse = false) {
    this.haloPulse?.kill();
    this.haloPulse = null;
    if (tint === null) {
      gsap.to(this.halo, { alpha: 0, duration: 0.2 });
      return;
    }
    this.halo.tint = tint;
    gsap.to(this.halo, { alpha, duration: 0.15 });
    if (pulse) this.haloPulse = gsap.to(this.halo, { alpha: alpha * 0.45, duration: 0.55, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 0.15 });
  }

  /** One bright flash in the owner's colour (captures). */
  flash(owner: PlayerId) {
    this.haloPulse?.kill();
    this.halo.tint = OWNER_COLORS[owner].glow;
    this.halo.alpha = 1;
    gsap.to(this.halo, { alpha: 0, duration: 0.6, ease: 'power2.out' });
  }

  /** Subtle rarity aura for epic/legendary cards that are resting on the table. */
  idleAura() {
    if (!this.def || (this.def.rarity !== 'EPIC' && this.def.rarity !== 'LEGENDARY')) return;
    this.setHalo(rarityGlow(this.def.rarity), 0.5, true);
  }

  setShadow(alpha: number) {
    this.shadow.alpha = alpha;
  }

  override destroy(options?: Parameters<Container['destroy']>[0]) {
    this.haloPulse?.kill();
    gsap.killTweensOf([this, this.scale, this.face.scale, this.halo]);
    super.destroy(options);
  }
}
