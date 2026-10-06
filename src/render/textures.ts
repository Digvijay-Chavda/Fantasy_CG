import { Texture } from 'pixi.js';
import type { CardDef, PlayerId, Rarity } from '../game/engine';

/** Intrinsic card texture size. Views scale this to whatever the layout needs. */
export const CARD_W = 300;
export const CARD_H = 345;
export const CARD_ASPECT = CARD_H / CARD_W;

const FONT = '"Cinzel", "Georgia", serif';
const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

export const OWNER_COLORS: Record<PlayerId, { hi: string; lo: string; glow: number }> = {
  player: { hi: '#5aa2ff', lo: '#16327a', glow: 0x4f9bff },
  ai: { hi: '#ff6b7a', lo: '#6e1222', glow: 0xff4d62 },
};

const RARITY: Record<Rarity, { hi: string; lo: string; tint: string; glow: number }> = {
  COMMON: { hi: '#e2e8f0', lo: '#64748b', tint: '#3b4658', glow: 0xcbd5e1 },
  RARE: { hi: '#a5e8ff', lo: '#0b78b8', tint: '#14506e', glow: 0x5fd1ff },
  EPIC: { hi: '#f0c4ff', lo: '#7e22ce', tint: '#4a1d70', glow: 0xc084fc },
  LEGENDARY: { hi: '#fff0a8', lo: '#b45309', tint: '#7a4a10', glow: 0xffd34e },
};
export const rarityGlow = (r: Rarity) => RARITY[r].glow;

type Ctx = CanvasRenderingContext2D;

function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function rr(g: Ctx, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function vGradient(g: Ctx, y0: number, y1: number, stops: [number, string][]) {
  const grad = g.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) grad.addColorStop(o, c);
  return grad;
}

// ---------------------------------------------------------------- optional real artwork

const artImages = new Map<string, HTMLImageElement | null>();
const artListeners = new Set<(cardId: string) => void>();
const faceCache = new Map<string, Texture>();

/** Called when a card's image file finishes loading so views can refresh. */
export function onArtLoaded(cb: (cardId: string) => void) {
  artListeners.add(cb);
  return () => artListeners.delete(cb);
}

/**
 * Real card artwork is optional: drop `public/cards/<cardId>.png` and it is picked up automatically;
 * until then (or if the file is missing) the placeholder glyph is shown.
 */
function requestArt(cardId: string): HTMLImageElement | null {
  if (artImages.has(cardId)) return artImages.get(cardId) ?? null;
  artImages.set(cardId, null);
  const img = new Image();
  img.onload = () => {
    artImages.set(cardId, img);
    // Drop the cached placeholder faces so the next lookup paints the artwork. The old textures are
    // deliberately not destroyed: cards that are mid-flight may still be drawing them.
    for (const key of [...faceCache.keys()]) if (key.startsWith(`${cardId}:`)) faceCache.delete(key);
    artListeners.forEach((cb) => cb(cardId));
  };
  img.onerror = () => artImages.set(cardId, null);
  img.src = `${import.meta.env.BASE_URL}cards/${cardId}.png`;
  return null;
}

// ---------------------------------------------------------------- card faces

