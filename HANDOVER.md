# Fantasy_CG — Handover / Resume Guide

Paste this file (plus [PLAN.md](PLAN.md)) into a new Claude session to resume work.

## What this is
A dark-fantasy PvE card game (player vs AI). **The game was redesigned** from a lane-battler (units, Essence, heroes) to a **Triple Triad-style board game**, modelled on the card mini-game in *Witch Trainer Silver*: a single shared board, cards with four edge numbers, captures by comparing touching edges. The original lane-battler (statuses, evolution, combos, equipment, Normal AI) is preserved on the local git branch **`legacy/lane-battler`** (not pushed) if any of it is wanted again. The original spec (`pve_card_game_project_spec.md`) is not in the repo.

Stack: Vite 8 + React 19 + TypeScript (strict) + PixiJS 8 + GSAP + Zustand 5 + Zod + Vitest 5 (+ playwright-core for browser smoke tests).

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
- Game ends when the board is full. Winner = most cards of their colour **on the board**; equal counts are broken by the **total of all printed numbers on the cards each player owns** (`decideWinner` / `strength` in rules.ts, shown in the log and result overlay); only equal on both is a draw. Who moves first is decided by the seed.
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
  store/gameStore.ts  Zustand: screens, settings, stats, game flow + persistence; run-token cancels a stale AI turn
  render/             PixiJS: TableScene, CardView, fx, layout, textures, audio, presenter (store->scene slot)
  components/         React: App, Table (canvas host), Hud, Menu, Modals (result + how-to), ui.css
  main.tsx
tests/rules.test.ts   capture rules, no-chain, edges, turn/end, dealing, Zod, architecture
tests/ai.test.ts      legal full games, Normal beats Easy from both seats, mirror sanity
```

### Key design decisions
- **Pure reducer**: `applyAction(state, action, cards) -> { state, events }` (structuredClone). Same seed + same actions = same game.
- **Events drive presentation**: the log and the board highlights (`lastPlaced`, flip animation on `lastFlipped`) consume engine events.
- **Fog of war**: the AI only sees `getVisibleState` (opponent hand masked as `HIDDEN`).
- **Persistence**: the whole game (+ AI rng, difficulty, log) is saved to localStorage key `fantasy-cg-triad-save-v1` after every action, so a refresh restores the same game; only Restart deals a new one. A save with unknown card ids is discarded.

### Presentation layer (production-style UI)
- **PixiJS table** (`src/render/`): procedural card faces painted to 400x560 (5:7, real playing-card shape) canvas textures. Cards are **art-first**: the illustration fills the whole face; a thin frame in the owner's colour (blue = yours, red = enemy's), a rarity hairline, compact number badges and a name plate sit on top. Dark wine/gold palette, ornate board plate, vignette, rising embers. No panels behind the hands. The player's hand is large (about 25% of screen height; on desktop it is sized so all four numbers stay visible, on phones it overlaps). `TableScene` owns drag-and-drop (stationary hit zones per hand card so hover never flickers), click-to-select, green legal-cell outlines, capture preview (`+N` and glowing targets), and every animation: deal-in with face-up flips, hover lift with name label, card slam with shake/ring/sparks, the enemy card rising and revealing before it lands, staggered capture flips with beams, turn banners, confetti on victory.
- **Flow** (`store/gameStore.ts`): `placeCard` returns true/false synchronously (the scene calls it from the drop), then `scene.play(events, state)` animates; the AI loop awaits the animation before the next step; `busy` blocks input. `setShownScore` is driven by the scene so HUD scores tick up as flips land. Screens: menu (Continue / New game / How to play / difficulty / sound / music / speed / stats) and game (HUD + log drawer + options popover), plus a result modal after the finale.
- **Audio** (`render/audio.ts`): everything is synthesised with Web Audio (no asset files), plus an ambient pad. Unlocked on the first pointer press.
- **Settings/stats** persist in localStorage (`fantasy-cg-settings-v1`, `fantasy-cg-stats-v1`); the game itself in `fantasy-cg-triad-save-v1`.
- **Artwork**: only art is left to supply. `public/cards/<cardId>.png` (1000x1400, 5:7) is auto-detected and swapped in live; spec + safe-zone template in `docs/CARD_ART.md`; `Cinzel` and `Inter` come from Google Fonts in `index.html`.
- **Testing the UI**: run `npm run dev -- --port 5199`, then `npm run shot` / `npm run playthrough` (headless Chrome via playwright-core; screenshots go to `shots/`, which is git-ignored). In dev the scene is exposed as `window.__scene` for these scripts.

## Balance snapshot (100 games each, `SIM_GAMES=100 npm run sim`, with the tiebreak)
Normal vs Easy: 73-27 (player seat) and 74-26 (ai seat), 0 draws. Normal mirror: 46/53/1 draw. The first mover wins about 22-31% of the time overall (roughly even once seats alternate). Before the tiebreak ~20% of games were 8-8 draws.

## Known gaps / ideas
- Board size is a constant; no UI to change it. A 5x5 board gives the first mover 13 cards vs 12.
- No Same/Plus/Combo-style extra rules (the Witch Trainer Silver guides don't mention any), no card elements, no deck building or card collection, no rewards/progression.
- Card art is the only missing content (placeholder glyphs); there is no card-back/table/logo image slot yet (they are painted procedurally in `render/textures.ts`).
- No ESLint config; the "engine has no UI imports" rule is a test only.
- No first-move balancing (the guides say going second is easier).
- The UI was verified in headless Chrome at desktop (1100x780) and phone (390x844) sizes: deal, drag, click, capture, result, refresh-resume. Real-device touch and audio were not tested.
- On a phone the 8-card hand overlaps heavily (tap a card to lift it).

## Conventions for future work
- Put all rules in `src/game/engine/` and keep them deterministic and UI-free; add a Vitest test per rule.
- New cards: add to the `list` in `src/data/cards.ts` (Zod validates ranks 1..12 at load).
- New engine events: add to `GameEvent` and handle in `log.ts`.
