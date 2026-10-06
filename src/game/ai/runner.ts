import type { GameEngine } from '../engine/GameEngine';
import type { Action, PlayerId } from '../engine/types';
import { chooseEasyAction } from './easy';
import { chooseNormalAction } from './normal';

export type AiDifficulty = 'easy' | 'normal';

export interface AiPlayer {
  rngState: number;
  /** Defaults to 'normal'. */
  difficulty?: AiDifficulty;
}

/** Picks the next action for `me` using only information it is allowed to see. */
export function nextAiAction(engine: GameEngine, me: PlayerId, ai: AiPlayer): Action {
  const ctx = { view: engine.getVisibleState(me), cards: engine.cards, me, legal: engine.getLegalActions(me) };
  if (ai.difficulty === 'easy') {
    const [action, rng] = chooseEasyAction(ctx, ai.rngState);
    ai.rngState = rng;
    return action;
  }
  return chooseNormalAction(ctx);
}
