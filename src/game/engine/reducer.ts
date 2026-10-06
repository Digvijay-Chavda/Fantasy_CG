import {
  HERO_HEALTH,
  MAX_ESSENCE,
  MAX_HAND,
  SLOTS_PER_ROW,
  STARTING_HAND,
} from './constants';
import { opponentOf } from './opponent';
import { nextRandom, randomInt } from './rng';
import type {
  Ability,
  Action,
  AttackTarget,
  CardDef,
  CardRegistry,
  GameConfig,
  GameEvent,
  GameState,
  PlayerId,
  Row,
  StepResult,
  Unit,
} from './types';

type Ctx = { state: GameState; cards: CardRegistry; events: GameEvent[] };

const def = (ctx: Ctx, cardId: string): CardDef => {
  const d = ctx.cards[cardId];
  if (!d) throw new Error(`Unknown card: ${cardId}`);
  return d;
};

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

// ---------------------------------------------------------------- setup

export function createGame(config: GameConfig): StepResult {
  let rng = config.seed >>> 0;
  let uid = 1;
  const players = {} as GameState['players'];
  for (const id of ['player', 'ai'] as PlayerId[]) {
    const instances = config.decks[id].map((cardId) => {
      if (!config.cards[cardId]) throw new Error(`Unknown card in deck: ${cardId}`);
      return { uid: uid++, cardId };
    });
    let deck;
    [deck, rng] = shuffle(instances, rng);
    players[id] = {
      id,
      heroHealth: HERO_HEALTH,
      essence: 0,
      maxEssence: 0,
      fatigue: 0,
      deck,
      hand: deck.splice(0, STARTING_HAND),
    };
  }
  const first = config.firstPlayer ?? 'player';
  const state: GameState = {
    turn: 0,
    active: first,
    players,
    units: [],
    nextUid: uid,
    rngState: rng,
    winner: null,
  };
  const ctx: Ctx = { state, cards: config.cards, events: [] };
  startTurn(ctx, first, true);
  return { state: ctx.state, events: ctx.events };
}

function startTurn(ctx: Ctx, pid: PlayerId, skipDraw = false) {
  const { state } = ctx;
  state.turn += 1;
  state.active = pid;
  const p = state.players[pid];
  p.maxEssence = Math.min(p.maxEssence + 1, MAX_ESSENCE);
  p.essence = p.maxEssence;
  for (const u of state.units) if (u.owner === pid) u.ready = true;
  ctx.events.push({ type: 'TURN_STARTED', player: pid, turn: state.turn });
  if (!skipDraw) draw(ctx, pid, 1);
}

function draw(ctx: Ctx, pid: PlayerId, count: number) {
  const p = ctx.state.players[pid];
  for (let i = 0; i < count && !ctx.state.winner; i++) {
    const card = p.deck.shift();
    if (!card) {
      p.fatigue += 1;
      ctx.events.push({ type: 'CARD_DRAWN', player: pid, cardId: null });
      damageHero(ctx, pid, p.fatigue);
      continue;
    }
    if (p.hand.length >= MAX_HAND) {
      ctx.events.push({ type: 'CARD_BURNED', player: pid, cardId: card.cardId });
      continue;
    }
    p.hand.push(card);
    ctx.events.push({ type: 'CARD_DRAWN', player: pid, cardId: card.cardId });
  }
}

// ---------------------------------------------------------------- damage

function checkWinner(ctx: Ctx) {
  if (ctx.state.winner) return;
  for (const pid of ['player', 'ai'] as PlayerId[]) {
    if (ctx.state.players[pid].heroHealth <= 0) {
      ctx.state.winner = opponentOf(pid);
      ctx.events.push({ type: 'GAME_OVER', winner: ctx.state.winner });
      return;
    }
  }
}

function damageHero(ctx: Ctx, pid: PlayerId, amount: number) {
  if (amount <= 0) return;
  ctx.state.players[pid].heroHealth -= amount;
  ctx.events.push({ type: 'DAMAGE', target: { kind: 'HERO' }, owner: pid, amount });
  checkWinner(ctx);
}

