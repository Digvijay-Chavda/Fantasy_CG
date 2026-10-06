import gsap from 'gsap';
import { create } from 'zustand';
import { CARD_POOL, CARDS } from '../data/cards';
import { nextAiAction, type AiDifficulty, type AiPlayer } from '../game/ai/runner';
import { GameEngine } from '../game/engine';
import type { GameEvent, GameState, PlayerId } from '../game/engine';
import { describeEvents } from '../game/log';
import { audio } from '../render/audio';
import type { TableScene } from '../render/TableScene';

const LOG_LIMIT = 80;
const SAVE_KEY = 'fantasy-cg-triad-save-v1';
const SETTINGS_KEY = 'fantasy-cg-settings-v1';
const STATS_KEY = 'fantasy-cg-stats-v1';
const THINK_MS = 450;

// ---------------------------------------------------------------- persistence

interface SaveData {
  state: GameState;
  ai: AiPlayer;
  log: string[];
}

export interface Settings {
  sound: boolean;
  music: boolean;
  fast: boolean;
  difficulty: AiDifficulty;
}

export interface Stats {
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  bestStreak: number;
}

const DEFAULT_SETTINGS: Settings = { sound: true, music: true, fast: false, difficulty: 'normal' };
const DEFAULT_STATS: Stats = { wins: 0, losses: 0, draws: 0, streak: 0, bestStreak: 0 };

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable: progress just won't survive a refresh
  }
}

/** A saved game is only trusted if every card in it still exists. */
function loadSave(): SaveData | null {
  const data = read<SaveData>(SAVE_KEY);
  try {
    if (!data) return null;
    const s = data.state;
    const ids = [...s.board.filter((c) => c).map((c) => c!.cardId), ...s.hands.player.map((c) => c.cardId), ...s.hands.ai.map((c) => c.cardId)];
    if (!Array.isArray(s.board) || typeof data.ai?.rngState !== 'number' || ids.some((id) => !CARDS[id])) return null;
    return data;
  } catch {
    return null;
  }
}

const settings0: Settings = { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(SETTINGS_KEY) };
const stats0: Stats = { ...DEFAULT_STATS, ...read<Partial<Stats>>(STATS_KEY) };

// ---------------------------------------------------------------- engine (module level, not React state)

let ai: AiPlayer = { rngState: 1234, difficulty: settings0.difficulty };
let engine = newEngine();
const saved = loadSave();
if (saved) {
  engine.restore(saved.state);
  ai = { ...saved.ai, difficulty: settings0.difficulty };
}

function newEngine() {
  const seed = (Math.random() * 2 ** 32) >>> 0;
  ai = { ...ai, rngState: seed ^ 0x9e3779b9 };
  return new GameEngine({ cards: CARDS, pool: CARD_POOL, seed });
}

let scene: TableScene | null = null;
let aiRun = 0; // a newer run (e.g. after Restart) cancels any older one

interface GameStore {
  game: GameState;
  screen: 'menu' | 'game';
  /** Board card counts as currently shown (ticks up while captures animate). */
  shownScore: Record<PlayerId, number>;
  /** True while a move is animating or the enemy is playing. */
  busy: boolean;
  log: string[];
  settings: Settings;
  stats: Stats;
  resultOpen: boolean;
  howTo: boolean;
  /** A game in progress exists that can be continued. */
  canContinue: boolean;

  attachScene: (s: TableScene) => void;
  setShownScore: (s: Record<PlayerId, number>) => void;
  placeCard: (uid: number, cell: number) => boolean;
  startNew: () => void;
  continueGame: () => void;
  toMenu: () => void;
  setHowTo: (open: boolean) => void;
  closeResult: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
}

const inProgress = (g: GameState) => !g.winner && g.moves > 0;

