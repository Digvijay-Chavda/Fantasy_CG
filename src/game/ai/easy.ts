import { opponentOf } from '../engine/opponent';
import { nextRandom } from '../engine/rng';
import type { Action, CardRegistry, GameState, PlayerId } from '../engine/types';

export interface AiContext {
  /** Fog-of-war view for the AI — opponent hand/deck are masked. */
  view: GameState;
  cards: CardRegistry;
  me: PlayerId;
  legal: Action[];
}

function scoreAction(ctx: AiContext, a: Action): number {
  const { view, cards, me } = ctx;
  const enemy = opponentOf(me);
  if (a.type === 'END_TURN' || a.type === 'RECALL_UNIT') return 0; // the AI never recalls

  if (a.type === 'PLAY_CARD') {
    const inst = view.players[me].hand.find((c) => c.uid === a.uid);
    const d = inst && cards[inst.cardId];
    if (!d) return -1;
    let s = 2 + d.cost; // spend Essence, favour bigger plays
    if (d.type === 'CHARACTER') s += 3; // build a board before casting spells
    if (d.type === 'SPELL' && !view.units.some((u) => u.owner === enemy)) s -= 1;
    if (a.row === 'FRONT' && d.ranged) s -= 1; // keep ranged units safe in back
    return s;
  }

  const attacker = view.units.find((u) => u.uid === a.attackerUid)!;
  if (a.target.kind === 'HERO') {
    return attacker.power >= view.players[enemy].heroHealth ? 100 : 6 + attacker.power;
  }
  const targetUid = a.target.uid;
  const target = view.units.find((u) => u.uid === targetUid)!;
  const kills = attacker.power >= target.health;
  const ranged = !!cards[attacker.cardId]?.ranged;
  const dies = !ranged && target.power >= attacker.health;
  let s = 3 + target.power;
  if (kills) s += 4;
  if (dies && !kills) s -= 8; // bad trade
  if (dies && kills) s -= 1;
  return s;
}

/**
 * Easy AI: usually takes the best-scoring action, sometimes a random legal one.
 * Returns the chosen action and the advanced rng state (the engine rng is not touched).
 */
export function chooseEasyAction(ctx: AiContext, rngState: number, mistakeRate = 0.2): [Action, number] {
  let r: number;
  [r, rngState] = nextRandom(rngState);
  if (r < mistakeRate) {
    let pick: number;
    [pick, rngState] = nextRandom(rngState);
    return [ctx.legal[Math.floor(pick * ctx.legal.length)]!, rngState];
  }
  let best = ctx.legal[0]!;
  let bestScore = -Infinity;
  for (const a of ctx.legal) {
    const s = scoreAction(ctx, a);
    if (s > bestScore) {
      best = a;
      bestScore = s;
    }
  }
  // Only end the turn when nothing scores above zero.
  return [bestScore > 0 ? best : { type: 'END_TURN' }, rngState];
}
