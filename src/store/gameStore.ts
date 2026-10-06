import { create } from 'zustand';
import { CARD_POOL, CARDS } from '../data/cards';
import { nextAiAction, type AiDifficulty, type AiPlayer } from '../game/ai/runner';
import { GameEngine } from '../game/engine';
import type { GameEvent, GameState } from '../game/engine';
import { describeEvents } from '../game/log';

const AI_DELAY_MS = 800;
const LOG_LIMIT = 80;
const SAVE_KEY = 'fantasy-cg-triad-save-v1';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SaveData {
  state: GameState;
  ai: AiPlayer;
  log: string[];
}

/** A saved game is only trusted if every card in it still exists. */
function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    const s = data.state;
    const ids = [...s.board.filter((c) => c).map((c) => c!.cardId), ...s.hands.player.map((c) => c.cardId), ...s.hands.ai.map((c) => c.cardId)];
    if (!Array.isArray(s.board) || typeof data.ai?.rngState !== 'number' || ids.some((id) => !CARDS[id])) return null;
    return data;
  } catch {
    return null;
  }
}

function writeSave(data: SaveData) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // storage unavailable: the game just won't survive a refresh
  }
}

let ai: AiPlayer = { rngState: 1234, difficulty: 'normal' };
let engine = newEngine();
const saved = loadSave();
if (saved) {
  engine.restore(saved.state);
  ai = saved.ai;
}

function newEngine() {
  const seed = (Math.random() * 2 ** 32) >>> 0;
  ai = { ...ai, rngState: seed ^ 0x9e3779b9 };
  return new GameEngine({ cards: CARDS, pool: CARD_POOL, seed });
}

/** UI-only state plus the latest engine snapshot. Game rules live in the engine. */
interface GameStore {
  game: GameState;
  selectedHand: number | null;
  aiThinking: boolean;
  log: string[];
  error: string | null;
  /** Cell of the most recent placement and the cells it flipped, for highlighting. */
  lastPlaced: number | null;
  lastFlipped: number[];
  difficulty: AiDifficulty;
  selectHand: (uid: number) => void;
  placeAt: (cell: number) => void;
  placeCard: (uid: number, cell: number) => void;
  setDifficulty: (d: AiDifficulty) => void;
  restart: () => void;
}

export const useGameStore = create<GameStore>((set, get) => {
  const sync = (extra: Partial<GameStore> = {}) => {
    set({ game: engine.getState(), error: null, ...extra });
    writeSave({ state: engine.getState(), ai, log: get().log });
  };

  /** Runs an engine action; logs it and records which cells just changed. */
  const act = (fn: () => GameEvent[]) => {
    const events = fn();
    const lines = describeEvents(events, CARDS, engine.getState().size);
    const placed = events.find((e) => e.type === 'PLACED');
    set({
      log: [...get().log, ...lines].slice(-LOG_LIMIT),
      lastPlaced: placed && placed.type === 'PLACED' ? placed.cell : null,
      lastFlipped: events.flatMap((e) => (e.type === 'CAPTURED' ? [e.cell] : [])),
    });
  };

  const guard = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      set({ error: (e as Error).message });
    }
  };

  let aiRun = 0; // a newer run (e.g. after Restart) cancels any older one
  async function runAiTurn() {
    const run = ++aiRun;
    set({ aiThinking: true });
    while (!engine.getState().winner && engine.getState().active === 'ai') {
      await sleep(AI_DELAY_MS);
      if (run !== aiRun) return;
      const action = nextAiAction(engine, 'ai', ai);
      act(() => engine.dispatch('ai', action));
      sync({ aiThinking: true });
    }
    set({ aiThinking: false });
  }

  // Refreshed during the enemy's turn: let it finish.
  if (!engine.getState().winner && engine.getState().active === 'ai') setTimeout(() => void runAiTurn(), 0);

  return {
    game: engine.getState(),
    selectedHand: null,
    aiThinking: false,
    log: saved?.log ?? [],
    error: null,
    lastPlaced: null,
    lastFlipped: [],
    difficulty: ai.difficulty ?? 'normal',

    selectHand: (uid) => {
      const s = get();
      if (s.aiThinking || s.game.active !== 'player' || s.game.winner) return;
      set({ selectedHand: s.selectedHand === uid ? null : uid, error: null });
    },

    placeAt: (cell) => {
      const uid = get().selectedHand;
      if (uid !== null) get().placeCard(uid, cell);
    },

    placeCard: (uid, cell) => {
      const s = get();
      if (s.aiThinking || s.game.active !== 'player' || s.game.winner) return;
      guard(() => {
        act(() => engine.place('player', uid, cell));
        sync({ selectedHand: null });
        if (!engine.getState().winner) void runAiTurn();
      });
    },

    setDifficulty: (d) => {
      ai = { ...ai, difficulty: d };
      set({ difficulty: d });
      sync();
    },

    restart: () => {
      engine = newEngine();
      aiRun++; // cancel a running AI turn
      sync({ selectedHand: null, aiThinking: false, log: [], lastPlaced: null, lastFlipped: [] });
      // The AI may move first in the new game.
      if (engine.getState().active === 'ai') void runAiTurn();
    },
  };
});
