import { applyAction, capturesFor, emptyCells } from '../engine/rules';
import type { Action, CardRegistry, GameState, PlayerId } from '../engine/types';
import type { AiContext } from './easy';

/** Cards the opponent may hold: everything that is neither on the board nor in my hand. */
function unseenCards(view: GameState, cards: CardRegistry, me: PlayerId): string[] {
  const known = new Set<string>();
  for (const c of view.board) if (c) known.add(c.cardId);
  for (const c of view.hands[me]) known.add(c.cardId);
  return Object.keys(cards).filter((id) => !known.has(id));
}

/**
 * Normal AI: two-ply look-ahead with imperfect information. For every placement it scores
 *   +10 per card flipped now
 *   -10 x the opponent's expected best reply, averaged over the cards they might hold
 *   -0.1 x card strength (spend weak cards on safe spots, save strong ones for captures)
 * Deterministic: ties keep the first option.
 */
export function chooseNormalAction(ctx: AiContext): Action {
  const { view, cards, me, legal } = ctx;
  const foe: PlayerId = me === 'player' ? 'ai' : 'player';
  const unseen = unseenCards(view, cards, me);
  let best = legal[0]!;
  let bestScore = -Infinity;

  for (const a of legal) {
    const inst = view.hands[me].find((c) => c.uid === a.uid);
    if (!inst) continue;
    const def = cards[inst.cardId]!;
    const flips = capturesFor(view, cards, me, inst.cardId, a.cell).length;
    const after = applyAction(view, a, cards).state;

    // The opponent's best reply, averaged over what they could be holding.
    let reply = 0;
    if (!after.winner && unseen.length > 0) {
      const cells = emptyCells(after);
      for (const id of unseen) {
        let top = 0;
        for (const cell of cells) top = Math.max(top, capturesFor(after, cards, foe, id, cell).length);
        reply += top;
      }
      reply /= unseen.length;
    }

    const strength = def.ranks.top + def.ranks.right + def.ranks.bottom + def.ranks.left;
    const score = flips * 10 - reply * 10 - 0.1 * strength;
    if (score > bestScore) {
      best = a;
      bestScore = score;
    }
  }
  return best;
}
