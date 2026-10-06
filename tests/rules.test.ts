import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CARD_POOL, CARDS, buildRegistry } from '../src/data/cards';
import { GameEngine, MAX_RANK, applyAction, capturesFor, decideWinner, handSizes, neighbour, score, strength } from '../src/game/engine';
import type { CardDef, GameState, PlayerId, Ranks } from '../src/game/engine';

/** Tiny registry for rule tests: each card is defined by its ranks. */
const reg = (defs: Record<string, [number, number, number, number]>) =>
  buildRegistry(
    Object.entries(defs).map(([id, [top, right, bottom, left]]): CardDef => ({
      id, name: id, rarity: 'COMMON', ranks: { top, right, bottom, left },
    })),
  );

/** Empty size x size game where `player` is to move holding `hand`; `board` maps cell -> [cardId, owner]. */
function setup(size: number, hand: string[], board: Record<number, [string, PlayerId]> = {}): GameState {
  const state: GameState = {
    size,
    board: Array(size * size).fill(null),
    hands: { player: hand.map((cardId, i) => ({ uid: 100 + i, cardId })), ai: [{ uid: 900, cardId: hand[0]! }] },
    active: 'player',
    moves: 0,
    rngState: 1,
    winner: null,
  };
  for (const [cell, [cardId, owner]] of Object.entries(board)) state.board[Number(cell)] = { uid: 500 + Number(cell), cardId, owner };
  return state;
}

describe('geometry', () => {
  it('finds neighbours and stops at the edges', () => {
    expect(neighbour(4, 5, 'top')).toBe(1);
    expect(neighbour(4, 5, 'bottom')).toBe(9);
    expect(neighbour(4, 5, 'left')).toBe(4);
    expect(neighbour(4, 5, 'right')).toBe(6);
    expect(neighbour(4, 0, 'top')).toBeNull();
    expect(neighbour(4, 0, 'left')).toBeNull();
    expect(neighbour(4, 3, 'right')).toBeNull(); // does not wrap to the next row
    expect(neighbour(4, 15, 'bottom')).toBeNull();
  });
});

describe('capturing', () => {
  const cards = reg({ mine: [1, 12, 1, 1], low: [1, 1, 1, 11], tie: [1, 1, 1, 12], high: [1, 1, 1, 13 - 1], big: [9, 9, 9, 9], small: [1, 1, 1, 1] });

  it('flips an enemy card when my touching number is strictly higher (12 vs 11)', () => {
    const s = setup(3, ['mine'], { 1: ['low', 'ai'] }); // enemy at cell 1, my card goes to cell 0, right side touches
    const caps = capturesFor(s, cards, 'player', 'mine', 0);
    expect(caps).toEqual([{ cell: 1, cardId: 'low', side: 'right', attack: 12, defense: 11 }]);
    const after = applyAction(s, { type: 'PLACE', uid: 100, cell: 0 }, cards).state;
    expect(after.board[1]!.owner).toBe('player');
    expect(after.board[0]!.owner).toBe('player');
  });

  it('does not flip on equal numbers', () => {
    const s = setup(3, ['mine'], { 1: ['tie', 'ai'] });
    expect(capturesFor(s, cards, 'player', 'mine', 0)).toEqual([]);
  });

  it('does not flip when the enemy number is higher, and the placed card keeps its colour', () => {
    const s = setup(3, ['small'], { 1: ['high', 'ai'] });
    const after = applyAction(s, { type: 'PLACE', uid: 100, cell: 0 }, cards).state;
    expect(after.board[1]!.owner).toBe('ai');
    expect(after.board[0]!.owner).toBe('player');
  });

  it('only compares the touching sides, and never flips my own cards', () => {
    const s = setup(3, ['big'], { 1: ['small', 'player'], 3: ['small', 'ai'] });
    const after = applyAction(s, { type: 'PLACE', uid: 100, cell: 0 }, cards).state;
    expect(after.board[1]!.owner).toBe('player'); // already mine
    expect(after.board[3]!.owner).toBe('player'); // flipped via the bottom side
  });

  it('captures several neighbours at once', () => {
    const s = setup(3, ['big'], { 1: ['small', 'ai'], 3: ['small', 'ai'], 5: ['small', 'ai'], 7: ['small', 'ai'] });
    const after = applyAction(s, { type: 'PLACE', uid: 100, cell: 4 }, cards);
    expect(after.events.filter((e) => e.type === 'CAPTURED')).toHaveLength(4);
    expect(score(after.state).player).toBe(5);
  });

  it('does not chain: a flipped card does not capture its own neighbours', () => {
    // I place `big` at 0 and flip the weak card at 1. The flipped card has a huge right number but
    // must not attack the enemy card at 2.
    const chain = reg({ big: [9, 9, 9, 9], weakLeft: [1, 12, 1, 1], victim: [1, 1, 1, 1] });
    const s = setup(3, ['big'], { 1: ['weakLeft', 'ai'], 2: ['victim', 'ai'] });
    const after = applyAction(s, { type: 'PLACE', uid: 100, cell: 0 }, chain).state;
    expect(after.board[1]!.owner).toBe('player');
    expect(after.board[2]!.owner).toBe('ai');
  });
});

