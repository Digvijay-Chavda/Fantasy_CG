import { capturesFor } from '../engine/rules';
import { nextRandom } from '../engine/rng';
import type { Action, CardRegistry, GameState, PlayerId } from '../engine/types';

export interface AiContext {
  /** Fog-of-war view for the AI: the opponent's hand is masked. */
  view: GameState;
  cards: CardRegistry;
  me: PlayerId;
  legal: Action[];
}

/**
 * Easy AI: usually takes the placement that flips the most cards, sometimes a random legal one.
 * Returns the chosen action and the advanced rng state.
 */
export function chooseEasyAction(ctx: AiContext, rngState: number, mistakeRate = 0.35): [Action, number] {
  const { view, cards, me, legal } = ctx;
  let r: number;
  [r, rngState] = nextRandom(rngState);
  if (r < mistakeRate) {
    let pick: number;
    [pick, rngState] = nextRandom(rngState);
    return [legal[Math.floor(pick * legal.length)]!, rngState];
  }
  let best: Action[] = [];
  let bestFlips = -1;
  for (const a of legal) {
    const card = view.hands[me].find((c) => c.uid === a.uid);
    const flips = card ? capturesFor(view, cards, me, card.cardId, a.cell).length : 0;
    if (flips > bestFlips) {
      best = [a];
      bestFlips = flips;
    } else if (flips === bestFlips) best.push(a);
  }
  let pick: number;
  [pick, rngState] = nextRandom(rngState);
  return [best[Math.floor(pick * best.length)]!, rngState];
}
