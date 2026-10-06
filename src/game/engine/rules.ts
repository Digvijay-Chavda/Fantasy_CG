import { BOARD_SIZE } from './constants';
import { opponentOf } from './opponent';
import { randomInt } from './rng';
import type {
  Action,
  Capture,
  CardDef,
  CardInstance,
  CardRegistry,
  GameConfig,
  GameEvent,
  GameState,
  PlayerId,
  Side,
  StepResult,
} from './types';

export const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];
const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

/** Neighbouring cell on `side` of `cell`, or null at the board edge. */
export function neighbour(size: number, cell: number, side: Side): number | null {
  const row = Math.floor(cell / size);
  const col = cell % size;
  switch (side) {
    case 'top':
      return row > 0 ? cell - size : null;
    case 'bottom':
      return row < size - 1 ? cell + size : null;
    case 'left':
      return col > 0 ? cell - 1 : null;
    case 'right':
      return col < size - 1 ? cell + 1 : null;
  }
}

const def = (cards: CardRegistry, id: string): CardDef => {
  const d = cards[id];
  if (!d) throw new Error(`Unknown card: ${id}`);
  return d;
};

const total = (c: CardDef) => c.ranks.top + c.ranks.right + c.ranks.bottom + c.ranks.left;

// ---------------------------------------------------------------- setup

