import { CARD_ASPECT, CARD_W } from './textures';
import type { Home } from './CardView';

export interface Layout {
  w: number;
  h: number;
  size: number;
  cellW: number;
  cellH: number;
  gap: number;
  pad: number;
  boardX: number;
  boardY: number;
  boardW: number;
  boardH: number;
  /** Scale that makes a card fill a board cell. */
  cardScale: number;
  /** Invisible areas the hands are fanned inside (no panel is drawn). */
  playerTray: { x: number; y: number; w: number; h: number };
  enemyTray: { x: number; y: number; w: number; h: number };
  cell(i: number): { x: number; y: number };
  hand(i: number, n: number): Home;
  enemy(i: number, n: number): Home;
  /** Off-screen spawn points for the deal animation. */
  spawnPlayer: { x: number; y: number };
  spawnEnemy: { x: number; y: number };
}

/** Space reserved for the React HUD along the top of the canvas. */
const TOP_INSET = 64;
/**
 * Fraction of a card's width each neighbour advances. Near 1 keeps all four numbers readable; narrow
 * (phone) screens accept heavy overlap because there is no room, and tapping lifts a card anyway.
 */
const minStep = (w: number) => (w < 640 ? 0.5 : 0.95);

export function computeLayout(w: number, h: number, size: number): Layout {
  const margin = Math.max(10, w * 0.02);
  const handCount = Math.ceil((size * size) / 2);
  const availW = w - margin * 2;

  // The player's cards are the star: as wide as the screen and a sensible share of its height allow.
  const maxHandH = Math.min(h * 0.25, 280);
  const handCardW = Math.min(maxHandH / CARD_ASPECT, availW / (1 + minStep(w) * (handCount - 1)));
  const handCardH = handCardW * CARD_ASPECT;
  // the fan dips towards the edges (arc + tilt), so reserve that space or the outer cards get clipped
  const arcMax = Math.pow((handCount - 1) / 2, 2) * (handCardW * 0.006);
  const handZone = Math.round(handCardH * 1.08 + arcMax * 2 + 12);

  const enemyZone = Math.max(40, Math.min(58, h * 0.07));
  const availH = h - TOP_INSET - enemyZone - handZone - margin;

  const gapRatio = 0.045;
  const padRatio = 0.07;
  // board width = size*cellW + (size-1)*gap + 2*pad
  const units = size + (size - 1) * gapRatio + 2 * padRatio;
  const cellW = Math.max(40, Math.floor(Math.min(availW / units, availH / (units * CARD_ASPECT))));
  const cellH = Math.round(cellW * CARD_ASPECT);
  const gap = Math.round(cellW * gapRatio);
  const pad = Math.round(cellW * padRatio);
  const boardW = size * cellW + (size - 1) * gap + pad * 2;
  const boardH = size * cellH + (size - 1) * gap + pad * 2;
  const boardX = Math.round((w - boardW) / 2);
  const boardY = Math.round(TOP_INSET + enemyZone + Math.max(0, (availH - boardH) / 2));
  const cardScale = (cellW * 0.97) / CARD_W;

  const playerTray = { x: margin, y: h - handZone, w: availW, h: handZone };
  const enemyW = Math.min(availW * 0.7, 480);
  const enemyTray = { x: (w - enemyW) / 2, y: TOP_INSET, w: enemyW, h: enemyZone };

  const handScale = handCardW / CARD_W;
  const enemyCardW = Math.min((enemyZone * 0.92) / CARD_ASPECT, cellW * 0.55);
  const enemyScale = enemyCardW / CARD_W;

  const fan = (i: number, n: number, tray: typeof playerTray, cardW: number, scale: number, dir: 1 | -1): Home => {
    const mid = (n - 1) / 2;
    const maxSpan = tray.w - cardW;
    const step = n > 1 ? Math.min(cardW * 1.0, maxSpan / (n - 1)) : 0;
    const off = i - mid;
    const arc = Math.pow(Math.abs(off), 2) * (cardW * 0.006);
    return {
      x: tray.x + tray.w / 2 + off * step,
      y: dir === 1 ? tray.y + tray.h / 2 + arc : tray.y + tray.h / 2 - arc,
      rotation: off * 0.03 * dir,
      scale,
    };
  };

  return {
    w, h, size, cellW, cellH, gap, pad, boardX, boardY, boardW, boardH, cardScale, playerTray, enemyTray,
    cell: (i) => ({
      x: boardX + pad + (i % size) * (cellW + gap) + cellW / 2,
      y: boardY + pad + Math.floor(i / size) * (cellH + gap) + cellH / 2,
    }),
    hand: (i, n) => fan(i, n, playerTray, handCardW, handScale, 1),
    enemy: (i, n) => fan(i, n, enemyTray, enemyCardW, enemyScale, -1),
    spawnPlayer: { x: w + 80, y: h + 40 },
    spawnEnemy: { x: -80, y: -60 },
  };
}
