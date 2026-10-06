import gsap from 'gsap';
import { Application, Container, FederatedPointerEvent, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { CARDS } from '../data/cards';
import { BOARD_SIZE, capturesFor, score as countScore } from '../game/engine';
import type { Capture, GameEvent, GameState, PlayerId } from '../game/engine';
import { audio } from './audio';
import { CardView } from './CardView';
import { Fx } from './fx';
import { computeLayout, type Layout } from './layout';
import { CARD_ASPECT, CARD_W, OWNER_COLORS, loadFonts, onArtLoaded, paintBoard, paintTable, paintTray, vignetteTexture } from './textures';

export interface SceneCallbacks {
  /** Return true if the move was accepted (the store then calls `play`). */
  onPlace(uid: number, cell: number): boolean;
  /** Board card counts, reported as captures land so the HUD can tick up in sync. */
  onScore(score: Record<PlayerId, number>): void;
}

interface Drag {
  view: CardView;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  moved: boolean;
}

const tweenTo = (target: object, vars: gsap.TweenVars) =>
  new Promise<void>((resolve) => {
    gsap.to(target, { ...vars, onComplete: () => resolve() });
  });
const wait = (seconds: number) => new Promise<void>((resolve) => gsap.delayedCall(seconds, () => resolve()));

/** The PixiJS table: board, both hands, input (drag / click), and every animation. */
export class TableScene {
  private app = new Application();
  private cb!: SceneCallbacks;
  private layout!: Layout;
  private size = BOARD_SIZE;
  private shown: GameState | null = null;
  private inputOn = false;
  private destroyed = false;

  private world = new Container();
  private bg = new Sprite();
  private plate = new Sprite();
  private trayP = new Sprite();
  private trayE = new Sprite();
  private cellHi = new Graphics();
  private boardLayer = new Container();
  private enemyLayer = new Container();
  private handLayer = new Container();
  private zoneLayer = new Container();
  private flyLayer = new Container();
  private uiLayer = new Container();
  private vignette = new Sprite(vignetteTexture());
  private fx = new Fx();
  private previewText!: Text;
  private nameLabel!: Text;
  private hiTween: gsap.core.Tween | null = null;

  /** Stationary hit areas for hand cards, so hover/drag don't flicker when a card lifts away. */
  private zones = new Map<number, Container>();
  private handViews = new Map<number, CardView>();
  private handOrder: number[] = [];
  private enemyViews = new Map<number, CardView>();
  private enemyOrder: number[] = [];
  private boardViews = new Map<number, CardView>();
  private lastPlaced: CardView | null = null;

  private selected: number | null = null;
  private drag: Drag | null = null;
  private hovered: number | null = null;
  private previewCell: number | null = null;
  private previewTargets: CardView[] = [];
  private unsubArt: (() => void) | null = null;

  async init(host: HTMLElement, cb: SceneCallbacks) {
    this.cb = cb;
    await loadFonts();
    await this.app.init({
      resizeTo: host,
      antialias: true,
      backgroundAlpha: 0,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    if (this.destroyed) {
      this.app.destroy(true, { children: true });
      return;
    }
    host.appendChild(this.app.canvas);

    const stage = this.app.stage;
    stage.eventMode = 'static';
    stage.hitArea = this.app.screen;
    this.world.sortableChildren = true;
    this.handLayer.sortableChildren = true;
    this.enemyLayer.sortableChildren = true;
    this.cellHi.eventMode = 'none';
    this.fx.layer.eventMode = 'none';
    this.uiLayer.eventMode = 'none';
    this.vignette.eventMode = 'none';
    this.bg.eventMode = 'none';
    this.plate.eventMode = 'none';
    this.trayP.eventMode = 'none';
    this.trayE.eventMode = 'none';
    this.world.addChild(this.bg, this.plate, this.trayE, this.trayP, this.cellHi, this.boardLayer, this.enemyLayer, this.handLayer, this.zoneLayer, this.flyLayer, this.fx.layer, this.uiLayer);
    stage.addChild(this.world, this.vignette);

    const style = { fontFamily: '"Cinzel", Georgia, serif', fontWeight: '800' as const, stroke: { color: '#000000', width: 6 } };
    this.previewText = new Text({ text: '', style: { ...style, fontSize: 44, fill: '#ffe08a' } });
    this.previewText.anchor.set(0.5);
    this.previewText.visible = false;
    this.nameLabel = new Text({ text: '', style: { ...style, fontSize: 18, fill: '#ffffff', stroke: { color: '#000000', width: 4 } } });
    this.nameLabel.anchor.set(0.5, 1);
    this.nameLabel.visible = false;
    this.uiLayer.addChild(this.previewText, this.nameLabel);

    this.relayout();
    this.app.renderer.on('resize', () => this.relayout());
    this.app.ticker.add((t) => {
      const dt = Math.min(t.deltaMS / 1000, 0.05);
      this.fx.update(dt);
      this.fx.ambient(dt, this.app.screen.width, this.app.screen.height);
    });

    stage.on('pointermove', (e) => this.onMove(e));
    stage.on('pointerup', (e) => this.onUp(e));
    stage.on('pointerupoutside', (e) => this.onUp(e));
    stage.on('pointerdown', (e) => this.onStageDown(e));
    this.unsubArt = onArtLoaded(() => {
      for (const v of [...this.handViews.values(), ...this.boardViews.values()]) v.refresh();
      this.flyLayer.children.forEach((c) => c instanceof CardView && c.refresh());
    });
  }

  destroy() {
    this.destroyed = true;
    this.unsubArt?.();
    this.hiTween?.kill();
    gsap.killTweensOf('*');
    if (this.app.renderer) this.app.destroy(true, { children: true });
  }

  // ---------------------------------------------------------------- layout

  private relayout() {
    const { width: w, height: h } = this.app.screen;
    if (w < 2 || h < 2) return;
    this.layout = computeLayout(w, h, this.size);
    const L = this.layout;

    this.setTexture(this.bg, paintTable(w, h));
    this.setTexture(this.plate, paintBoard({ width: L.boardW, height: L.boardH, size: L.size, cellW: L.cellW, cellH: L.cellH, gap: L.gap, pad: L.pad }));
    this.plate.position.set(L.boardX, L.boardY);
    this.setTexture(this.trayP, paintTray(L.playerTray.w, L.playerTray.h));
    this.trayP.position.set(L.playerTray.x, L.playerTray.y);
    this.setTexture(this.trayE, paintTray(L.enemyTray.w, L.enemyTray.h));
    this.trayE.position.set(L.enemyTray.x, L.enemyTray.y);
    this.vignette.width = w;
    this.vignette.height = h;
    this.app.stage.hitArea = this.app.screen;

    this.boardViews.forEach((v, cell) => this.setHome(v, { ...L.cell(cell), rotation: 0, scale: L.cardScale }, false));
    this.layoutHand(false);
    this.layoutEnemy(false);
    this.redrawCellHighlights();
  }

  private setTexture(sprite: Sprite, canvas: HTMLCanvasElement) {
    const old = sprite.texture;
    sprite.texture = Texture.from(canvas);
    if (old && old !== Texture.EMPTY && old !== Texture.WHITE) old.destroy(true);
  }

  private setHome(view: CardView, home: CardView['home'], animate: boolean, duration = 0.35) {
    view.home = home;
    gsap.killTweensOf([view, view.scale]);
    if (!animate) {
      view.position.set(home.x, home.y);
      view.rotation = home.rotation;
      view.scale.set(home.scale);
      return;
    }
    gsap.to(view, { x: home.x, y: home.y, rotation: home.rotation, duration, ease: 'power3.out' });
    gsap.to(view.scale, { x: home.scale, y: home.scale, duration, ease: 'power3.out' });
  }

  private layoutHand(animate: boolean) {
    const n = this.handOrder.length;
    this.handOrder.forEach((uid, i) => {
      const v = this.handViews.get(uid);
      if (!v || this.drag?.view === v) return;
      v.zIndex = i;
      this.setHome(v, this.layout.hand(i, n), animate);
    });
    this.layoutZones();
  }

  /** Each hand card owns the strip of the fan that is not covered by its neighbour. */
  private layoutZones() {
    const n = this.handOrder.length;
    const L = this.layout;
    const step = n > 1 ? Math.abs(L.hand(1, n).x - L.hand(0, n).x) : 0;
    this.handOrder.forEach((uid, i) => {
      const z = this.zones.get(uid);
      if (!z) return;
      const h = L.hand(i, n);
      const cw = CARD_W * h.scale;
      const ch = cw * CARD_ASPECT;
      const left = i === 0 ? h.x - cw / 2 : h.x - step / 2;
      const right = i === n - 1 ? h.x + cw / 2 : h.x + step / 2;
      const lift = L.cellH * 0.5;
      z.hitArea = new Rectangle(left, h.y - ch / 2 - lift, right - left, ch + lift);
    });
  }

  private layoutEnemy(animate: boolean) {
    const n = this.enemyOrder.length;
    this.enemyOrder.forEach((uid, i) => {
      const v = this.enemyViews.get(uid);
      if (!v) return;
      v.zIndex = i;
      this.setHome(v, this.layout.enemy(i, n), animate);
    });
  }

  /** Screen position of a board cell / hand card (used by the automated browser test). */
  debugPoints() {
    const L = this.layout;
    return {
      cells: Array.from({ length: L.size * L.size }, (_, i) => L.cell(i)),
      hand: this.handOrder.map((uid) => this.handViews.get(uid)!.home),
    };
  }

  // ---------------------------------------------------------------- state sync

  private clearViews() {
    for (const v of [...this.handViews.values(), ...this.enemyViews.values(), ...this.boardViews.values()]) v.destroy();
    this.zones.forEach((z) => z.destroy());
    this.zones.clear();
    this.handViews.clear();
    this.enemyViews.clear();
    this.boardViews.clear();
    this.handOrder = [];
    this.enemyOrder = [];
    this.lastPlaced = null;
    this.selected = null;
    this.drag = null;
    this.clearPreview();
    this.redrawCellHighlights();
  }

  /** Empty the table (e.g. before a new game is dealt). */
  clear() {
    this.clearViews();
    this.shown = null;
  }

  private makeHandView(uid: number, cardId: string) {
    const v = new CardView(uid);
    v.show(CARDS[cardId]!, 'player');
    v.eventMode = 'none';
    const z = new Container();
    z.eventMode = this.inputOn ? 'static' : 'none';
    z.cursor = 'grab';
    z.on('pointerover', () => this.onHover(v, true));
    z.on('pointerout', () => this.onHover(v, false));
    z.on('pointerdown', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      this.onCardDown(v, e);
    });
    this.zoneLayer.addChild(z);
    this.zones.set(uid, z);
    this.handLayer.addChild(v);
    this.handViews.set(uid, v);
    return v;
  }

  private dropZone(uid: number) {
    this.zones.get(uid)?.destroy();
    this.zones.delete(uid);
  }

  private makeEnemyView(uid: number) {
    const v = new CardView(uid);
    v.hide();
    v.eventMode = 'none';
    this.enemyLayer.addChild(v);
    this.enemyViews.set(uid, v);
    return v;
  }

  /** Instantly show `state` (page refresh / resume). */
  sync(state: GameState) {
    this.clearViews();
    this.adoptSize(state.size);
    const L = this.layout;
    state.board.forEach((c, cell) => {
      if (!c) return;
      const v = new CardView(c.uid);
      v.show(CARDS[c.cardId]!, c.owner);
      v.eventMode = 'none';
      this.setHome(v, { ...L.cell(cell), rotation: 0, scale: L.cardScale }, false);
      v.idleAura();
      this.boardLayer.addChild(v);
      this.boardViews.set(cell, v);
    });
    for (const c of state.hands.player) {
      this.makeHandView(c.uid, c.cardId);
      this.handOrder.push(c.uid);
    }
    for (const c of state.hands.ai) {
      this.makeEnemyView(c.uid);
      this.enemyOrder.push(c.uid);
    }
    this.layoutHand(false);
    this.layoutEnemy(false);
    this.shown = state;
    this.cb.onScore(countScore(state));
    this.fadeIn();
  }

  private fadeIn() {
    for (const layer of [this.boardLayer, this.handLayer, this.enemyLayer]) {
      layer.alpha = 0;
      gsap.to(layer, { alpha: 1, duration: 0.5 });
    }
  }

  private adoptSize(size: number) {
    if (size !== this.size) {
      this.size = size;
      this.relayout();
    }
  }

  /** Animate a fresh deal: cards fly in from off-screen, the player's flip face-up. */
  async deal(state: GameState) {
    this.clearViews();
    this.adoptSize(state.size);
    const L = this.layout;
    this.shown = state;
    this.cb.onScore({ player: 0, ai: 0 });
    const jobs: Promise<void>[] = [];
    const n = Math.max(state.hands.player.length, state.hands.ai.length);
    for (const c of state.hands.player) this.handOrder.push(c.uid);
    for (const c of state.hands.ai) this.enemyOrder.push(c.uid);

    for (let i = 0; i < n; i++) {
      const pc = state.hands.player[i];
      const ec = state.hands.ai[i];
      if (ec) {
        const v = this.makeEnemyView(ec.uid);
        const home = L.enemy(i, state.hands.ai.length);
        v.position.set(L.spawnEnemy.x, L.spawnEnemy.y);
        v.scale.set(home.scale);
        v.rotation = -0.6;
        v.home = home;
        jobs.push(this.dealTo(v, home, i * 0.16, null));
      }
      if (pc) {
        const v = this.makeHandView(pc.uid, pc.cardId);
        const home = L.hand(i, state.hands.player.length);
        v.hide();
        v.position.set(L.spawnPlayer.x, L.spawnPlayer.y);
        v.scale.set(home.scale);
        v.rotation = 0.6;
        v.home = home;
        jobs.push(this.dealTo(v, home, i * 0.16 + 0.08, pc.cardId));
      }
    }
    await Promise.all(jobs);
    this.layoutZones();
  }

  private async dealTo(view: CardView, home: CardView['home'], delay: number, revealCardId: string | null) {
    await wait(delay);
    audio.play('deal', 0.9 + delay * 0.2);
    view.zIndex = 500;
    await Promise.all([
      tweenTo(view, { x: home.x, y: home.y, rotation: home.rotation, duration: 0.5, ease: 'power3.out' }),
      tweenTo(view.scale, { x: home.scale, y: home.scale, duration: 0.5, ease: 'power3.out' }),
    ]);
    if (revealCardId) await view.flip('player', CARDS[revealCardId]!, 0.12);
    view.zIndex = this.handOrder.indexOf(view.uid);
  }

  // ---------------------------------------------------------------- playing events

  /** Animate the events of one move; resolves when everything has landed. */
  async play(events: GameEvent[], after: GameState) {
    const placed = events.find((e): e is Extract<GameEvent, { type: 'PLACED' }> => e.type === 'PLACED');
    if (!placed) {
      this.sync(after);
      return;
    }
    this.select(null);
    const L = this.layout;
    const cell = placed.cell;
    const uid = after.board[cell]!.uid;
    const isPlayer = placed.player === 'player';
    const def = CARDS[placed.cardId]!;

    let view = (isPlayer ? this.handViews : this.enemyViews).get(uid);
    if (!view) {
      view = new CardView(uid);
      view.position.set(L.w / 2, isPlayer ? L.h : 0);
      view.scale.set(L.cardScale);
    }
    if (isPlayer) {
      this.handViews.delete(uid);
      this.dropZone(uid);
      this.handOrder = this.handOrder.filter((id) => id !== uid);
      this.layoutHand(true);
    } else {
      this.enemyViews.delete(uid);
      this.enemyOrder = this.enemyOrder.filter((id) => id !== uid);
      this.layoutEnemy(true);
    }
    view.eventMode = 'none';
    view.cursor = 'default';
    view.setHalo(null);
    this.flyLayer.addChild(view);
    this.nameLabel.visible = false;
    this.lastPlaced?.idleAura();

    const t = L.cell(cell);
    const cs = L.cardScale;
    const tint = OWNER_COLORS[placed.player].glow;
    if (!isPlayer) {
      // The enemy's card rises from its hand, turns face-up, then drops onto the board.
      const lift = { x: t.x, y: Math.max(L.enemyTray.y + L.enemyTray.h + 20, t.y - L.cellH * 0.9) };
      audio.play('select', 0.8);
      await Promise.all([
        tweenTo(view, { x: lift.x, y: lift.y, rotation: 0, duration: 0.4, ease: 'power2.out' }),
        tweenTo(view.scale, { x: cs * 1.3, y: cs * 1.3, duration: 0.4, ease: 'power2.out' }),
        view.flip('ai', def, 0.18),
      ]);
      await wait(0.22);
    } else {
      view.show(def, 'player');
    }
    view.setShadow(0.8);
    await Promise.all([
      tweenTo(view, { x: t.x, y: t.y, rotation: 0, duration: 0.24, ease: 'power3.in' }),
      tweenTo(view.scale, { x: cs * 1.22, y: cs * 1.22, duration: 0.2, ease: 'power1.out' }),
    ]);
    // impact
    audio.play('place');
    this.fx.shake(this.world, 5 + (events.length > 2 ? 3 : 0));
    this.fx.ring(t.x, t.y, tint, L.cellW * 1.5);
    this.fx.burst(t.x, t.y, tint, 14, L.cellW * 2.2, 0.5, 0.55, 500);
    this.boardLayer.addChild(view);
    this.boardViews.set(cell, view);
    view.owner = placed.player;
    gsap.to(view.scale, { x: cs, y: cs, duration: 0.28, ease: 'back.out(2.4)' });
    view.setShadow(0.45);
    view.setHalo(0xffd34e, 0.85, true);
    this.lastPlaced = view;
    view.home = { x: t.x, y: t.y, rotation: 0, scale: cs };
    this.cb.onScore(this.boardScore());

    const caps = events.filter((e): e is Extract<GameEvent, { type: 'CAPTURED' }> => e.type === 'CAPTURED');
    await wait(0.18);
    await Promise.all(caps.map((c, i) => this.captureAnim(c, cell, placed.player, i)));

    const over = events.find((e): e is Extract<GameEvent, { type: 'GAME_OVER' }> => e.type === 'GAME_OVER');
    this.shown = after;
    if (over) {
      await wait(0.35);
      this.finale(over.winner);
    }
  }

  private async captureAnim(c: Capture, fromCell: number, by: PlayerId, index: number) {
    await wait(index * 0.24);
    const view = this.boardViews.get(c.cell);
    if (!view) return;
    const L = this.layout;
    const a = L.cell(fromCell);
    const b = L.cell(c.cell);
    const tint = OWNER_COLORS[by].glow;
    this.fx.beam(a.x, a.y, b.x, b.y, tint);
    audio.play('flip', 1 + index * 0.14);
    gsap.fromTo(view, { y: b.y }, { y: b.y - L.cellH * 0.12, duration: 0.16, yoyo: true, repeat: 1, ease: 'sine.out' });
    await view.flip(by, view.def, 0.15);
    view.flash(by);
    this.fx.ring(b.x, b.y, tint, L.cellW);
    this.fx.burst(b.x, b.y, tint, 10, L.cellW * 1.6, 0.4, 0.5, 300);
    this.fx.floatText(b.x, b.y, `${c.attack} > ${c.defense}`, by === 'player' ? '#9cc4ff' : '#ff9aa6', Math.max(20, L.cellW * 0.32));
    this.cb.onScore(this.boardScore());
  }

  private boardScore(): Record<PlayerId, number> {
    const s: Record<PlayerId, number> = { player: 0, ai: 0 };
    this.boardViews.forEach((v) => s[v.owner]++);
    return s;
  }

  /** Victory / defeat flourish. */
  finale(winner: PlayerId | 'draw') {
    const L = this.layout;
    if (winner === 'player') {
      audio.play('win');
      this.fx.confetti(L.w, L.h, [0xffd34e, 0x5aa2ff, 0xc084fc, 0x6ee7a8, 0xff6b7a]);
      for (let i = 0; i < 5; i++) gsap.delayedCall(i * 0.25, () => this.fx.burst(L.w * (0.2 + Math.random() * 0.6), L.h * (0.25 + Math.random() * 0.3), 0xffd34e, 24, 340, 0.6, 1, 260));
    } else if (winner === 'ai') {
      audio.play('lose');
      this.fx.shake(this.world, 8, 0.5);
      this.boardViews.forEach((v) => v.owner === 'player' && gsap.to(v, { alpha: 0.6, duration: 0.6 }));
    } else {
      audio.play('turn');
    }
    this.boardViews.forEach((v, cell) => {
      if (v.owner === (winner === 'draw' ? v.owner : winner)) gsap.fromTo(v.scale, { x: L.cardScale, y: L.cardScale }, { x: L.cardScale * 1.08, y: L.cardScale * 1.08, duration: 0.25, yoyo: true, repeat: 1, delay: (cell % this.size) * 0.04 });
    });
  }

  /** Slide a banner across the screen ("YOUR TURN"). */
  async banner(text: string, tone: PlayerId | 'neutral' = 'neutral') {
    const L = this.layout;
    const color = tone === 'player' ? 0x1f4fb8 : tone === 'ai' ? 0xa3192c : 0x4a3480;
    const c = new Container();
    const band = new Graphics().rect(0, -30, L.w, 60).fill({ color, alpha: 0.82 });
    const edge = new Graphics().rect(0, -30, L.w, 2).fill({ color: 0xffe08a, alpha: 0.8 }).rect(0, 28, L.w, 2).fill({ color: 0xffe08a, alpha: 0.8 });
    const label = new Text({
      text: text.toUpperCase(),
      style: { fontFamily: '"Cinzel", Georgia, serif', fontSize: Math.min(34, L.w * 0.08), fontWeight: '800', fill: '#ffffff', letterSpacing: 6, stroke: { color: '#000000', width: 4 } },
    });
    label.anchor.set(0.5);
    label.position.set(L.w / 2, 0);
    c.addChild(band, edge, label);
    c.position.set(0, L.boardY + L.boardH / 2);
    c.alpha = 0;
    c.scale.y = 0.2;
    this.uiLayer.addChild(c);
    audio.play('turn', tone === 'ai' ? 0.8 : 1);
    await Promise.all([tweenTo(c, { alpha: 1, duration: 0.22 }), tweenTo(c.scale, { y: 1, duration: 0.25, ease: 'back.out(2)' })]);
    await wait(0.55);
    await Promise.all([tweenTo(c, { alpha: 0, duration: 0.25 }), tweenTo(c.scale, { y: 0.2, duration: 0.25 })]);
    c.destroy({ children: true });
  }

  // ---------------------------------------------------------------- input

  setInput(on: boolean) {
    this.inputOn = on;
    if (!on) {
      this.select(null);
      this.onHover(null, false);
    }
    this.zones.forEach((z) => (z.eventMode = on ? 'static' : 'none'));
  }

  /** The store refused a drop (e.g. it is not your turn): send the card home. */
  rejectDrop(uid: number) {
    const v = this.handViews.get(uid);
    audio.play('error');
    if (!v) return;
    this.fx.shake(v, 6, 0.3);
    this.returnHome(v);
  }

  private returnHome(v: CardView) {
    v.zIndex = Math.max(0, this.handOrder.indexOf(v.uid));
    v.setHalo(null);
    this.setHome(v, v.home, true, 0.3);
  }

  private onHover(v: CardView | null, on: boolean) {
    if (this.drag || !this.inputOn) return;
    if (!v) {
      this.hovered = null;
      this.nameLabel.visible = false;
      return;
    }
    if (this.selected === v.uid) return;
    if (on) {
      this.hovered = v.uid;
      audio.play('hover');
      v.zIndex = 500;
      gsap.killTweensOf([v, v.scale]);
      gsap.to(v, { y: v.home.y - this.layout.cellH * 0.28, rotation: 0, duration: 0.18, ease: 'power2.out' });
      gsap.to(v.scale, { x: v.home.scale * 1.22, y: v.home.scale * 1.22, duration: 0.18, ease: 'power2.out' });
      if (v.def) {
        this.nameLabel.text = v.def.name;
        this.nameLabel.position.set(v.home.x, v.home.y - this.layout.cellH * 0.28 - v.home.scale * 1.22 * (CARD_W * CARD_ASPECT) * 0.5 - 4);
        this.nameLabel.visible = true;
      }
    } else if (this.hovered === v.uid) {
      this.hovered = null;
      this.nameLabel.visible = false;
      this.returnHome(v);
    }
  }

  private onCardDown(v: CardView, e: FederatedPointerEvent) {
    if (!this.inputOn || this.drag) return;
    const p = this.world.toLocal(e.global);
    this.drag = { view: v, startX: p.x, startY: p.y, dx: v.x - p.x, dy: v.y - p.y, moved: false };
    this.nameLabel.visible = false;
  }

  private onMove(e: FederatedPointerEvent) {
    if (!this.inputOn) return;
    const p = this.world.toLocal(e.global);
    const d = this.drag;
    if (d) {
      if (!d.moved && Math.hypot(p.x - d.startX, p.y - d.startY) > 8) {
        d.moved = true;
        gsap.killTweensOf([d.view, d.view.scale]);
        d.view.zIndex = 1000;
        d.view.setShadow(0.8);
        audio.play('select');
        gsap.to(d.view.scale, { x: this.layout.cardScale * 1.08, y: this.layout.cardScale * 1.08, duration: 0.15 });
        gsap.to(d.view, { rotation: 0, duration: 0.15 });
        this.redrawCellHighlights();
      }
      if (d.moved) {
        d.view.position.set(p.x + d.dx * 0.3, p.y + d.dy * 0.3 - this.layout.cellH * 0.25);
        this.updatePreview(this.cellAt(p.x, p.y - this.layout.cellH * 0.1));
      }
    } else if (this.selected !== null) {
      this.updatePreview(this.cellAt(p.x, p.y));
    }
  }

  private onUp(e: FederatedPointerEvent) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    const p = this.world.toLocal(e.global);
    d.view.setShadow(0.6);
    if (!d.moved) {
      this.returnHome(d.view);
      this.select(this.selected === d.view.uid ? null : d.view.uid);
      return;
    }
    const cell = this.cellAt(p.x, p.y - this.layout.cellH * 0.1);
    this.clearPreview();
    if (cell !== null && !this.shown?.board[cell]) {
      if (!this.tryPlace(d.view.uid, cell)) this.rejectDrop(d.view.uid);
    } else {
      this.returnHome(d.view);
    }
    this.redrawCellHighlights();
  }

  private onStageDown(e: FederatedPointerEvent) {
    if (!this.inputOn || this.drag || this.selected === null) return;
    const p = this.world.toLocal(e.global);
    const cell = this.cellAt(p.x, p.y);
    if (cell !== null && !this.shown?.board[cell]) {
      if (!this.tryPlace(this.selected, cell)) this.rejectDrop(this.selected);
    } else {
      this.select(null);
    }
  }

  private tryPlace(uid: number, cell: number): boolean {
    const ok = this.cb.onPlace(uid, cell);
    if (ok) {
      this.clearPreview();
      this.selected = null;
      this.redrawCellHighlights();
    }
    return ok;
  }

  private select(uid: number | null) {
    if (this.selected !== null && this.selected !== uid) {
      const old = this.handViews.get(this.selected);
      if (old) this.returnHome(old);
    }
    this.selected = uid;
    if (uid !== null) {
      const v = this.handViews.get(uid);
      if (v) {
        audio.play('select');
        v.zIndex = 600;
        gsap.killTweensOf([v, v.scale]);
        gsap.to(v, { y: v.home.y - this.layout.cellH * 0.45, rotation: 0, duration: 0.2, ease: 'back.out(2)' });
        gsap.to(v.scale, { x: v.home.scale * 1.28, y: v.home.scale * 1.28, duration: 0.2 });
        v.setHalo(0xffd34e, 0.9, true);
      }
    }
    this.clearPreview();
    this.redrawCellHighlights();
  }

  private cellAt(x: number, y: number): number | null {
    const L = this.layout;
    for (let i = 0; i < L.size * L.size; i++) {
      const c = L.cell(i);
      if (Math.abs(x - c.x) <= (L.cellW + L.gap) / 2 && Math.abs(y - c.y) <= (L.cellH + L.gap) / 2) return i;
    }
    return null;
  }

  private activeUid(): number | null {
    return this.drag?.moved ? this.drag.view.uid : this.selected;
  }

  /** Green outlines on every empty cell while a card is being placed. */
  private redrawCellHighlights() {
    this.hiTween?.kill();
    this.hiTween = null;
    this.cellHi.clear();
    this.cellHi.alpha = 1;
    if (!this.layout || !this.shown || this.activeUid() === null || !this.inputOn) return;
    const L = this.layout;
    for (let i = 0; i < L.size * L.size; i++) {
      if (this.shown.board[i]) continue;
      const c = L.cell(i);
      this.cellHi.roundRect(c.x - L.cellW / 2, c.y - L.cellH / 2, L.cellW, L.cellH, 12).stroke({ width: 3, color: 0x6ee7a8, alpha: 0.95 });
    }
    this.hiTween = gsap.to(this.cellHi, { alpha: 0.35, duration: 0.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }

  private clearPreview() {
    this.previewTargets.forEach((v) => (this.lastPlaced === v ? v.setHalo(0xffd34e, 0.85, true) : v.idleAura()));
    this.previewTargets = [];
    this.previewCell = null;
    if (this.previewText) this.previewText.visible = false;
  }

  /** Hovering a cell with a card: outline the cards it would flip and show "+N". */
  private updatePreview(cell: number | null) {
    if (cell === this.previewCell) return;
    this.clearPreview();
    const uid = this.activeUid();
    if (cell === null || uid === null || !this.shown || this.shown.board[cell]) return;
    const def = this.handViews.get(uid)?.def;
    if (!def) return;
    this.previewCell = cell;
    const caps = capturesFor(this.shown, CARDS, 'player', def.id, cell);
    for (const c of caps) {
      const v = this.boardViews.get(c.cell);
      if (!v) continue;
      v.setHalo(0xffd34e, 1, true);
      this.previewTargets.push(v);
    }
    const t = this.layout.cell(cell);
    this.previewText.text = caps.length > 0 ? `+${caps.length}` : '';
    this.previewText.position.set(t.x, t.y);
    this.previewText.visible = caps.length > 0;
  }
}
