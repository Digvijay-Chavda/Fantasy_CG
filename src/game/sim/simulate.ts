import { CARD_POOL, CARDS } from '../../data/cards';
import { nextAiAction, type AiDifficulty, type AiPlayer } from '../ai/runner';
import { GameEngine, score } from '../engine';
import type { CardRegistry, PlayerId } from '../engine';

export interface SimResult {
  games: number;
  /** Wins per side. */
  wins: Record<PlayerId, number>;
  draws: number;
  /** Average final board count per side. */
  avgScore: Record<PlayerId, number>;
  /** Wins by whichever side moved first. */
  firstMoverWins: number;
}

/**
 * Headless AI-vs-AI batch on the pure engine. The first mover alternates between games so seat
 * advantage cancels out, and `firstMoverWins` shows how big that advantage is.
 */
export function simulate(
  games: number,
  playerAi: AiDifficulty,
  aiAi: AiDifficulty,
  opts: { cards?: CardRegistry; pool?: string[]; seed?: number } = {},
): SimResult {
  const cards = opts.cards ?? CARDS;
  const pool = opts.pool ?? CARD_POOL;
  const wins: Record<PlayerId, number> = { player: 0, ai: 0 };
  const totals: Record<PlayerId, number> = { player: 0, ai: 0 };
  let draws = 0;
  let firstMoverWins = 0;

  for (let g = 0; g < games; g++) {
    const seed = ((opts.seed ?? 1) + g * 7919) >>> 0;
    const first: PlayerId = g % 2 === 0 ? 'player' : 'ai';
    const engine = new GameEngine({ cards, pool, seed, firstPlayer: first });
    const brains: Record<PlayerId, AiPlayer> = {
      player: { rngState: seed ^ 0x1234567, difficulty: playerAi },
      ai: { rngState: seed ^ 0x7654321, difficulty: aiAi },
    };
    while (!engine.getState().winner) {
      const who = engine.getState().active;
      engine.dispatch(who, nextAiAction(engine, who, brains[who]));
    }
    const s = score(engine.getState());
    totals.player += s.player;
    totals.ai += s.ai;
    const w = engine.getState().winner!;
    if (w === 'draw') draws++;
    else {
      wins[w]++;
      if (w === first) firstMoverWins++;
    }
  }
  return {
    games,
    wins,
    draws,
    avgScore: { player: totals.player / games, ai: totals.ai / games },
    firstMoverWins,
  };
}
