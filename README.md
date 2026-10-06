# Fantasy_CG

Dark-fantasy PvE card game (player vs AI), a Triple Triad-style board game inspired by the card mini-game in *Witch Trainer Silver*. See [HANDOVER.md](HANDOVER.md) for architecture and resume notes and [PLAN.md](PLAN.md) for the roadmap.

## Run

```
npm install
npm run dev          # play
npm test             # rules, dealing and AI tests
npm run sim          # AI-vs-AI balance run (SIM_GAMES=500 npm run sim prints win rates)
npm run typecheck
npm run build
npm run shot         # headless-Chrome smoke test + screenshots to ./shots (needs the dev server on :5199)
npm run playthrough  # plays a whole game by clicking and tests refresh-resume
```

## How to play

- One shared **4x4 board** (size is a constant). Each side is dealt 8 cards from the pool; the enemy's hand is hidden.
- Every card has **four numbers**, one per edge (top, right, bottom, left).
- On your turn, **drag a card onto an empty cell** (or tap the card, then the cell). Hovering a cell previews how many cards it would flip.
- When you place a card, each **directly adjacent enemy card** flips to your colour if your number on the touching edge is **strictly higher** than theirs on the facing edge (e.g. your 12 beats their 11). Equal or lower does nothing. Flips **do not chain**.
- Blue cards are yours, red cards are the enemy's. Captured cards change colour, and can be captured back.
- When the board is full, whoever owns **the most cards on the board wins**. If the counts are equal, the **total of all numbers on your cards** breaks the tie; only if that is equal too is it a draw.
- Refreshing the page keeps your game; only **New game / Restart** deals a new one. Enemy AI (Easy / Normal), sound, music and animation speed are in the menu; your win/loss record is kept.

## Adding real card art

Everything is placeholder except the artwork slot. Drop **1056 x 1408 px (3:4) portrait PNGs** into `public/cards/` named after the card id (for example `public/cards/phoenix.png`). They are picked up automatically and fill the whole card face. Cards without a file keep their placeholder glyph. See [docs/CARD_ART.md](docs/CARD_ART.md) and [docs/card-art-template.png](docs/card-art-template.png) for the safe areas, what the game overlays, and the full card list.

## Structure

- `src/game/` - headless, deterministic engine (pure `applyAction`, seeded RNG, fair dealing), AIs and the balance simulator. No React or PixiJS (enforced by a test).
- `src/render/` - the PixiJS table: card/board painting (`textures.ts`), `CardView`, particles and shake (`fx.ts`), layout, synthesised audio, and `TableScene` (input, drag-and-drop, all animations).
- `src/store/` - Zustand store: screens, settings, stats, game flow, persistence.
- `src/components/` - React shell: menu, HUD, log drawer, result and how-to modals, `ui.css`.
- `src/data/cards.ts` - 28 placeholder cards, validated with Zod at load.
