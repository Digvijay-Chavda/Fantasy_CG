import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { GameEngine } from '../src/game/engine';
import type { CardRegistry, PlayerId } from '../src/game/engine';
import { PLACEHOLDER_CARDS } from '../src/data/cards/placeholder';
import { STARTER_DECK } from '../src/data/decks/starter';
import { playAiTurn } from '../src/game/ai/runner';

const make = (decks?: Partial<Record<PlayerId, string[]>>, cards: CardRegistry = PLACEHOLDER_CARDS, seed = 1) =>
  new GameEngine({ cards, seed, decks: { player: decks?.player ?? STARTER_DECK, ai: decks?.ai ?? STARTER_DECK } });

const uidOf = (e: GameEngine, p: PlayerId, cardId: string) => e.getState().players[p].hand.find((c) => c.cardId === cardId)!.uid;

/** Hand of exactly these cards for `player`, filler for the rest. */
const rig = (player: string[], ai: string[] = Array(10).fill('squire')) => make({ player: [...player, ...Array(10).fill('squire')], ai }, PLACEHOLDER_CARDS, 7);

/** Force specific cards into hand by putting them first and disabling shuffle effects via a large deck search. */
function giveHand(e: GameEngine, p: PlayerId, ids: string[]) {
  const s = e.getState();
  const pool = [...s.players[p].hand, ...s.players[p].deck];
  s.players[p].hand = ids.map((id) => {
    const i = pool.findIndex((c) => c.cardId === id);
    if (i < 0) throw new Error(`rig: ${id} not in deck`);
    return pool.splice(i, 1)[0]!;
  });
  s.players[p].deck = pool;
}

describe('setup', () => {
  it('deals 5 cards each, gives first player 1 essence, no first-turn draw', () => {
    const e = make();
    const s = e.getState();
    expect(s.players.player.hand).toHaveLength(5);
    expect(s.players.ai.hand).toHaveLength(5);
    expect(s.players.player.essence).toBe(1);
    expect(s.active).toBe('player');
  });

  it('is deterministic for a seed', () => {
    expect(make().getState()).toEqual(make().getState());
    expect(make(undefined, undefined, 2).getState().players.player.hand).not.toEqual(make().getState().players.player.hand);
  });
});

describe('playing cards', () => {
  it('spends essence and places a unit that cannot attack yet', () => {
    const e = rig(['squire']);
    giveHand(e, 'player', ['squire']);
    e.playCard('player', uidOf(e, 'player', 'squire'), 'FRONT', 0);
    const s = e.getState();
    expect(s.players.player.essence).toBe(0);
    expect(s.units).toHaveLength(1);
    expect(s.units[0]!.ready).toBe(false);
  });

  it('rejects unaffordable cards and wrong rows', () => {
    const e = rig(['demon', 'healer']);
    giveHand(e, 'player', ['demon', 'healer']);
    expect(() => e.playCard('player', uidOf(e, 'player', 'demon'), 'FRONT', 0)).toThrow(/Essence/);
    e.getState().players.player.essence = 5;
    expect(() => e.playCard('player', uidOf(e, 'player', 'healer'), 'FRONT', 0)).toThrow(/cannot be deployed/);
  });

  it('spell damage hits weakest enemy unit, or hero when none', () => {
    const e = rig(['fireball']);
    giveHand(e, 'player', ['fireball']);
    e.getState().players.player.essence = 3;
    e.playCard('player', uidOf(e, 'player', 'fireball'));
    expect(e.getState().players.ai.heroHealth).toBe(26);
  });
});

