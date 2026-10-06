# Fantasy_CG — Handover / Resume Guide

Paste this file (plus [PLAN.md](PLAN.md)) into a new Claude session to resume work.

## What this is
A dark-fantasy PvE card game (player vs AI). Currently at **M1: minimal combat prototype**, playable in the browser with a throwaway DOM UI. The long-term roadmap (M2 engine depth → M3 PixiJS visuals → M4 React shell → M5 art → M6 polish) is in [PLAN.md](PLAN.md). The original spec (`pve_card_game_project_spec.md`) is **not** in the repo.

Stack: Vite 8 + React 19 + TypeScript (strict) + Zustand 5 + Vitest 5.

```
npm install
npm run dev         # play
npm test            # 16 engine/AI tests
npm run typecheck
```

## Core rules (as implemented)
- Each side: Hero with 30 HP, 3 Frontline + 3 Backline slots, deck of 20 (2 of each placeholder card), starting hand 5, max hand 10 (overflow is burned), empty deck = fatigue damage (1, 2, 3…).
- Essence: max +1 at the start of each of your turns (cap 10), refilled each turn. Player goes first and skips their first draw.
- Characters are deployed to a free slot in an allowed row (`rows`) and are not `ready` until your next turn. Spells resolve instantly.
- Attacking: a unit must be `ready` with power > 0. Backline melee units cannot attack; `ranged` units can attack from anywhere, hit any enemy unit and take no retaliation. Melee targets the enemy Frontline first (any unit if the front is empty). **The enemy Hero can only be hit once the enemy Frontline is empty.** Melee attackers take retaliation.
- Win: reduce the enemy Hero to 0. Abilities (all `ON_PLAY`): DAMAGE, HEAL, BUFF, DRAW.

## Architecture
Layering rule: **`src/game/` is a headless, framework-free engine** (no React/Pixi; enforced by a test). UI only reads snapshots and sends actions.

```
src/
  game/
    engine/
      types.ts        GameState, Unit, CardDef, Action, GameEvent, ...
      reducer.ts      PURE rules: createGame, applyAction, legalActions,
                      attackTargets, freeSlots, getVisibleState (fog of war)
      GameEngine.ts   thin stateful facade: dispatch/playCard/attack/endTurn,
                      getState, getVisibleState, getLegalActions, getEventLog
      rng.ts          seeded RNG (state lives in GameState → deterministic)
      constants.ts    HERO_HEALTH, SLOTS_PER_ROW, STARTING_HAND, MAX_HAND, MAX_ESSENCE
      index.ts        public exports
    ai/
      easy.ts         chooseEasyAction: scores legal actions, 20% random "mistakes"
      runner.ts       nextAiAction (uses ONLY getVisibleState), playAiTurn (sync, for tests)
    log.ts            describeEvents(): GameEvent[] -> readable log lines
  data/
    cards/placeholder.ts   10 placeholder cards (CardRegistry)
    decks/starter.ts       STARTER_DECK
  store/gameStore.ts       Zustand: UI state + latest engine snapshot + game log
  components/battle-ui/    Battle.tsx + battle.css (throwaway DOM prototype)
  main.tsx
tests/engine.test.ts
```

### Key design decisions
- **Reducer is pure**: `applyAction(state, action, cards) -> { state, events }` (clones state with `structuredClone`). Same seed + same actions = same game. Enables AI search, replay, tests.
- **Events drive presentation**: engine emits `GameEvent`s (`CARD_PLAYED`, `DAMAGE`, `UNIT_DIED`, `TURN_STARTED`, …). The UI log (`log.ts`) and future Pixi animations consume them; the engine never waits on UI.
- **AI is fog-of-war safe**: it receives `getVisibleState('ai')` (opponent hand/deck masked as `HIDDEN`) plus `getLegalActions`. It has its own RNG (`ai.rngState` in gameStore), separate from the engine's.
- **Store**: module-level `engine` and `ai` variables (not in React state); the Zustand store holds `game` (latest `engine.getState()`), selections, `aiThinking`, `log`, `error`. `act()` wraps engine calls and appends described events to `log`; `guard()` catches illegal-move errors into `error`. `runAiTurn()` steps the AI one action per 700 ms (`AI_DELAY_MS`).
- **Game log**: every action (player and AI) is described; the enemy's drawn cards are hidden ("Enemy drew a card"); turn changes log only the "Turn N" line.

### UI (Battle.tsx)
- Board: enemy rows on top, player rows below; click-to-select **or drag-and-drop**.
- Drag a unit card from hand to a highlighted free slot to deploy; drag a spell onto the divider bar to cast it. Click flow still works (click card → click slot; clicking a spell casts it).
- Hand is a fixed 5×2 grid (MAX_HAND cells) with dashed placeholders for empty cells so the container size never changes.
- Attack: click a ready (gold-bordered) unit, then a highlighted enemy unit or the Hero.

## Changelog of this session
1. Fixed `ReferenceError: Cannot access 'ai' before initialization` (declaration order in gameStore.ts).
2. AI wasted Essence on spells (Arcane Insight) instead of deploying: added +3 score bonus for characters in `easy.ts`.
3. Added descriptive game log (`log.ts`, store `log`, log panel in Battle).
4. Added drag-and-drop + fixed-size hand grid with placeholders; new store action `deployCard(uid, row, slot)`.

## Known gaps / next steps
- AI scoring is simplistic (no board evaluation; slot/row choice = first legal). Spells like Rally/Insight are scored by cost only.
- No visual feedback/animation for AI plays beyond the log; no card art.
- UI is a throwaway DOM prototype — replace with PixiJS in M3.
- No lint config yet; the "engine has no React/Pixi imports" rule is a test, not ESLint.
- Not yet built (see PLAN.md M2): statuses, evolution (signature mechanic), combos, equipment/support cards, Normal/Hard AI, save/load, balance simulator, Zod card validation.

## Conventions for future work
- Put all rules in `src/game/`; keep it deterministic and free of UI imports. Add a Vitest test per mechanic.
- Add new cards as data in `src/data/cards/`; new ability types extend `AbilityType` + `resolveAbility` in the reducer.
- New engine events → add to `GameEvent` and handle in `log.ts`.
