import { applyAction, createGame, getVisibleState, legalActions } from './reducer';
import type {
  Action,
  CardRegistry,
  GameConfig,
  GameEvent,
  GameState,
  PlayerId,
  Row,
} from './types';

/** Headless, framework-free facade over the pure reducer. */
export class GameEngine {
  private state: GameState;
  readonly cards: CardRegistry;
  private log: GameEvent[];

  constructor(config: GameConfig) {
    this.cards = config.cards;
    const { state, events } = createGame(config);
    this.state = state;
    this.log = events;
  }

  getState(): GameState {
    return this.state;
  }

  getVisibleState(viewer: PlayerId): GameState {
    return getVisibleState(this.state, viewer);
  }

  getLegalActions(playerId: PlayerId): Action[] {
    return legalActions(this.state, this.cards, playerId);
  }

  getEventLog(): readonly GameEvent[] {
    return this.log;
  }

  /** Applies an action for the active player and returns the events it produced. */
  dispatch(playerId: PlayerId, action: Action): GameEvent[] {
    if (playerId !== this.state.active) throw new Error(`Not ${playerId}'s turn`);
    const { state, events } = applyAction(this.state, action, this.cards);
    this.state = state;
    this.log.push(...events);
    return events;
  }

  playCard(playerId: PlayerId, uid: number, row?: Row, slot?: number) {
    return this.dispatch(playerId, { type: 'PLAY_CARD', uid, row, slot });
  }

  attack(playerId: PlayerId, attackerUid: number, target: Extract<Action, { type: 'ATTACK' }>['target']) {
    return this.dispatch(playerId, { type: 'ATTACK', attackerUid, target });
  }

  recall(playerId: PlayerId, unitUid: number) {
    return this.dispatch(playerId, { type: 'RECALL_UNIT', unitUid });
  }

  endTurn(playerId: PlayerId = this.state.active) {
    return this.dispatch(playerId, { type: 'END_TURN' });
  }
}
