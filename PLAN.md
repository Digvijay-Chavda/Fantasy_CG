# Fantasy_CG — Implementation Plan

Source: `pve_card_game_project_spec.md`. Order: gameplay → engine → AI → UI → animation → art → polish.

## Guiding decisions

- **Engine is a pure TypeScript package** (`src/game/`), no React/Pixi imports. Enforce with an ESLint `no-restricted-imports` rule and run engine tests in plain Node (Vitest).
- **Deterministic engine**: seeded RNG stored in state; `applyAction(state, action) -> { state, events[] }`. Pure/immutable (or Immer) so AI search, undo, replay and tests are trivial.
- **Event log drives visuals**: the engine emits events (`CARD_PLAYED`, `DAMAGE`, `STATUS_APPLIED`, `EVOLVED`, ...). Pixi consumes the event queue and animates; the engine never waits on animations.
- **Data-driven cards**: JSON/TS data validated with Zod at load; abilities are `{ trigger, effect, target, value, condition }` interpreted by a small effect resolver.
- **Zustand** holds UI state (selection, hover, screen) + latest engine snapshot only.

## Milestones

### M0 — Scaffold (½ day)
Vite + React + TS strict, Vitest, ESLint/Prettier, folder layout from spec §17, CI (lint + test + build).

### M1 — Minimal combat prototype (spec §26) — "is it fun?"
- State, 5-card hands, Essence per turn, play card to Frontline/Backline, attack resolution, win condition.
- 10 placeholder cards (Knight, Mage, Archer, Demon, Healer...).
- Rule-based Easy AI (random legal + simple scoring).
- **Throwaway-quality UI**: plain React/DOM or Pixi rectangles with text. Playtest here before investing further.

### M2 — Engine depth (with unit tests per mechanic)
1. Ability resolver (DAMAGE, HEAL, BUFF, DEBUFF, DRAW, SUMMON, SHIELD).
2. Status effects as data + hooks (Burn, Bleed, Poison, Shield, Stun, Rage) with tick timing (start/end of turn, on action, on damage).
3. **Evolution** (signature): stage chain per character, cost/condition/XP triggers, stat+ability swap, same `characterId`, event `EVOLVED`.
4. **Combos**: declarative table `{ requires: [statusA, statusB|tag], result: effect }` (Burn+Bleed → Inferno; Frozen+Fire → Steam).
5. Spell / Equipment / Support / Event card types.
6. Normal AI (board eval + combo/evolution awareness); fog-of-war: AI gets a `getVisibleState(playerId)` view only.
7. Save/load (IndexedDB via `idb-keyval`, versioned schema + migrations).
8. Balance harness: AI-vs-AI headless batch simulation (1000s of games) for win-rate/curve checks.

### M3 — Pixi visual layer
Card component (frame by rarity/evolved), battlefield layout, hover/select, play/move tweens, attack/damage numbers, status VFX, evolution animation, victory/defeat. Animation queue consumes engine events; skip/fast-forward setting.

### M4 — React shell
Main menu, deck select, difficulty, rewards, collection, deck builder + validation, card inspector, settings. Router + Zustand.

### M5 — Artwork pipeline
Character bibles (adult, 18+ explicit in every prompt sheet), InvokeAI workflows with IP-Adapter/ControlNet or character LoRA for consistency, art only (no text), standard crop/aspect, asset manifest `cardId → image` with placeholder fallback. Do this after M1–M2 mechanics are stable.

### M6 — Polish
Audio, particles, transitions, tooltips, Hard AI (limited lookahead/MCTS on the pure engine), responsive layout, progression/unlocks, accessibility.

## Suggestions / risks

1. **Define a tight rules doc first** (turn structure, board size, how attacks target, win condition = HP of a "Hero"/Sanctum?). The spec leaves the core loop undefined; I propose: each side has a Hero with 30 HP; 3 Frontline + 3 Backline slots; Frontline must be cleared (or ranged/spell bypass) before the Hero is hit; Essence +1 max per turn (cap 10). Position matters via taunt-like frontline rule and backline ranged/support bonuses.
2. **Evolution tuning is the main design risk.** Keep it to one clear trigger family in MVP (e.g. pay Essence + character must have survived/attacked N times). Add sacrifice/conditions later.
3. **Cut PixiJS React bridge complexity**: use plain `pixi.js` v8 mounted in one React component (avoid `@pixi/react` initially) — fewer moving parts.
4. **Add a headless balance simulator** early; cheap and prevents design guessing.
5. **Content scale**: ship 10 cards in M1, 20–30 only after loop is fun. Evolution lines are expensive in art (3 images per character) — 5 characters × 3 stages = 15 images, leaving ~10–15 for spells/equipment.
6. **Art/legal**: keep all adult characters unambiguously adult in design (not just labeled), check InvokeAI model licenses, and note that app stores/payment processors restrict explicit content — decide a content ceiling (suggestive vs explicit) before commissioning art.
7. **Determinism + serialization** now makes save-mid-battle, replays and bug reports (paste a seed + action log) nearly free.
8. Use `pixi.js` + `gsap` (or Pixi ticker tweens) for animation; add `howler` only at polish time. Keep dependencies minimal otherwise (Vitest, Zod, Zustand, idb-keyval).

## Proposed folder layout
As in spec §17, plus `src/game/engine/{state,actions,reducer,rng,events}.ts`, `src/game/abilities/resolver.ts`, `src/game/effects/statuses.ts`, `src/game/rules/combos.ts`, `src/game/ai/{easy,normal,evaluate}.ts`, `tests/` mirrored.

## Next step
Approve (or amend) the rules proposal in suggestion #1, then I start M0 + M1.
