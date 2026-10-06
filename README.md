# Fantasy_CG

Dark-fantasy PvE card game (player vs AI), a Triple Triad-style board game inspired by the card mini-game in *Witch Trainer Silver*. See [HANDOVER.md](HANDOVER.md) for architecture and resume notes and [PLAN.md](PLAN.md) for the roadmap.

## Run

```
npm install
npm run dev        # play
npm test           # rules, dealing and AI tests
npm run sim        # AI-vs-AI balance run (SIM_GAMES=500 npm run sim prints win rates)
npm run typecheck
npm run build
```

## How to play

- One shared **4x4 board** (size is a constant). Each side is dealt 8 cards from the pool; the enemy's hand is hidden.
- Every card has **four numbers**, one per edge (top, right, bottom, left).
- On your turn, **drag a card from your hand onto an empty cell** (or click the card, then the cell).
- When you place a card, each **directly adjacent enemy card** flips to your colour if your number on the touching edge is **strictly higher** than theirs on the facing edge (e.g. your 12 beats their 11). Equal or lower does nothing. Flips **do not chain**.
- Blue cards are yours, red cards are the enemy's. Captured cards change colour, and can be captured back.
- When the board is full, whoever owns **the most cards on the board wins**. If the counts are equal, the **total of all numbers on your cards** breaks the tie; only if that is equal too is it a draw.
- The game log describes every move, including each capture. Refreshing the page keeps your game; only **Restart** deals a new one. Pick **Easy** or **Normal** AI in the controls.

## Structure

- `src/game/engine/` — headless, deterministic rules (pure `applyAction`, seeded RNG, fair dealing). No React or PixiJS (enforced by a test).
- `src/game/ai/` — Easy (greedy + mistakes) and Normal (two-ply look-ahead over unseen cards) AIs.
- `src/game/sim/` — headless AI-vs-AI batch simulator.
- `src/data/cards.ts` — 28 placeholder cards, validated with Zod at load.
- `src/store/` — Zustand store (UI state, engine snapshot, game log, save/restore).
- `src/components/board/` — board, hands and card faces.