function badge(g: Ctx, cx: number, cy: number, n: number, rarity: Rarity) {
  g.beginPath();
  g.arc(cx, cy, 26, 0, Math.PI * 2);
  g.fillStyle = 'rgba(8,6,20,.7)';
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = RARITY[rarity].hi;
  g.stroke();
  g.font = `800 36px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(0,0,0,.85)';
  g.strokeText(String(n), cx, cy + 2);
  g.fillStyle = n >= 10 ? '#ffe08a' : '#ffffff';
  g.fillText(String(n), cx, cy + 2);
}

function paintFace(def: CardDef, owner: PlayerId): HTMLCanvasElement {
  const [c, g] = canvas(CARD_W, CARD_H);
  const W = CARD_W;
  const H = CARD_H;
  const own = OWNER_COLORS[owner];
  const rar = RARITY[def.rarity];

  // body
  rr(g, 6, 6, W - 12, H - 12, 26);
  g.fillStyle = vGradient(g, 0, H, [[0, own.hi], [1, own.lo]]);
  g.fill();
  g.save();
  g.clip();
  g.globalAlpha = 0.08;
  g.strokeStyle = '#fff';
  g.lineWidth = 2;
  for (let i = -H; i < W; i += 14) {
    g.beginPath();
    g.moveTo(i, H);
    g.lineTo(i + H, 0);
    g.stroke();
  }
  g.restore();

  // art window
  const wx = 64;
  const wy = 66;
  const ww = W - wx * 2;
  const wh = H - wy * 2;
  g.save();
  rr(g, wx, wy, ww, wh, 16);
  g.clip();
  const bg = g.createRadialGradient(W / 2, H / 2 - 20, 10, W / 2, H / 2, wh * 0.7);
  bg.addColorStop(0, rar.tint);
  bg.addColorStop(1, '#0b0714');
  g.fillStyle = bg;
  g.fillRect(wx, wy, ww, wh);
  const img = requestArt(def.id);
  if (img) {
    const s = Math.max(ww / img.width, wh / img.height);
    g.drawImage(img, wx + (ww - img.width * s) / 2, wy + (wh - img.height * s) / 2, img.width * s, img.height * s);
  } else {
    g.font = `110px ${EMOJI_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,.6)';
    g.shadowBlur = 14;
    g.fillText(def.glyph ?? '✦', W / 2, H / 2 - 4);
    g.shadowBlur = 0;
  }
  const fade = vGradient(g, wy + wh * 0.55, wy + wh, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.7)']]);
  g.fillStyle = fade;
  g.fillRect(wx, wy, ww, wh);
  g.font = `700 21px ${FONT}`;
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.shadowColor = 'rgba(0,0,0,.9)';
  g.shadowBlur = 6;
  g.fillText(def.name.toUpperCase(), W / 2, wy + wh - 14, ww - 12);
  g.shadowBlur = 0;
  g.restore();
  rr(g, wx, wy, ww, wh, 16);
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(0,0,0,.55)';
  g.stroke();

  // border by rarity
  rr(g, 6, 6, W - 12, H - 12, 26);
  g.lineWidth = 9;
  g.strokeStyle = vGradient(g, 0, H, [[0, rar.hi], [0.5, rar.lo], [1, rar.hi]]);
  g.stroke();
  rr(g, 16, 16, W - 32, H - 32, 20);
  g.lineWidth = 2;
  g.strokeStyle = 'rgba(255,255,255,.28)';
  g.stroke();

  // numbers
  const { top, right, bottom, left } = def.ranks;
  badge(g, W / 2, 36, top, def.rarity);
  badge(g, W / 2, H - 36, bottom, def.rarity);
  badge(g, 36, H / 2, left, def.rarity);
  badge(g, W - 36, H / 2, right, def.rarity);
  return c;
}

function paintBack(): HTMLCanvasElement {
  const [c, g] = canvas(CARD_W, CARD_H);
  const W = CARD_W;
  const H = CARD_H;
  rr(g, 6, 6, W - 12, H - 12, 26);
  g.fillStyle = vGradient(g, 0, H, [[0, '#4a3480'], [1, '#1d1238']]);
  g.fill();
  g.save();
  g.clip();
  g.strokeStyle = 'rgba(255,215,120,.22)';
  g.lineWidth = 2;
  for (let i = -H; i < W + H; i += 22) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + H, H); g.stroke();
    g.beginPath(); g.moveTo(i + H, 0); g.lineTo(i, H); g.stroke();
  }
  g.restore();
  rr(g, 6, 6, W - 12, H - 12, 26);
  g.lineWidth = 9;
  g.strokeStyle = vGradient(g, 0, H, [[0, '#ffe08a'], [0.5, '#a8741a'], [1, '#ffe08a']]);
  g.stroke();
  g.beginPath();
  g.arc(W / 2, H / 2, 62, 0, Math.PI * 2);
  g.fillStyle = 'rgba(12,8,28,.85)';
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = '#ffe08a';
  g.stroke();
  g.font = `64px ${EMOJI_FONT}`;
  g.fillStyle = '#ffe08a';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('✦', W / 2, H / 2 + 4);
  return c;
}

export function faceTexture(def: CardDef, owner: PlayerId): Texture {
  const key = `${def.id}:${owner}`;
  let t = faceCache.get(key);
  if (!t) {
    t = Texture.from(paintFace(def, owner));
    faceCache.set(key, t);
  }
  return t;
}

let backTex: Texture | null = null;
export function backTexture(): Texture {
  return (backTex ??= Texture.from(paintBack()));
}

// ---------------------------------------------------------------- effect textures

let glow: Texture | null = null;
/** Soft white radial blob, tinted at use. */
export function glowTexture(): Texture {
  if (!glow) {
    const [c, g] = canvas(128, 128);
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    glow = Texture.from(c);
  }
  return glow;
}

let haloTex: Texture | null = null;
/** Rounded-rectangle halo used behind cards (tinted + additive). */
export function haloTexture(): Texture {
  if (!haloTex) {
    const pad = 60;
    const [c, g] = canvas(CARD_W + pad * 2, CARD_H + pad * 2);
    g.shadowColor = '#fff';
    g.shadowBlur = 46;
    rr(g, pad + 8, pad + 8, CARD_W - 16, CARD_H - 16, 26);
    g.fillStyle = '#fff';
    g.fill();
    haloTex = Texture.from(c);
  }
  return haloTex;
}

