import { create } from 'zustand';
import { PLACEHOLDER_CARDS } from '../data/cards/placeholder';
import { STARTER_DECK } from '../data/decks/starter';
import { nextAiAction, type AiPlayer } from '../game/ai/runner';
import { GameEngine } from '../game/engine';
import type { AttackTarget, GameEvent, GameState, Row } from '../game/engine';
import { describeEvents } from '../game/log';

const AI_DELAY_MS = 700;
const LOG_LIMIT = 60;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let ai: AiPlayer = { rngState: 1234 };
let engine = newEngine();

function newEngine() {
  const seed = (Math.random() * 2 ** 32) >>> 0;
  ai = { rngState: seed ^ 0x9e3779b9 };
  return new GameEngine({
    cards: PLACEHOLDER_CARDS,
    seed,
    decks: { player: STARTER_DECK, ai: STARTER_DECK },
  });
}

/** UI-only state plus the latest engine snapshot. Game rules live in the engine. */
interface GameStore {
  game: GameState;
  selectedHand: number | null;
  selectedUnit: number | null;
  aiThinking: boolean;
  log: string[];
  error: string | null;
  selectHand: (uid: number) => void;
  selectUnit: (uid: number) => void;
  deploy: (row: Row, slot: number) => void;
  deployCard: (uid: number, row: Row, slot: number) => void;
  recall: (unitUid: number) => void;
  attack: (target: AttackTarget) => void;
  endTurn: () => void;
  restart: () => void;
}

export const useGameStore = create<GameStore>((set, get) => {
  const sync = (extra: Partial<GameStore> = {}) =>
    set({ game: engine.getState(), error: null, ...extra });
  /** Runs an engine action and appends a readable description of what happened to the log. */
  const act = (fn: () => GameEvent[]) => {
    const before = engine.getState();
    const events = fn();
    // A turn change also draws a card; only announce the new turn itself.
    const shown = events.some((e) => e.type === 'TURN_STARTED')
      ? events.filter((e) => e.type === 'TURN_STARTED')
      : events;
    const lines = describeEvents(shown, before, PLACEHOLDER_CARDS);
    set({ log: [...get().log, ...lines].slice(-LOG_LIMIT) });
  };
  const guard = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      set({ error: (e as Error).message });
    }
  };

  async function runAiTurn() {
    set({ aiThinking: true });
    while (!engine.getState().winner && engine.getState().active === 'ai') {
      await sleep(AI_DELAY_MS);
      const action = nextAiAction(engine, 'ai', ai);
      act(() => engine.dispatch('ai', action));
      sync({ aiThinking: true });
    }
    set({ aiThinking: false });
  }

  return {
    game: engine.getState(),
    selectedHand: null,
    selectedUnit: null,
    aiThinking: false,
    log: [],
    error: null,

    selectHand: (uid) => {
      const s = get();
      if (s.aiThinking || s.game.active !== 'player') return;
      const inst = s.game.players.player.hand.find((c) => c.uid === uid);
      const d = inst && PLACEHOLDER_CARDS[inst.cardId];
      if (!d) return;
      if (d.type === 'SPELL') {
        guard(() => {
          act(() => engine.playCard('player', uid));
          sync({ selectedHand: null, selectedUnit: null });
        });
      } else {
        set({ selectedHand: s.selectedHand === uid ? null : uid, selectedUnit: null, error: null });
      }
    },

    selectUnit: (uid) => {
      if (get().aiThinking || get().game.active !== 'player') return;
      set({ selectedUnit: get().selectedUnit === uid ? null : uid, selectedHand: null, error: null });
    },

    deploy: (row, slot) => {
      const uid = get().selectedHand;
      if (uid !== null) get().deployCard(uid, row, slot);
    },

    deployCard: (uid, row, slot) => {
      if (get().aiThinking || get().game.active !== 'player') return;
      guard(() => {
        act(() => engine.playCard('player', uid, row, slot));
        sync({ selectedHand: null });
      });
    },

    recall: (unitUid) => {
      if (get().aiThinking || get().game.active !== 'player') return;
      guard(() => {
        act(() => engine.recall('player', unitUid));
        sync({ selectedUnit: null });
      });
    },

    attack: (target) => {
      const uid = get().selectedUnit;
      if (uid === null) return;
      guard(() => {
        act(() => engine.attack('player', uid, target));
        sync({ selectedUnit: null });
      });
    },

    endTurn: () => {
      if (get().aiThinking || get().game.winner) return;
      guard(() => {
        act(() => engine.endTurn('player'));
        sync({ selectedHand: null, selectedUnit: null });
        void runAiTurn();
      });
    },

    restart: () => {
      engine = newEngine();
      sync({ selectedHand: null, selectedUnit: null, aiThinking: false, log: [] });
    },
  };
});
