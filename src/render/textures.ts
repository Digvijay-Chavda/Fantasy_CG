import { Texture } from 'pixi.js';
import type { CardDef, PlayerId, Rarity } from '../game/engine';

/** Intrinsic card texture size. Views scale this to whatever the layout needs. */
export const CARD_W = 400;
export const CARD_H = 460;
export const CARD_ASPECT = CARD_H / CARD_W;
/** Cards are painted in a 300x345 design space and scaled up to the texture size. */
const BASE_W = 300;
const BASE_H = 345;
const S = CARD_W / BASE_W;

const FONT = '"Cinzel", "Georgia", serif';
const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

export const OWNER_COLORS: Record<PlayerId, { hi: string; lo: string; glow: number; edge: string }> = {
  player: { hi: '#6fb0ff', lo: '#1d4fc4', glow: 0x4f9bff, edge: '79,155,255' },
  ai: { hi: '#ff7d8b', lo: '#b3182f', glow: 0xff4d62, edge: '255,77,98' },
};

const RARITY: Record<Rarity, { hi: string; lo: string; tint: string; glow: number }> = {
  COMMON: { hi: '#e7dbe6', lo: '#8a7488', tint: '#4a2a44', glow: 0xe7dbe6 },
  RARE: { hi: '#ffc2e0', lo: '#c2457f', tint: '#6b1f4d', glow: 0xff7ab8 },
  EPIC: { hi: '#e6c4ff', lo: '#8b3fd6', tint: '#4a1d78', glow: 0xc084fc },
  LEGENDARY: { hi: '#fff0b0', lo: '#c98a1a', tint: '#7a3b12', glow: 0xffd34e },
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

/** Number badge: compact dark pill with a ring in the owner's colour, sitting on top of the art. */
function badge(g: Ctx, cx: number, cy: number, n: number, owner: PlayerId) {
  g.beginPath();
  g.arc(cx, cy, 23, 0, Math.PI * 2);
  g.fillStyle = 'rgba(10,5,14,.72)';
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = OWNER_COLORS[owner].hi;
  g.stroke();
  g.font = `800 31px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 5;
  g.strokeStyle = 'rgba(0,0,0,.85)';
  g.strokeText(String(n), cx, cy + 2);
  g.fillStyle = n >= 10 ? '#ffe08a' : '#ffffff';
  g.fillText(String(n), cx, cy + 2);
}

/**
 * Art-first card: the illustration fills the whole face, framed by a thin border in the owner's colour
 * (blue = yours, red = enemy's). Only compact number badges and a name plate sit on top of the art.
 */
function paintFace(def: CardDef, owner: PlayerId): HTMLCanvasElement {
  const [c, g] = canvas(CARD_W, CARD_H);
  g.scale(S, S);
  const W = BASE_W;
  const H = BASE_H;
  const own = OWNER_COLORS[owner];
  const rar = RARITY[def.rarity];

  // everything inside the rounded card shape
  g.save();
  rr(g, 2, 2, W - 4, H - 4, 20);
  g.clip();

  // artwork (full bleed). Placeholder: rich dark backdrop + large glyph.
  const bg = g.createRadialGradient(W / 2, H * 0.42, 10, W / 2, H * 0.5, H * 0.75);
  bg.addColorStop(0, rar.tint);
  bg.addColorStop(0.6, '#1a0a1c');
  bg.addColorStop(1, '#07030b');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const img = requestArt(def.id);
  if (img) {
    const k = Math.max(W / img.width, H / img.height);
    g.drawImage(img, (W - img.width * k) / 2, (H - img.height * k) / 2, img.width * k, img.height * k);
  } else {
    g.font = `150px ${EMOJI_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,.65)';
    g.shadowBlur = 20;
    g.fillText(def.glyph ?? '✦', W / 2, H * 0.44);
    g.shadowBlur = 0;
  }

  // soft gloss across the top, then a dark fade at the bottom for the name plate
  const gloss = g.createLinearGradient(0, 0, W, H * 0.6);
  gloss.addColorStop(0, 'rgba(255,255,255,.16)');
  gloss.addColorStop(0.45, 'rgba(255,255,255,0)');
  g.fillStyle = gloss;
  g.fillRect(0, 0, W, H);
  g.fillStyle = vGradient(g, H * 0.66, H, [[0, 'rgba(8,3,12,0)'], [1, 'rgba(8,3,12,.88)']]);
  g.fillRect(0, H * 0.66, W, H * 0.34);
  // owner colour bleeding in from the edges (keeps the middle of the art clean)
  const edge = g.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.72);
  edge.addColorStop(0, `rgba(${own.edge},0)`);
  edge.addColorStop(1, `rgba(${own.edge},.42)`);
  g.fillStyle = edge;
  g.fillRect(0, 0, W, H);

  // name plate
  g.font = `700 19px ${FONT}`;
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.shadowColor = 'rgba(0,0,0,.95)';
  g.shadowBlur = 7;
  g.fillText(def.name.toUpperCase(), W / 2, H - 56, W - 110);
  g.shadowBlur = 0;
  g.fillStyle = vGradient(g, 0, 1, [[0, rar.hi], [1, rar.lo]]);
  g.fillRect(W / 2 - 34, H - 49, 68, 2);
  g.restore();

  // thin frame: owner colour outside, rarity hairline inside
  rr(g, 2.5, 2.5, W - 5, H - 5, 20);
  g.lineWidth = 5;
  g.strokeStyle = vGradient(g, 0, H, [[0, own.hi], [1, own.lo]]);
  g.stroke();
  rr(g, 8, 8, W - 16, H - 16, 15);
  g.lineWidth = 1.5;
  g.strokeStyle = vGradient(g, 0, H, [[0, rar.hi], [0.5, rar.lo], [1, rar.hi]]);
  g.globalAlpha = 0.75;
  g.stroke();
  g.globalAlpha = 1;

  // numbers
  const { top, right, bottom, left } = def.ranks;
  badge(g, W / 2, 30, top, owner);
  badge(g, W / 2, H - 28, bottom, owner);
  badge(g, 28, H / 2, left, owner);
  badge(g, W - 28, H / 2, right, owner);
  return c;
}

