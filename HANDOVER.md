# Fantasy_CG — Handover / Resume Guide

Paste this file (plus [PLAN.md](PLAN.md)) into a new Claude session to resume work.

## What this is
A dark-fantasy PvE card game (player vs AI). **The game was redesigned** from a lane-battler (units, Essence, heroes) to a **Triple Triad-style board game**, modelled on the card mini-game in *Witch Trainer Silver*: a single shared board, cards with four edge numbers, captures by comparing touching edges. The original lane-battler (statuses, evolution, combos, equipment, Normal AI) is preserved on the local git branch **`legacy/lane-battler`** (not pushed) if any of it is wanted again. The original spec (`pve_card_game_project_spec.md`) is not in the repo.

Stack: Vite 8 + React 19 + TypeScript (strict) + Zustand 5 + Zod + Vitest 5.

```
npm install
npm run dev         # play
npm test            # 19 tests
npm run sim         # AI-vs-AI balance (SIM_GAMES=500 npm run sim prints win rates)
npm run typecheck
```

## Rules (as implemented)
- Board is `BOARD_SIZE x BOARD_SIZE` (`src/game/engine/constants.ts`, currently **4**). Each player gets half the cells as cards (odd sizes: the first mover gets the extra card). Hands are dealt from `CARD_POOL`; the enemy hand is hidden from the UI and from the AI.
- Cards have `ranks` {top,right,bottom,left}, each 1..`MAX_RANK` (12). Rarity (common/rare/epic/legendary) only tints the card; stronger rarities simply have higher totals.
- Turn: place one card from your hand on an empty cell. Then each **direct neighbour that belongs to the enemy** flips to the placer's colour if the placed card's number on the touching edge is **strictly greater** than the neighbour's number on the facing edge. Equal/lower: nothing. **No chaining** (flipped cards do not capture further). Placed cards keep their colour regardless of their own weak edges; captured cards can be captured back.
- Game ends when the board is full. Winner = most cards of their colour **on the board**; equal = draw. Who moves first is decided by the seed.
- Dealing is fair: a random sample is dealt in snake order by total strength, then hands are swapped until their totals are as close as possible (tests: gap <= 4).

## Architecture
Layering rule: **`src/game/` is a headless, framework-free engine** (no React/Pixi/Zustand; enforced by a test).

```
src/
  game/
    engine/
      types.ts        GameState, CardDef, Action (PLACE), GameEvent (PLACED, CAPTURED, GAME_OVER)
      rules.ts        PURE rules: createGame (dealing), applyAction, legalActions,
                      capturesFor, score, neighbour, getVisibleState (hides opp hand)
      GameEngine.ts   thin stateful facade: place/dispatch, getState, restore, getLegalActions
      rng.ts          seeded mulberry32; constants.ts; opponent.ts; index.ts
    ai/
      easy.ts         greedy (most flips) with 35% random mistakes; also exports AiContext
      normal.ts       two-ply: +10/flip now, -10 x opponent's expected best reply (averaged
                      over the cards they could hold = unseen cards), -0.1 x card strength
      runner.ts       nextAiAction(engine, me, ai) using ONLY the visible state; AiPlayer {rngState, difficulty}
    sim/simulate.ts   headless AI-vs-AI batches (first mover alternates)
    log.ts            describeEvents(): events -> readable lines ("Enemy placed Mage at B3", "  ↳ ... captured ...")
  data/cards.ts       28 placeholder cards + Zod schema + buildRegistry(); CARDS, CARD_POOL
  store/gameStore.ts  Zustand: game snapshot, selection, aiThinking, log, lastPlaced/lastFlipped,
                      difficulty; persists to localStorage; run-token cancels a stale AI turn on Restart
  components/board/   Board.tsx (score bar, grid, hands, log, controls), CardFace.tsx, board.css
  main.tsx
tests/rules.test.ts   capture rules, no-chain, edges, turn/end, dealing, Zod, architecture
tests/ai.test.ts      legal full games, Normal beats Easy from both seats, mirror sanity
```

### Key design decisions
- **Pure reducer**: `applyAction(state, action, cards) -> { state, events }` (structuredClone). Same seed + same actions = same game.
- **Events drive presentation**: the log and the board highlights (`lastPlaced`, flip animation on `lastFlipped`) consume engine events.
- **Fog of war**: the AI only sees `getVisibleState` (opponent hand masked as `HIDDEN`).
- **Persistence**: the whole game (+ AI rng, difficulty, log) is saved to localStorage key `fantasy-cg-triad-save-v1` after every action, so a refresh restores the same game; only Restart deals a new one. A save with unknown card ids is discarded.

### UI
- Score bar (You / status / Enemy), enemy hand as face-down backs, 4x4 grid, your hand (fixed 8-slot grid with dashed placeholders so the container never resizes), log, Restart + AI difficulty.
- Drag a card onto an empty cell, or click a card then a cell. Hovering a legal cell previews how many cards it would flip (+N). Blue = yours, red = enemy's; captured cards replay a flip animation; the last placed cell has a gold outline.
- Card art is a placeholder glyph per card (`CardDef.glyph`); swap for real artwork later.

## Balance snapshot (100 games each, `SIM_GAMES=100 npm run sim`)
Normal vs Easy: 68 wins / 12 losses / 20 draws (from either seat). Normal mirror: roughly even (36/46/18). Draws are ~18-20% because 8-8 is a common outcome on a 16-cell board; a tiebreaker (e.g. total of captured ranks, or sudden-death) is an open design question.

## Known gaps / ideas
- Board size is a constant; no UI to change it. A 5x5 board gives the first mover 13 cards vs 12.
- No Same/Plus/Combo-style extra rules (the Witch Trainer Silver guides don't mention any), no card elements, no deck building or card collection, no rewards/progression.
- Card art is placeholder; the PixiJS visual layer from PLAN.md M3 is not started.
- No ESLint config; the "engine has no UI imports" rule is a test only.
- No first-move balancing (the guides say going second is easier).
- The UI was only build-checked (`npm run build`), not looked at in a browser by the author of this handover: check layout, drag-and-drop and the flip animation.

## Conventions for future work
- Put all rules in `src/game/engine/` and keep them deterministic and UI-free; add a Vitest test per rule.
- New cards: add to the `list` in `src/data/cards.ts` (Zod validates ranks 1..12 at load).
- New engine events: add to `GameEvent` and handle in `log.ts`.