describe('turns and ending', () => {
  const cards = reg({ a: [5, 5, 5, 5], b: [5, 5, 5, 5] });

  it('rejects illegal moves', () => {
    const e = new GameEngine({ cards, pool: ['a', 'b', 'a', 'b'], seed: 3, size: 2, firstPlayer: 'player' });
    const hand = e.getState().hands.player;
    e.place('player', hand[0]!.uid, 0);
    expect(() => e.place('player', hand[1]!.uid, 1)).toThrow(/not the player/); // not their turn
    const aiHand = e.getState().hands.ai;
    expect(() => e.place('ai', aiHand[0]!.uid, 0)).toThrow(/taken/);
    expect(() => e.place('ai', 9999, 1)).toThrow(/hand/);
    expect(() => e.place('ai', aiHand[0]!.uid, 99)).toThrow(/cell/);
  });

  it('ends when the board is full and the player with most cards wins', () => {
    const win = reg({ strong: [9, 9, 9, 9], weak: [1, 1, 1, 1] });
    const e = new GameEngine({ cards: win, pool: ['strong', 'weak', 'strong', 'weak'], seed: 5, size: 2, firstPlayer: 'player' });
    while (!e.getState().winner) {
      const who = e.getState().active;
      e.dispatch(who, e.getLegalActions(who)[0]!);
    }
    const s = e.getState();
    expect(s.board.every((c) => c)).toBe(true);
    const sc = score(s);
    expect(sc.player + sc.ai).toBe(4);
    expect(s.winner).toBe(sc.player === sc.ai ? 'draw' : sc.player > sc.ai ? 'player' : 'ai');
    expect(e.getLegalActions(s.active)).toEqual([]);
    expect(() => e.dispatch(s.active, { type: 'PLACE', uid: 1, cell: 0 })).toThrow();
  });
});

describe('tiebreak', () => {
  const cards = reg({ big: [9, 9, 9, 9], small: [1, 1, 1, 1] });
  const full = (owners: PlayerId[], ids: string[]): GameState => ({
    size: 2,
    board: owners.map((owner, i) => ({ uid: i + 1, cardId: ids[i]!, owner })),
    hands: { player: [], ai: [] },
    active: 'player',
    moves: 4,
    rngState: 1,
    winner: null,
  });

  it('most cards wins without needing the tiebreak', () => {
    const s = full(['player', 'player', 'player', 'ai'], ['small', 'small', 'small', 'big']);
    expect(decideWinner(s, cards)).toEqual({ winner: 'player' });
  });

  it('equal card counts go to the higher total card strength', () => {
    const s = full(['player', 'player', 'ai', 'ai'], ['big', 'small', 'small', 'small']);
    expect(strength(s, cards)).toEqual({ player: 40, ai: 8 });
    expect(decideWinner(s, cards)).toEqual({ winner: 'player', tiebreak: { player: 40, ai: 8 } });
    const flipped = full(['ai', 'ai', 'player', 'player'], ['big', 'small', 'small', 'small']);
    expect(decideWinner(flipped, cards).winner).toBe('ai');
  });

  it('is a draw only when counts and strength are both equal', () => {
    const s = full(['player', 'player', 'ai', 'ai'], ['big', 'small', 'big', 'small']);
    expect(decideWinner(s, cards).winner).toBe('draw');
  });

  it('is applied when the last card is placed', () => {
    const e = new GameEngine({ cards, pool: ['big', 'small', 'big', 'small'], seed: 1, size: 2, firstPlayer: 'player' });
    while (!e.getState().winner) {
      const who = e.getState().active;
      e.dispatch(who, e.getLegalActions(who)[0]!);
    }
    const s = e.getState();
    const sc = score(s);
    if (sc.player === sc.ai) expect(s.winner).toBe(decideWinner(s, cards).winner);
    expect(['player', 'ai', 'draw']).toContain(s.winner);
  });
});

describe('dealing', () => {
  const make = (seed: number) => new GameEngine({ cards: CARDS, pool: CARD_POOL, seed }).getState();
  const total = (s: GameState, p: PlayerId) => s.hands[p].reduce((sum, c) => sum + Object.values(CARDS[c.cardId]!.ranks as Ranks).reduce((a, b) => a + b, 0), 0);

  it('gives each player half the board and no card twice', () => {
    const s = make(11);
    expect(s.hands.player).toHaveLength(8);
    expect(s.hands.ai).toHaveLength(8);
    const uids = [...s.hands.player, ...s.hands.ai].map((c) => c.uid);
    expect(new Set(uids).size).toBe(16);
  });

  it('is deterministic per seed and differs between seeds', () => {
    expect(make(42)).toEqual(make(42));
    expect(make(42).hands.player.map((c) => c.cardId)).not.toEqual(make(43).hands.player.map((c) => c.cardId));
  });

  it('keeps the two hands close in total strength', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = make(seed);
      expect(Math.abs(total(s, 'player') - total(s, 'ai'))).toBeLessThanOrEqual(4);
    }
  });

  it('gives the extra card to the first mover on odd boards', () => {
    expect(handSizes(5, 'ai')).toEqual({ ai: 13, player: 12 });
    expect(handSizes(4, 'player')).toEqual({ player: 8, ai: 8 });
  });

  it('keeps all card ranks within 1..MAX_RANK', () => {
    for (const c of Object.values(CARDS)) for (const r of Object.values(c.ranks)) expect(r >= 1 && r <= MAX_RANK).toBe(true);
  });

  it('rejects invalid card data', () => {
    expect(() => buildRegistry([{ id: 'x', name: 'x', rarity: 'COMMON', ranks: { top: 0, right: 5, bottom: 5, left: 13 } }])).toThrow(/Invalid card data/);
  });
});

describe('architecture', () => {
  it('keeps src/game free of UI imports', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
    for (const file of walk('src/game').filter((f) => f.endsWith('.ts'))) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/from ['"](react|react-dom|pixi\.js|zustand)/);
    }
  });
});