function paintBack(): HTMLCanvasElement {
  const [c, g] = canvas(CARD_W, CARD_H);
  g.scale(S, S);
  const W = BASE_W;
  const H = BASE_H;
  g.save();
  rr(g, 2, 2, W - 4, H - 4, 20);
  g.clip();
  g.fillStyle = vGradient(g, 0, H, [[0, '#4a1636'], [1, '#14060f']]);
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,215,140,.2)';
  g.lineWidth = 1.5;
  for (let i = -H; i < W + H; i += 20) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + H, H); g.stroke();
    g.beginPath(); g.moveTo(i + H, 0); g.lineTo(i, H); g.stroke();
  }
  g.restore();
  rr(g, 2.5, 2.5, W - 5, H - 5, 20);
  g.lineWidth = 5;
  g.strokeStyle = vGradient(g, 0, H, [[0, '#ffe08a'], [0.5, '#a8741a'], [1, '#ffe08a']]);
  g.stroke();
  rr(g, 12, 12, W - 24, H - 24, 14);
  g.lineWidth = 1.5;
  g.strokeStyle = 'rgba(255,224,138,.5)';
  g.stroke();
  g.beginPath();
  g.arc(W / 2, H / 2, 58, 0, Math.PI * 2);
  g.fillStyle = 'rgba(14,5,12,.85)';
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = '#ffe08a';
  g.stroke();
  g.font = `60px ${EMOJI_FONT}`;
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
  bg.addColorStop(0, '#34142e');
  bg.addColorStop(0.55, '#170a1f');
  bg.addColorStop(1, '#06030a');
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
  g.fillStyle = vGradient(g, 0, p.height, [[0, '#2c1530'], [1, '#150a1c']]);
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