function shuffle<T>(items: T[], rngState: number): [T[], number] {
  const out = [...items];
  let s = rngState;
  for (let i = out.length - 1; i > 0; i--) {
    let j: number;
    [j, s] = randomInt(s, i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return [out, s];
}

/** Hand sizes: the first mover gets the extra card when the board has an odd number of cells. */
export function handSizes(size: number, first: PlayerId): Record<PlayerId, number> {
  const cells = size * size;
  const big = Math.ceil(cells / 2);
  return { [first]: big, [opponentOf(first)]: cells - big } as Record<PlayerId, number>;
}

/** Swaps cards between the hands while that narrows the gap in total strength (deterministic). */
function balanceHands(hands: Record<PlayerId, CardInstance[]>, cards: CardRegistry) {
  const sum = (h: CardInstance[]) => h.reduce((t, c) => t + total(def(cards, c.cardId)), 0);
  for (let pass = 0; pass < 50; pass++) {
    const gap = sum(hands.player) - sum(hands.ai);
    let best: { i: number; j: number; gap: number } | null = null;
    hands.player.forEach((p, i) =>
      hands.ai.forEach((a, j) => {
        const delta = total(def(cards, p.cardId)) - total(def(cards, a.cardId));
        const next = Math.abs(gap - 2 * delta);
        if (next < Math.abs(gap) && (!best || next < best.gap)) best = { i, j, gap: next };
      }),
    );
    if (!best) return;
    const { i, j } = best as { i: number; j: number };
    [hands.player[i], hands.ai[j]] = [hands.ai[j]!, hands.player[i]!];
  }
}

/**
 * Deals two hands from the pool. A random sample is sorted by total strength and dealt in a snake
 * order (A B B A A B B A ...), then swapped until the totals are as close as possible.
 */
export function createGame(config: GameConfig): StepResult {
  const size = config.size ?? BOARD_SIZE;
  let rng = config.seed >>> 0;
  let firstRoll: number;
  [firstRoll, rng] = randomInt(rng, 2);
  const first: PlayerId = config.firstPlayer ?? (firstRoll === 0 ? 'player' : 'ai');
  const need = size * size;
  if (config.pool.length < need) throw new Error(`Card pool needs at least ${need} cards`);

  let uid = 1;
  let shuffled: string[];
  [shuffled, rng] = shuffle(config.pool, rng);
  const picked = shuffled
    .slice(0, need)
    .map((cardId) => ({ uid: uid++, cardId }))
    .sort((a, b) => total(def(config.cards, b.cardId)) - total(def(config.cards, a.cardId)) || a.uid - b.uid);

  let flip: number;
  [flip, rng] = randomInt(rng, 2);
  const a: PlayerId = flip === 0 ? 'player' : 'ai';
  const sizes = handSizes(size, first);
  const hands: Record<PlayerId, CardInstance[]> = { player: [], ai: [] };
  picked.forEach((card, i) => {
    let owner = i % 4 === 0 || i % 4 === 3 ? a : opponentOf(a);
    if (hands[owner].length >= sizes[owner]) owner = opponentOf(owner);
    hands[owner].push(card);
  });
  balanceHands(hands, config.cards);
  for (const p of ['player', 'ai'] as PlayerId[]) {
    [hands[p], rng] = shuffle(hands[p], rng);
  }

  const state: GameState = {
    size,
    board: Array(need).fill(null),
    hands,
    active: first,
    moves: 0,
    rngState: rng,
    winner: null,
  };
  return { state, events: [] };
}

// ---------------------------------------------------------------- rules

export function emptyCells(state: GameState): number[] {
  const out: number[] = [];
  state.board.forEach((c, i) => {
    if (!c) out.push(i);
  });
  return out;
}

export function legalActions(state: GameState, pid: PlayerId): Action[] {
  if (state.winner || state.active !== pid) return [];
  const cells = emptyCells(state);
  return state.hands[pid].flatMap((c) => cells.map((cell): Action => ({ type: 'PLACE', uid: c.uid, cell })));
}

export function score(state: GameState): Record<PlayerId, number> {
  const s: Record<PlayerId, number> = { player: 0, ai: 0 };
  for (const c of state.board) if (c) s[c.owner]++;
  return s;
}

/** Tiebreak: total of all printed numbers on the cards each player owns on the board. */
export function strength(state: GameState, cards: CardRegistry): Record<PlayerId, number> {
  const s: Record<PlayerId, number> = { player: 0, ai: 0 };
  for (const c of state.board) if (c) s[c.owner] += total(def(cards, c.cardId));
  return s;
}

/** Most cards wins; equal counts fall back to total strength; equal again is a draw. */
export function decideWinner(state: GameState, cards: CardRegistry): { winner: PlayerId | 'draw'; tiebreak?: Record<PlayerId, number> } {
  const s = score(state);
  if (s.player !== s.ai) return { winner: s.player > s.ai ? 'player' : 'ai' };
  const t = strength(state, cards);
  if (t.player === t.ai) return { winner: 'draw', tiebreak: t };
  return { winner: t.player > t.ai ? 'player' : 'ai', tiebreak: t };
}

/**
 * Captures that placing `cardId` for `pid` in `cell` would make. A neighbouring enemy card flips
 * when the touching number on the placed card is strictly higher than the one on the enemy card.
 * Only direct neighbours flip; captures never chain.
 */
export function capturesFor(state: GameState, cards: CardRegistry, pid: PlayerId, cardId: string, cell: number): Capture[] {
  const mine = def(cards, cardId);
  const out: Capture[] = [];
  for (const side of SIDES) {
    const n = neighbour(state.size, cell, side);
    if (n === null) continue;
    const other = state.board[n];
    if (!other || other.owner === pid) continue;
    const attack = mine.ranks[side];
    const defense = def(cards, other.cardId).ranks[OPPOSITE[side]];
    if (attack > defense) out.push({ cell: n, cardId: other.cardId, side, attack, defense });
  }
  return out;
}

export function applyAction(state: GameState, action: Action, cards: CardRegistry): StepResult {
  if (state.winner) throw new Error('Game is over');
  const next = structuredClone(state);
  const pid = next.active;
  const events: GameEvent[] = [];

  const idx = next.hands[pid].findIndex((c) => c.uid === action.uid);
  const inst = next.hands[pid][idx];
  if (!inst) throw new Error('Card is not in your hand');
  if (action.cell < 0 || action.cell >= next.board.length) throw new Error('No such cell');
  if (next.board[action.cell]) throw new Error('That cell is already taken');

  const caps = capturesFor(next, cards, pid, inst.cardId, action.cell);
  next.hands[pid].splice(idx, 1);
  next.board[action.cell] = { ...inst, owner: pid };
  events.push({ type: 'PLACED', player: pid, cardId: inst.cardId, cell: action.cell });
  for (const c of caps) {
    next.board[c.cell]!.owner = pid;
    events.push({ type: 'CAPTURED', by: pid, byCardId: inst.cardId, ...c });
  }

  next.moves += 1;
  if (emptyCells(next).length === 0) {
    const { winner, tiebreak } = decideWinner(next, cards);
    next.winner = winner;
    events.push({ type: 'GAME_OVER', winner, score: score(next), tiebreak });
  } else {
    next.active = opponentOf(pid);
  }
  return { state: next, events };
}

/** Hide what the viewer may not know: the opponent's hand. */
export function getVisibleState(state: GameState, viewer: PlayerId): GameState {
  const view = structuredClone(state);
  const opp = opponentOf(viewer);
  view.hands[opp] = view.hands[opp].map((c) => ({ uid: c.uid, cardId: 'HIDDEN' }));
  view.rngState = 0;
  return view;
}