let shadowTex: Texture | null = null;
export function shadowTexture(): Texture {
  if (!shadowTex) {
    const pad = 40;
    const [c, g] = canvas(CARD_W + pad * 2, CARD_H + pad * 2);
    g.shadowColor = 'rgba(0,0,0,.75)';
    g.shadowBlur = 26;
    rr(g, pad + 14, pad + 14, CARD_W - 28, CARD_H - 28, 24);
    g.fillStyle = '#000';
    g.fill();
    shadowTex = Texture.from(c);
  }
  return shadowTex;
}

let ringTex: Texture | null = null;
export function ringTexture(): Texture {
  if (!ringTex) {
    const [c, g] = canvas(256, 256);
    g.shadowColor = '#fff';
    g.shadowBlur = 14;
    g.lineWidth = 10;
    g.strokeStyle = '#fff';
    g.beginPath();
    g.arc(128, 128, 100, 0, Math.PI * 2);
    g.stroke();
    ringTex = Texture.from(c);
  }
  return ringTex;
}

let vignetteTex: Texture | null = null;
export function vignetteTexture(): Texture {
  if (!vignetteTex) {
    const [c, g] = canvas(512, 512);
    const grad = g.createRadialGradient(256, 256, 140, 256, 256, 380);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(4,2,12,.8)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 512);
    vignetteTex = Texture.from(c);
  }
  return vignetteTex;
}

// ---------------------------------------------------------------- table + board (repainted on resize)

export function paintTable(w: number, h: number): HTMLCanvasElement {
  const [c, g] = canvas(Math.max(2, Math.floor(w)), Math.max(2, Math.floor(h)));
  const bg = g.createRadialGradient(w / 2, h * 0.45, 20, w / 2, h * 0.45, Math.max(w, h) * 0.75);
  bg.addColorStop(0, '#2c1b4d');
  bg.addColorStop(0.55, '#150c29');
  bg.addColorStop(1, '#07040f');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  // faint rune circles
  g.strokeStyle = 'rgba(190,150,255,.07)';
  g.lineWidth = 2;
  for (const r of [0.28, 0.4, 0.55]) {
    g.beginPath();
    g.arc(w / 2, h * 0.47, Math.min(w, h) * r, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,.5)';
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) {
    g.globalAlpha = 0.1 + rnd() * 0.35;
    g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5);
  }
  return c;
}

export interface BoardPaint {
  width: number;
  height: number;
  size: number;
  cellW: number;
  cellH: number;
  gap: number;
  pad: number;
}

export function paintBoard(p: BoardPaint): HTMLCanvasElement {
  const [c, g] = canvas(Math.ceil(p.width), Math.ceil(p.height));
  rr(g, 2, 2, p.width - 4, p.height - 4, 22);
  g.fillStyle = vGradient(g, 0, p.height, [[0, '#2a1d47'], [1, '#150e29']]);
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = vGradient(g, 0, p.height, [[0, '#ffe08a'], [0.5, '#9a6b1c'], [1, '#ffe08a']]);
  g.stroke();
  rr(g, 10, 10, p.width - 20, p.height - 20, 16);
  g.lineWidth = 1.5;
  g.strokeStyle = 'rgba(255,224,138,.35)';
  g.stroke();
  for (let row = 0; row < p.size; row++) {
    for (let col = 0; col < p.size; col++) {
      const x = p.pad + col * (p.cellW + p.gap);
      const y = p.pad + row * (p.cellH + p.gap);
      rr(g, x, y, p.cellW, p.cellH, 12);
      g.fillStyle = 'rgba(8,5,18,.7)';
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = 'rgba(180,150,240,.28)';
      g.stroke();
      // rune diamond
      const cx = x + p.cellW / 2;
      const cy = y + p.cellH / 2;
      const r = Math.min(p.cellW, p.cellH) * 0.16;
      g.beginPath();
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r, cy);
      g.lineTo(cx, cy + r);
      g.lineTo(cx - r, cy);
      g.closePath();
      g.strokeStyle = 'rgba(190,150,255,.2)';
      g.stroke();
    }
  }
  return c;
}

export function paintTray(w: number, h: number): HTMLCanvasElement {
  const [c, g] = canvas(Math.ceil(w), Math.ceil(h));
  rr(g, 1.5, 1.5, w - 3, h - 3, 18);
  g.fillStyle = 'rgba(14,9,30,.55)';
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = 'rgba(190,150,255,.18)';
  g.stroke();
  return c;
}

/** Make sure the display font is ready before any canvas text is painted. */
export async function loadFonts() {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('800 36px "Cinzel"'), document.fonts.load('700 21px "Cinzel"')]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch {
    // fall back to the serif stack
  }
}
