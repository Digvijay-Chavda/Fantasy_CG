import type { GameEngine } from '../engine/GameEngine';
import type { Action, PlayerId } from '../engine/types';
import { chooseEasyAction } from './easy';

export interface AiPlayer {
  rngState: number;
}

/** Picks the next action for `me` using only information it is allowed to see. */
export function nextAiAction(engine: GameEngine, me: PlayerId, ai: AiPlayer): Action {
  const [action, rng] = chooseEasyAction(
    { view: engine.getVisibleState(me), cards: engine.cards, me, legal: engine.getLegalActions(me) },
    ai.rngState,
  );
  ai.rngState = rng;
  return action;
}

/** Plays a whole turn synchronously (used by tests/simulation; the UI steps with delays). */
export function playAiTurn(engine: GameEngine, me: PlayerId, ai: AiPlayer): void {
  for (let guard = 0; guard < 100; guard++) {
    const action = nextAiAction(engine, me, ai);
    engine.dispatch(me, action);
    if (action.type === 'END_TURN' || engine.getState().winner) return;
  }
  throw new Error('AI exceeded action guard');
}
