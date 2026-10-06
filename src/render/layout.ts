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
const TOP_INSET = 70;

export function computeLayout(w: number, h: number, size: number): Layout {
  const margin = Math.max(10, w * 0.02);
  const enemyZone = Math.max(44, Math.min(66, h * 0.085));
  const handZone = Math.max(96, Math.min(215, h * 0.25));
  const availW = w - margin * 2;
  const availH = h - TOP_INSET - enemyZone - handZone - margin * 1.5;

  const gapRatio = 0.06;
  const padRatio = 0.1;
  // board width = size*cellW + (size-1)*gap + 2*pad
  const byW = availW / (size + (size - 1) * gapRatio + 2 * padRatio);
  const byH = availH / ((size + (size - 1) * gapRatio + 2 * padRatio) * CARD_ASPECT);
  const cellW = Math.max(40, Math.floor(Math.min(byW, byH)));
  const cellH = Math.round(cellW * CARD_ASPECT);
  const gap = Math.round(cellW * gapRatio);
  const pad = Math.round(cellW * padRatio);
  const boardW = size * cellW + (size - 1) * gap + pad * 2;
  const boardH = size * cellH + (size - 1) * gap + pad * 2;
  const boardX = Math.round((w - boardW) / 2);
  const boardY = Math.round(TOP_INSET + enemyZone + (availH - boardH) / 2 + margin * 0.25);
  const cardScale = (cellW * 0.97) / CARD_W;

  // trays
  const trayW = Math.min(w - margin * 2, Math.max(boardW * 1.3, 680));
  const playerTray = { x: (w - trayW) / 2, y: h - handZone + 4, w: trayW, h: handZone - 12 };
  const enemyTray = { x: (w - trayW) / 2, y: TOP_INSET + 2, w: trayW, h: enemyZone - 4 };

  // hand cards
  const handCardW = Math.min(cellW * 1.05, (playerTray.h * 0.86) / CARD_ASPECT);
  const handScale = handCardW / CARD_W;
  const enemyCardW = Math.min(enemyTray.h * 0.8 / CARD_ASPECT, cellW * 0.5);
  const enemyScale = enemyCardW / CARD_W;

  const fan = (i: number, n: number, tray: typeof playerTray, cardW: number, scale: number, dir: 1 | -1): Home => {
    const mid = (n - 1) / 2;
    const maxSpan = tray.w - cardW - 24;
    const step = n > 1 ? Math.min(cardW * 1.02, maxSpan / (n - 1)) : 0;
    const off = i - mid;
    const arc = Math.pow(Math.abs(off), 2) * (cardW * 0.012);
    return {
      x: tray.x + tray.w / 2 + off * step,
      y: dir === 1 ? tray.y + tray.h / 2 + arc : tray.y + tray.h / 2 - arc,
      rotation: off * 0.045 * dir,
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