function damageUnit(ctx: Ctx, unit: Unit, amount: number) {
  if (amount <= 0) return;
  unit.health -= amount;
  ctx.events.push({
    type: 'DAMAGE',
    target: { kind: 'UNIT', uid: unit.uid },
    owner: unit.owner,
    amount,
  });
  if (unit.health <= 0) {
    ctx.state.units = ctx.state.units.filter((u) => u.uid !== unit.uid);
    ctx.events.push({
      type: 'UNIT_DIED',
      unitUid: unit.uid,
      cardId: unit.cardId,
      owner: unit.owner,
    });
  }
}

// ---------------------------------------------------------------- abilities

function resolveAbility(ctx: Ctx, owner: PlayerId, ability: Ability) {
  const { state } = ctx;
  const enemy = opponentOf(owner);
  const enemyUnits = state.units.filter((u) => u.owner === enemy);

  switch (ability.type) {
    case 'DAMAGE': {
      if (ability.target === 'ENEMY_HERO') return damageHero(ctx, enemy, ability.value);
      if (ability.target === 'ENEMY_LOWEST_HEALTH') {
        const t = [...enemyUnits].sort((a, b) => a.health - b.health || a.uid - b.uid)[0];
        return t ? damageUnit(ctx, t, ability.value) : damageHero(ctx, enemy, ability.value);
      }
      if (ability.target === 'ENEMY_RANDOM') {
        let i: number;
        [i, state.rngState] = randomInt(state.rngState, enemyUnits.length + 1);
        const t = enemyUnits[i];
        return t ? damageUnit(ctx, t, ability.value) : damageHero(ctx, enemy, ability.value);
      }
      return;
    }
    case 'HEAL': {
      if (ability.target === 'ALLY_HERO') {
        const p = state.players[owner];
        const amount = Math.min(ability.value, HERO_HEALTH - p.heroHealth);
        if (amount > 0) {
          p.heroHealth += amount;
          ctx.events.push({ type: 'HEAL', target: { kind: 'HERO' }, owner, amount });
        }
      } else if (ability.target === 'ALLY_ALL') {
        for (const u of state.units.filter((x) => x.owner === owner)) {
          const amount = Math.min(ability.value, u.maxHealth - u.health);
          if (amount > 0) {
            u.health += amount;
            ctx.events.push({ type: 'HEAL', target: { kind: 'UNIT', uid: u.uid }, owner, amount });
          }
        }
      }
      return;
    }
    case 'BUFF': {
      if (ability.target === 'ALLY_ALL') {
        for (const u of state.units.filter((x) => x.owner === owner)) {
          u.power += ability.value;
          ctx.events.push({ type: 'BUFF', unitUid: u.uid, power: ability.value });
        }
      }
      return;
    }
    case 'DRAW':
      return draw(ctx, owner, ability.value);
  }
}

// ---------------------------------------------------------------- rules queries

export function attackTargets(state: GameState, attacker: Unit, cards: CardRegistry): AttackTarget[] {
  const d = cards[attacker.cardId];
  const ranged = !!d?.ranged;
  if (!attacker.ready || attacker.power <= 0) return [];
  if (!ranged && attacker.row === 'BACK') return [];
  const enemy = opponentOf(attacker.owner);
  const enemyUnits = state.units.filter((u) => u.owner === enemy);
  const front = enemyUnits.filter((u) => u.row === 'FRONT');
  const targets: AttackTarget[] = [];

  if (ranged) {
    for (const u of enemyUnits) targets.push({ kind: 'UNIT', uid: u.uid });
  } else if (front.length > 0) {
    for (const u of front) targets.push({ kind: 'UNIT', uid: u.uid });
  } else {
    for (const u of enemyUnits) targets.push({ kind: 'UNIT', uid: u.uid });
  }
  // The hero can only be struck once the enemy frontline has fallen.
  if (front.length === 0) targets.push({ kind: 'HERO' });
  return targets;
}

export function freeSlots(state: GameState, owner: PlayerId, row: Row): number[] {
  const taken = new Set(state.units.filter((u) => u.owner === owner && u.row === row).map((u) => u.slot));
  return Array.from({ length: SLOTS_PER_ROW }, (_, i) => i).filter((i) => !taken.has(i));
}