export const useGameStore = create<GameStore>((set, get) => {
  const persist = () => write(SAVE_KEY, { state: engine.getState(), ai, log: get().log } satisfies SaveData);

  /** Apply the engine's events to the log and save; returns nothing to animate by itself. */
  const record = (events: GameEvent[]) => {
    const lines = describeEvents(events, CARDS, engine.getState().size);
    set({ game: engine.getState(), log: [...get().log, ...lines].slice(-LOG_LIMIT), canContinue: inProgress(engine.getState()) });
    persist();
  };

  const updateStats = (winner: PlayerId | 'draw') => {
    const s = { ...get().stats };
    if (winner === 'player') {
      s.wins++;
      s.streak++;
      s.bestStreak = Math.max(s.bestStreak, s.streak);
    } else if (winner === 'ai') {
      s.losses++;
      s.streak = 0;
    } else s.draws++;
    set({ stats: s });
    write(STATS_KEY, s);
  };

  const finish = async (events: GameEvent[]) => {
    const over = events.find((e) => e.type === 'GAME_OVER');
    if (!over || over.type !== 'GAME_OVER') return;
    updateStats(over.winner);
    set({ canContinue: false });
    await new Promise((r) => gsap.delayedCall(1.3, () => r(null)));
    set({ resultOpen: true });
  };

  async function runAiTurn() {
    const run = ++aiRun;
    set({ busy: true });
    scene?.setInput(false);
    await scene?.banner('Enemy turn', 'ai');
    while (run === aiRun && !engine.getState().winner && engine.getState().active === 'ai') {
      await new Promise((r) => gsap.delayedCall(THINK_MS / 1000, () => r(null)));
      if (run !== aiRun) return;
      const action = nextAiAction(engine, 'ai', ai);
      const events = engine.dispatch('ai', action);
      record(events);
      await scene?.play(events, engine.getState());
      if (run !== aiRun) return;
      if (engine.getState().winner) {
        set({ busy: false });
        await finish(events);
        return;
      }
    }
    if (run !== aiRun) return;
    set({ busy: false });
    scene?.setInput(true); // don't make the player wait for the banner
    void scene?.banner('Your turn', 'player');
  }

  async function beginGame() {
    const run = ++aiRun;
    set({ busy: true, resultOpen: false });
    scene?.setInput(false);
    scene?.clear();
    await scene?.deal(engine.getState());
    if (run !== aiRun) return;
    if (engine.getState().active === 'ai') {
      void runAiTurn();
    } else {
      set({ busy: false });
      scene?.setInput(true);
      void scene?.banner('Your turn', 'player');
    }
  }

  const applySettings = (s: Settings) => {
    audio.setSound(s.sound);
    audio.setMusic(s.music);
    gsap.globalTimeline.timeScale(s.fast ? 1.7 : 1);
    ai = { ...ai, difficulty: s.difficulty };
  };
  applySettings(settings0);

  return {
    game: engine.getState(),
    screen: 'menu',
    shownScore: { player: 0, ai: 0 },
    busy: false,
    log: saved?.log ?? [],
    settings: settings0,
    stats: stats0,
    resultOpen: false,
    howTo: false,
    canContinue: !!saved && inProgress(saved.state),

    attachScene: (s) => {
      scene = s;
      const g = engine.getState();
      if (g.moves > 0 || g.winner) {
        s.sync(g); // resume a saved game (finished or not) without replaying the deal
      }
    },

    setShownScore: (score) => set({ shownScore: score }),

    placeCard: (uid, cell) => {
      const s = get();
      if (s.busy || s.screen !== 'game' || s.game.active !== 'player' || s.game.winner) return false;
      let events: GameEvent[];
      try {
        events = engine.place('player', uid, cell);
      } catch {
        return false;
      }
      record(events);
      set({ busy: true });
      scene?.setInput(false);
      void (async () => {
        const run = aiRun;
        await scene?.play(events, engine.getState());
        if (run !== aiRun) return;
        if (engine.getState().winner) {
          set({ busy: false });
          await finish(events);
        } else {
          void runAiTurn();
        }
      })();
      return true;
    },

    startNew: () => {
      aiRun++;
      engine = newEngine();
      set({ game: engine.getState(), log: [], screen: 'game', resultOpen: false, canContinue: false, shownScore: { player: 0, ai: 0 } });
      persist();
      audio.unlock();
      void beginGame();
    },

    continueGame: () => {
      audio.unlock();
      set({ screen: 'game', resultOpen: false });
      const g = engine.getState();
      // Resuming mid-enemy-turn (refresh during the AI move): let it finish.
      if (!g.winner && g.active === 'ai' && !get().busy) void runAiTurn();
      else if (!g.winner && !get().busy) scene?.setInput(true);
    },

    toMenu: () => set({ screen: 'menu' }),
    setHowTo: (open) => set({ howTo: open }),
    closeResult: () => set({ resultOpen: false }),

    updateSettings: (patch) => {
      const next = { ...get().settings, ...patch };
      set({ settings: next });
      write(SETTINGS_KEY, next);
      applySettings(next);
    },
  };
});
