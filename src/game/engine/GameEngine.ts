import { applyAction, createGame, getVisibleState, legalActions } from './rules';
import type { Action, CardRegistry, GameConfig, GameEvent, GameState, PlayerId } from './types';

/** Headless, framework-free facade over the pure rules. */
export class GameEngine {
  private state: GameState;
  readonly cards: CardRegistry;
  private log: GameEvent[] = [];

  constructor(config: GameConfig) {
    this.cards = config.cards;
    this.state = createGame(config).state;
  }

  /** Replaces the current game with a saved snapshot (e.g. after a page refresh). */
  restore(state: GameState) {
    this.state = state;
    this.log = [];
  }

  getState(): GameState {
    return this.state;
  }

  getVisibleState(viewer: PlayerId): GameState {
    return getVisibleState(this.state, viewer);
  }

  getLegalActions(playerId: PlayerId): Action[] {
    return legalActions(this.state, playerId);
  }

  getEventLog(): readonly GameEvent[] {
    return this.log;
  }

  dispatch(playerId: PlayerId, action: Action): GameEvent[] {
    if (playerId !== this.state.active) throw new Error(`It is not the ${playerId}'s turn`);
    const { state, events } = applyAction(this.state, action, this.cards);
    this.state = state;
    this.log.push(...events);
    return events;
  }

  place(playerId: PlayerId, uid: number, cell: number) {
    return this.dispatch(playerId, { type: 'PLACE', uid, cell });
  }
}