export function legalActions(state: GameState, cards: CardRegistry, pid: PlayerId): Action[] {
  if (state.winner || state.active !== pid) return [];
  const p = state.players[pid];
  const actions: Action[] = [];

  for (const inst of p.hand) {
    const d = cards[inst.cardId];
    if (!d || d.cost > p.essence) continue;
    if (d.type === 'SPELL') {
      actions.push({ type: 'PLAY_CARD', uid: inst.uid });
      continue;
    }
    for (const row of d.rows ?? []) {
      for (const slot of freeSlots(state, pid, row)) {
        actions.push({ type: 'PLAY_CARD', uid: inst.uid, row, slot });
      }
    }
  }
  for (const u of state.units) {
    if (u.owner !== pid) continue;
    for (const target of attackTargets(state, u, cards)) {
      actions.push({ type: 'ATTACK', attackerUid: u.uid, target });
    }
  }
  actions.push({ type: 'END_TURN' });
  return actions;
}

// ---------------------------------------------------------------- reducer

export function applyAction(state: GameState, action: Action, cards: CardRegistry): StepResult {
  if (state.winner) throw new Error('Game is over');
  const ctx: Ctx = { state: structuredClone(state), cards, events: [] };
  const pid = ctx.state.active;

  switch (action.type) {
    case 'PLAY_CARD':
      playCard(ctx, pid, action);
      break;
    case 'ATTACK':
      attack(ctx, pid, action.attackerUid, action.target);
      break;
    case 'END_TURN':
      startTurn(ctx, opponentOf(pid));
      break;
  }
  return { state: ctx.state, events: ctx.events };
}

function playCard(ctx: Ctx, pid: PlayerId, a: Extract<Action, { type: 'PLAY_CARD' }>) {
  const p = ctx.state.players[pid];
  const idx = p.hand.findIndex((c) => c.uid === a.uid);
  const inst = p.hand[idx];
  if (!inst) throw new Error('Card is not in hand');
  const d = def(ctx, inst.cardId);
  if (d.cost > p.essence) throw new Error('Not enough Essence');

  let unitUid: number | undefined;
  if (d.type === 'CHARACTER') {
    if (!a.row || a.slot === undefined) throw new Error('Characters need a row and slot');
    if (!d.rows?.includes(a.row)) throw new Error(`${d.name} cannot be deployed to ${a.row}`);
    if (!freeSlots(ctx.state, pid, a.row).includes(a.slot)) throw new Error('Slot is not free');
    unitUid = ctx.state.nextUid++;
    ctx.state.units.push({
      uid: unitUid,
      cardId: d.id,
      owner: pid,
      power: d.power ?? 0,
      health: d.health ?? 1,
      maxHealth: d.health ?? 1,
      row: a.row,
      slot: a.slot,
      ready: false,
    });
  }
  p.essence -= d.cost;
  p.hand.splice(idx, 1);
  ctx.events.push({ type: 'CARD_PLAYED', player: pid, cardId: d.id, unitUid });
  for (const ability of d.abilities) {
    if (ability.trigger === 'ON_PLAY' && !ctx.state.winner) resolveAbility(ctx, pid, ability);
  }
}

function attack(ctx: Ctx, pid: PlayerId, attackerUid: number, target: AttackTarget) {
  const attacker = ctx.state.units.find((u) => u.uid === attackerUid && u.owner === pid);
  if (!attacker) throw new Error('No such attacker');
  const legal = attackTargets(ctx.state, attacker, ctx.cards);
  const ok = legal.some((t) => t.kind === target.kind && (t.kind === 'HERO' || (target.kind === 'UNIT' && t.uid === target.uid)));
  if (!ok) throw new Error('Illegal attack target');

  attacker.ready = false;
  ctx.events.push({ type: 'ATTACK', attackerUid, target });
  if (target.kind === 'HERO') {
    damageHero(ctx, opponentOf(pid), attacker.power);
    return;
  }
  const defender = ctx.state.units.find((u) => u.uid === target.uid)!;
  const ranged = !!def(ctx, attacker.cardId).ranged;
  const retaliation = defender.power;
  damageUnit(ctx, defender, attacker.power);
  if (!ranged) damageUnit(ctx, attacker, retaliation);
}

/** Hide everything the viewer is not allowed to know (opponent hand + deck order). */
export function getVisibleState(state: GameState, viewer: PlayerId): GameState {
  const view = structuredClone(state);
  const opp = view.players[opponentOf(viewer)];
  opp.hand = opp.hand.map((c) => ({ uid: c.uid, cardId: 'HIDDEN' }));
  opp.deck = opp.deck.map((c) => ({ uid: c.uid, cardId: 'HIDDEN' }));
  view.rngState = 0;
  return view;
}

export { nextRandom };
