import { describe, expect, it } from 'vitest';
import { simulate } from '../src/game/sim/simulate';

/** `SIM_GAMES=500 npm run sim` prints win rates for balance checks. */
const N = Number(process.env.SIM_GAMES ?? 60);
const report = (label: string, r: unknown) => {
  if (process.env.SIM_GAMES) process.stdout.write(`${label}: ${JSON.stringify(r)}\n`);
};

describe('AI', () => {
  it('plays complete, legal games (the engine throws on any illegal move)', () => {
    const r = simulate(20, 'normal', 'easy', { seed: 5 });
    expect(r.wins.player + r.wins.ai + r.draws).toBe(20);
  });

  it('Normal beats Easy most of the time, from either seat', () => {
    const r = simulate(N, 'normal', 'easy', { seed: 99 });
    report('normal(player) vs easy(ai)', r);
    expect(r.wins.player / N).toBeGreaterThan(0.6);
    const swapped = simulate(N, 'easy', 'normal', { seed: 77 });
    report('easy(player) vs normal(ai)', swapped);
    expect(swapped.wins.ai / N).toBeGreaterThan(0.6);
  });

  it('is not hugely lopsided in the Normal mirror match', () => {
    const r = simulate(N, 'normal', 'normal', { seed: 3 });
    report('normal vs normal', r);
    expect(Math.abs(r.wins.player - r.wins.ai) / N).toBeLessThan(0.5);
  });
});