describe('combat rules', () => {
  function setup() {
    const e = rig(['knight']);
    const s = e.getState();
    s.units.push(
      { uid: 900, cardId: 'knight', owner: 'player', power: 3, health: 3, maxHealth: 3, row: 'FRONT', slot: 0, ready: true },
      { uid: 901, cardId: 'archer', owner: 'player', power: 2, health: 2, maxHealth: 2, row: 'BACK', slot: 0, ready: true },
      { uid: 910, cardId: 'knight', owner: 'ai', power: 3, health: 3, maxHealth: 3, row: 'FRONT', slot: 0, ready: true },
      { uid: 911, cardId: 'healer', owner: 'ai', power: 1, health: 3, maxHealth: 3, row: 'BACK', slot: 0, ready: true },
    );
    return e;
  }

  it('melee must hit the frontline and cannot reach the hero', () => {
    const e = setup();
    expect(() => e.attack('player', 900, { kind: 'HERO' })).toThrow();
    expect(() => e.attack('player', 900, { kind: 'UNIT', uid: 911 })).toThrow();
  });

  it('melee trades with retaliation', () => {
    const e = setup();
    e.attack('player', 900, { kind: 'UNIT', uid: 910 });
    expect(e.getState().units.map((u) => u.uid).sort()).toEqual([901, 911]);
  });

  it('ranged units bypass the frontline for units, take no retaliation, but still cannot hit hero', () => {
    const e = setup();
    expect(() => e.attack('player', 901, { kind: 'HERO' })).toThrow();
    e.attack('player', 901, { kind: 'UNIT', uid: 911 });
    const u = e.getState().units;
    expect(u.find((x) => x.uid === 911)!.health).toBe(1);
    expect(u.find((x) => x.uid === 901)!.health).toBe(2);
  });

  it('hero becomes targetable once the frontline is gone, and lethal ends the game', () => {
    const e = setup();
    const s = e.getState();
    s.units = s.units.filter((u) => u.uid !== 910);
    s.players.ai.heroHealth = 3;
    e.attack('player', 900, { kind: 'HERO' });
    expect(e.getState().winner).toBe('player');
    expect(() => e.endTurn()).toThrow(/over/);
  });

  it('units attack once per turn and wake up next turn', () => {
    const e = setup();
    e.attack('player', 901, { kind: 'UNIT', uid: 911 });
    expect(() => e.attack('player', 901, { kind: 'UNIT', uid: 911 })).toThrow();
    e.endTurn();
    e.endTurn();
    expect(e.getState().units.find((u) => u.uid === 901)!.ready).toBe(true);
  });

  it("can't act out of turn", () => {
    const e = make();
    expect(() => e.endTurn('ai')).toThrow(/turn/);
  });
});

describe('turn flow', () => {
  it('essence grows by one up to 10 and refills; draws a card', () => {
    const e = make();
    e.endTurn();
    expect(e.getState().players.ai.maxEssence).toBe(1);
    expect(e.getState().players.ai.hand).toHaveLength(6);
    for (let i = 0; i < 40; i++) {
      if (e.getState().winner) break;
      e.endTurn();
    }
    expect(Math.max(...Object.values(e.getState().players).map((p) => p.maxEssence))).toBeLessThanOrEqual(10);
  });

  it('empty deck causes escalating fatigue damage', () => {
    const e = make({ player: ['squire', 'squire', 'squire', 'squire', 'squire'] });
    e.endTurn();
    e.endTurn(); // player draws from empty deck
    expect(e.getState().players.player.heroHealth).toBe(29);
    e.endTurn();
    e.endTurn();
    expect(e.getState().players.player.heroHealth).toBe(27);
  });
});

describe('AI', () => {
  it('only sees a masked opponent hand', () => {
    const e = make();
    const view = e.getVisibleState('ai');
    expect(view.players.player.hand.every((c) => c.cardId === 'HIDDEN')).toBe(true);
    expect(view.players.ai.hand.some((c) => c.cardId !== 'HIDDEN')).toBe(true);
  });

  it('two AIs finish a full game with a winner', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const e = make(undefined, undefined, seed);
      const ais = { player: { rngState: seed }, ai: { rngState: seed + 100 } };
      let turns = 0;
      while (!e.getState().winner && turns++ < 200) playAiTurn(e, e.getState().active, ais[e.getState().active]);
      expect(e.getState().winner, `seed ${seed}`).not.toBeNull();
    }
  });
});

describe('architecture', () => {
  it('game engine never imports React or PixiJS', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
    for (const file of walk('src/game')) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/from ['"](react|react-dom|pixi\.js|zustand)/);
    }
  });
});
